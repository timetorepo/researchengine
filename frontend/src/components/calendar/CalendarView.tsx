/**
 * Calendar: your own events, plus any calendar you bring in. Events made here
 * stay on this device. A calendar can come in as an .ics file, or as a Google
 * Calendar secret address (see lib/calendar/store.ts for why that one goes
 * through the backend). Month and agenda views show both, and recurring events
 * are expanded into the days they fall on.
 */
import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Download, Upload, RefreshCw, Link2, CalendarDays, List, X } from 'lucide-react'
import { useCalendar, GOOGLE_ICS_RE, type Feed } from '@/lib/calendar/store'
import { occurrences, toIcs, type CalEvent } from '@/lib/calendar/ics'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'
import { Select } from '@/components/ui/watermelon/Select'
import { Switch } from '@/components/ui/heroui/Switch'

const DAY_MS = 86400000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const REPEATS = [
  { value: '', label: 'Does not repeat' },
  { value: 'FREQ=DAILY', label: 'Every day' },
  { value: 'FREQ=WEEKLY', label: 'Every week' },
  { value: 'FREQ=MONTHLY', label: 'Every month' },
  { value: 'FREQ=YEARLY', label: 'Every year' },
]

const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
const startOfDay = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const dateInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const parseDateInput = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

/** Every event that touches [from, to), with recurrences expanded, sorted by start. */
function eventsBetween(all: CalEvent[], from: number, to: number): CalEvent[] {
  return all.flatMap((e) => occurrences(e, from, to)).sort((a, b) => a.start - b.start)
}

export function CalendarView() {
  const events = useCalendar((s) => s.events)
  const feeds = useCalendar((s) => s.feeds)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [selected, setSelected] = useState<number>(() => startOfDay(Date.now()))
  const [editing, setEditing] = useState<CalEvent | 'new' | null>(null)
  const ui = useUI()

  const cur = new Date(cursor)
  const gridStart = (() => { const first = new Date(cur.getFullYear(), cur.getMonth(), 1); const offset = (first.getDay() + 6) % 7; return new Date(first.getFullYear(), first.getMonth(), 1 - offset).getTime() })()
  const gridEnd = gridStart + 42 * DAY_MS
  const grid = useMemo(() => eventsBetween(events, gridStart, gridEnd), [events, gridStart, gridEnd])
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of grid) {
      const first = startOfDay(e.start)
      const last = startOfDay(Math.max(e.start, e.end - 1))
      for (let d = first; d <= last; d += DAY_MS) {
        const k = dayKey(d)
        map.set(k, [...(map.get(k) ?? []), e])
      }
    }
    return map
  }, [grid])

  const agendaTo = startOfDay(Date.now()) + 60 * DAY_MS
  const agenda = useMemo(() => eventsBetween(events, startOfDay(Date.now()), agendaTo), [events, agendaTo])

  const shift = (months: number) => setCursor(new Date(cur.getFullYear(), cur.getMonth() + months, 1).getTime())
  const today = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1).getTime()); setSelected(startOfDay(d.getTime())) }

  const dayEvents = byDay.get(dayKey(selected)) ?? []
  const todayKey = dayKey(Date.now())

  return (
    <div className="space-y-4" data-ui="calendar">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="p-1.5 rounded-full" style={{ background: 'var(--elevated)' }}><ChevronLeft size={14} /></button>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="p-1.5 rounded-full" style={{ background: 'var(--elevated)' }}><ChevronRight size={14} /></button>
        <div className="text-[16px] font-semibold min-w-[160px]" style={{ letterSpacing: '-0.01em' }}>
          {cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button type="button" onClick={today} className="px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Today</button>
        <div className="ml-auto flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
          <button type="button" onClick={() => setView('month')} aria-pressed={view === 'month'}
            className="px-3 py-1 rounded-full text-[12px] inline-flex items-center gap-1" style={{ background: view === 'month' ? 'var(--primary)' : 'transparent', color: view === 'month' ? '#fff' : 'var(--text-2)' }}>
            <CalendarDays size={12} /> Month
          </button>
          <button type="button" onClick={() => setView('agenda')} aria-pressed={view === 'agenda'}
            className="px-3 py-1 rounded-full text-[12px] inline-flex items-center gap-1" style={{ background: view === 'agenda' ? 'var(--primary)' : 'transparent', color: view === 'agenda' ? '#fff' : 'var(--text-2)' }}>
            <List size={12} /> Agenda
          </button>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium inline-flex items-center gap-1" style={{ background: 'var(--primary)', color: '#fff' }}>
          <Plus size={13} /> New event
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {view === 'month' ? (
          <div className="surface p-2 overflow-hidden" role="grid" aria-label="Month">
            <div className="grid grid-cols-7 text-[10.5px] uppercase tracking-wider px-1 pb-1" style={{ color: 'var(--text-3)' }}>
              {WEEKDAYS.map((w) => <div key={w} className="px-1.5 py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--surface-border)' }}>
              {Array.from({ length: 42 }, (_, i) => {
                const day = gridStart + i * DAY_MS
                const d = new Date(day)
                const k = dayKey(day)
                const list = byDay.get(k) ?? []
                const inMonth = d.getMonth() === cur.getMonth()
                const isSel = startOfDay(day) === selected
                return (
                  <button key={k} type="button" onClick={() => setSelected(startOfDay(day))} aria-label={`${d.toDateString()}, ${list.length} events`}
                    className="min-h-[88px] text-left p-1.5 flex flex-col gap-1 transition-colors"
                    style={{ background: isSel ? 'var(--elevated)' : 'var(--surface)', opacity: inMonth ? 1 : 0.45 }}>
                    <span className="text-[12px] font-medium self-start w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: k === todayKey ? 'var(--primary)' : 'transparent', color: k === todayKey ? '#fff' : 'var(--text-2)' }}>
                      {d.getDate()}
                    </span>
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className="block truncate text-[10.5px] px-1.5 py-0.5 rounded-[6px]"
                        style={{ background: e.feedId ? 'var(--elevated)' : 'color-mix(in srgb, var(--primary) 18%, transparent)', color: 'var(--text-2)' }}>
                        {e.allDay ? '' : `${hm(e.start)} `}{e.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>+{list.length - 3} more</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="surface p-3 space-y-3">
            {agenda.length === 0 && <p className="text-[12.5px] py-4 text-center" style={{ color: 'var(--text-3)' }}>Nothing in the next 60 days.</p>}
            {Array.from(new Set(agenda.map((e) => startOfDay(e.start)))).map((day) => (
              <div key={day}>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                  {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <ul className="space-y-1">
                  {agenda.filter((e) => startOfDay(e.start) === day).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setEditing(e)} className="w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-[10px] hover:bg-[var(--elevated)]">
                        <span className="text-[11.5px] tabular-nums w-[70px] shrink-0" style={{ color: 'var(--text-3)' }}>{e.allDay ? 'All day' : hm(e.start)}</span>
                        <span className="text-[12.5px] truncate">{e.title}</span>
                        {e.feedId && <span className="ml-auto text-[10px] shrink-0" style={{ color: 'var(--text-3)' }}>{feeds.find((f) => f.id === e.feedId)?.name ?? 'imported'}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <aside className="space-y-4">
          <div className="surface p-3 space-y-2" data-ui="calendar-day">
            <div className="text-[12.5px] font-semibold">{new Date(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            {dayEvents.length === 0 && <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>No events this day.</p>}
            <ul className="space-y-1">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setEditing(e)} className="w-full text-left px-2 py-1.5 rounded-[10px] hover:bg-[var(--elevated)]">
                    <div className="text-[12.5px] truncate">{e.title}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{e.allDay ? 'All day' : `${hm(e.start)} – ${hm(e.end)}`}{e.location ? ` · ${e.location}` : ''}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <CalendarSources feeds={feeds} onError={(m, d) => ui.toast(m, d, 'warning')} onOk={(m, d) => ui.toast(m, d, 'success')} />
        </aside>
      </div>

      {editing && (
        <EventForm
          key={editing === 'new' ? `new-${selected}` : editing.id}
          initial={editing === 'new' ? null : editing}
          defaultDay={selected}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EventForm({ initial, defaultDay, onClose }: { initial: CalEvent | null; defaultDay: number; onClose: () => void }) {
  const ui = useUI()
  const isImported = !!initial?.feedId
  const base = initial?.start ?? defaultDay + 9 * 3600000
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(dateInput(base))
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [startT, setStartT] = useState(hm(base))
  const [endT, setEndT] = useState(hm(initial?.end ?? base + 3600000))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [repeat, setRepeat] = useState(initial?.rrule ?? '')
  const repeatOptions = REPEATS.some((r) => r.value === repeat) ? REPEATS : [...REPEATS, { value: repeat, label: `Custom (${repeat})` }]

  const save = () => {
    if (!title.trim()) { ui.toast('Give the event a title', undefined, 'warning'); return }
    const day = parseDateInput(date)
    const toMs = (t: string) => { const [h, m] = t.split(':').map(Number); return day + (h * 60 + m) * 60000 }
    const start = allDay ? day : toMs(startT)
    let end = allDay ? day + DAY_MS : toMs(endT)
    if (!allDay && end <= start) end = start + 3600000
    const rrule = repeat || undefined
    const store = useCalendar.getState()
    if (initial && !isImported) {
      store.updateEvent(initial.id, { title: title.trim(), start, end, allDay, location: location || undefined, notes: notes || undefined, rrule })
    } else if (!initial) {
      store.addEvent({ id: `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, title: title.trim(), start, end, allDay, location: location || undefined, notes: notes || undefined, rrule })
    }
    onClose()
  }

  const remove = () => {
    if (initial) useCalendar.getState().removeEvent(initial.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'var(--scrim)' }} onClick={onClose}>
      <div className="surface w-full max-w-[460px] p-5 space-y-3" role="dialog" aria-label={initial ? 'Edit event' : 'New event'} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className="text-[15px] font-semibold flex-1">{initial ? (isImported ? 'Imported event' : 'Edit event') : 'New event'}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-full" style={{ color: 'var(--text-3)' }}><X size={15} /></button>
        </div>
        {isImported && <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>This came from a calendar you imported. Change it in that calendar, then sync again.</p>}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" disabled={isImported}
          className="w-full px-3 py-2 rounded-[12px] outline-none text-[13px] disabled:opacity-60" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" disabled={isImported}
            className="px-2 py-1.5 rounded-[10px] text-[12.5px] bg-transparent" style={{ border: '1px solid var(--surface-border)' }} />
          {!allDay && <>
            <input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} aria-label="Start time" disabled={isImported}
              className="px-2 py-1.5 rounded-[10px] text-[12.5px] bg-transparent" style={{ border: '1px solid var(--surface-border)' }} />
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>to</span>
            <input type="time" value={endT} onChange={(e) => setEndT(e.target.value)} aria-label="End time" disabled={isImported}
              className="px-2 py-1.5 rounded-[10px] text-[12.5px] bg-transparent" style={{ border: '1px solid var(--surface-border)' }} />
          </>}
        </div>
        <Switch checked={allDay} onChange={setAllDay} label="All day" disabled={isImported} />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" aria-label="Location" disabled={isImported}
          className="w-full px-3 py-2 rounded-[12px] outline-none text-[13px] disabled:opacity-60" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" rows={2} disabled={isImported}
          className="w-full px-3 py-2 rounded-[12px] outline-none text-[13px] resize-y disabled:opacity-60" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        {!isImported && <Select size="sm" value={repeat} onChange={(v) => setRepeat(v)} options={repeatOptions} className="w-full" />}
        <div className="flex items-center gap-2 pt-1">
          {initial && !isImported && (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px]" style={{ color: 'var(--danger)', background: 'var(--elevated)' }}>
              <Trash2 size={12} /> Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)' }}>Cancel</button>
            {!isImported && <button type="button" onClick={save} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Save</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarSources({ feeds, onOk, onError }: { feeds: Feed[]; onOk: (m: string, d?: string) => void; onError: (m: string, d?: string) => void }) {
  const [googleUrl, setGoogleUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const events = useCalendar((s) => s.events)

  const syncGoogle = async (feed: Feed) => {
    if (!feed.url) return
    setBusy(feed.id)
    try {
      const res = await fetch(`/api/calendar/ics?url=${encodeURIComponent(feed.url)}`)
      const text = await res.text()
      if (!res.ok) {
        const msg = (() => { try { return JSON.parse(text).error } catch { return null } })() ?? 'Google did not give a calendar.'
        useCalendar.getState().setFeedError(feed.id, msg)
        onError('Google Calendar did not sync', msg)
        return
      }
      const { count, skipped } = useCalendar.getState().syncFeed(feed.id, text)
      onOk(`${feed.name} synced`, `${count} events${skipped ? `, ${skipped} could not be read` : ''}.`)
    } catch {
      useCalendar.getState().setFeedError(feed.id, 'The backend is not reachable.')
      onError('Google Calendar did not sync', 'The backend is not reachable.')
    } finally {
      setBusy(null)
    }
  }

  const addGoogle = async () => {
    const url = googleUrl.trim()
    if (!GOOGLE_ICS_RE.test(url)) {
      onError('That is not a Google secret address', 'It should start with https://calendar.google.com/calendar/ical/ and end in .ics.')
      return
    }
    const feed: Feed = { id: `feed_g_${Date.now().toString(36)}`, name: 'Google Calendar', kind: 'google', url, count: 0 }
    useCalendar.getState().addFeed(feed)
    setGoogleUrl('')
    await syncGoogle(feed)
  }

  const importFile = async (file: File) => {
    const text = await file.text()
    if (!text.includes('BEGIN:VCALENDAR')) { onError('Not a calendar file', `${file.name} does not look like an .ics file.`); return }
    const feed: Feed = { id: `feed_f_${Date.now().toString(36)}`, name: file.name.replace(/\.ics$/i, ''), kind: 'file', count: 0 }
    useCalendar.getState().addFeed(feed)
    const { count, skipped } = useCalendar.getState().syncFeed(feed.id, text)
    onOk(`${feed.name} imported`, `${count} events${skipped ? `, ${skipped} could not be read` : ''}.`)
  }

  const exportAll = () => {
    const all = useCalendar.getState().events
    download('research-engine.ics', toIcs(all), 'text/calendar')
    onOk('Calendar exported', `${all.length} events in one .ics file. Google Calendar can import it.`)
  }

  return (
    <div className="surface p-3 space-y-3" data-ui="calendar-sources">
      <div className="text-[12.5px] font-semibold">Calendars</div>
      <div className="text-[11.5px] flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} /> This device · {events.filter((e) => !e.feedId).length} events
      </div>
      {feeds.map((f) => (
        <div key={f.id} className="text-[11.5px] space-y-1">
          <div className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-3)' }} />
            <span className="truncate flex-1">{f.name} · {f.count} events</span>
            {f.kind === 'google' && (
              <button type="button" onClick={() => void syncGoogle(f)} disabled={busy === f.id} aria-label={`Sync ${f.name}`} className="p-1 rounded-full disabled:opacity-50">
                <RefreshCw size={12} className={busy === f.id ? 'animate-spin' : ''} />
              </button>
            )}
            <button type="button" onClick={() => useCalendar.getState().removeFeed(f.id)} aria-label={`Remove ${f.name}`} className="p-1 rounded-full" style={{ color: 'var(--text-3)' }}>
              <Trash2 size={12} />
            </button>
          </div>
          {f.lastSyncedAt && <div className="pl-4" style={{ color: 'var(--text-3)' }}>Synced {new Date(f.lastSyncedAt).toLocaleString()}</div>}
          {f.error && <div className="pl-4" style={{ color: 'var(--danger)' }}>{f.error}</div>}
        </div>
      ))}

      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)' }}>
          <Upload size={12} /> Import an .ics file
        </button>
        <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" aria-label="Calendar file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
        <div className="space-y-1.5">
          <label className="text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}><Link2 size={11} /> Google Calendar</label>
          <input value={googleUrl} onChange={(e) => setGoogleUrl(e.target.value)} aria-label="Google Calendar secret address"
            placeholder="Secret address in iCal format"
            className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
          <button type="button" onClick={() => void addGoogle()} disabled={!googleUrl.trim() || busy !== null}
            className="w-full px-3 py-1.5 rounded-full text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>Add and sync</button>
          <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            In Google Calendar, open the calendar's settings, then Integrate calendar, and copy the Secret address in iCal format. It is read-only and kept in this browser.
          </p>
        </div>
        <button type="button" onClick={exportAll} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Download size={12} /> Export .ics
        </button>
      </div>
    </div>
  )
}
