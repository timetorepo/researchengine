/**
 * Bots: named teammates that keep their own conversation, memory and routines.
 * Bots can also meet in a group room, and a project can be handed from one Bot
 * to another. Replies come from the model you have configured. A bot with web
 * access shows every step it took under its reply, and the pages it read.
 *
 * Routines run only while this app is open (Settings can pause them all).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Plus, Send, Trash2, Play, Brain, Repeat, Loader2, ChevronDown, ChevronRight, Globe, Settings2 } from 'lucide-react'
import { useBots } from '@/lib/bots/store'
import { chatWithBot, runRoutine } from '@/lib/bots/runner'
import { MAX_ROUTINES, MIN_EVERY_MINUTES, MAX_RUNS_KEPT, type Bot, type BotMessage, type Routine } from '@/lib/bots/logic'
import { useUI } from '@/stores/useUI'
import { Switch } from '@/components/ui/heroui/Switch'
import { BotFace } from './BotFace'
import { BotSetupPanel, NewBotForm } from './BotSetup'
import { RoomsView } from './RoomsView'
import { ProjectsView } from './ProjectsView'
import { BotsSettings } from './BotsSettings'

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

type Tab = 'bots' | 'groups' | 'projects'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'bots', label: 'Bots' },
  { id: 'groups', label: 'Group chats' },
  { id: 'projects', label: 'Projects' },
]

/**
 * A pill that slides under the active tab (transitions.dev "tabs-sliding").
 * It is measured from the active button, so it follows real widths. The first
 * placement is not animated, and resizes snap; reduced motion disables the slide.
 */
function SlidingTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void; label: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)

  const place = (animate: boolean) => {
    const list = listRef.current
    const pill = pillRef.current
    const btn = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    if (!list || !pill || !btn) return
    // '' hands the transition back to the .tabs-sliding-pill class; 'none' snaps.
    pill.style.transition = animate ? '' : 'none'
    pill.style.width = `${btn.offsetWidth}px`
    pill.style.transform = `translateX(${btn.offsetLeft}px)`
  }

  useLayoutEffect(() => { place(ready) }, [value, ready])
  useLayoutEffect(() => {
    place(false)
    setReady(true)
    const ro = new ResizeObserver(() => place(false))
    if (listRef.current) ro.observe(listRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={listRef} role="tablist" aria-label={label}
      className="relative flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
      <span ref={pillRef} aria-hidden="true" className="tabs-sliding-pill absolute left-0 top-1 bottom-1 rounded-full pointer-events-none"
        style={{ background: 'var(--primary)' }} />
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className="relative z-10 px-3.5 py-1 rounded-full text-[12px] transition-colors duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          style={{ color: value === t.id ? '#fff' : 'var(--text-2)' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function BotsView() {
  const [tab, setTab] = useState<Tab>('bots')
  const [showSettings, setShowSettings] = useState(false)
  const paused = useBots((s) => s.settings.paused)

  return (
    <div className="space-y-4" data-ui="bots">
      <div className="flex flex-wrap items-center gap-2">
        <SlidingTabs label="Bots sections" tabs={TABS} value={tab} onChange={setTab} />
        <div className="ml-auto flex items-center gap-2">
          {paused && <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--warning, var(--text-2))' }}>Routines paused</span>}
          <button type="button" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--elevated)' }}>
            <Settings2 size={13} /> Settings
          </button>
        </div>
      </div>

      {showSettings && <BotsSettings />}

      {tab === 'bots' && <BotsTab />}
      {tab === 'groups' && <RoomsView />}
      {tab === 'projects' && <ProjectsView />}
    </div>
  )
}

function BotsTab() {
  const bots = useBots((s) => s.bots)
  const [selectedId, setSelectedId] = useState<string | null>(bots[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const selected = bots.find((b) => b.id === selectedId) ?? null

  useEffect(() => {
    if (!selected && bots.length) setSelectedId(bots[0].id)
  }, [bots, selected])

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="surface p-3 space-y-2 h-fit">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Your bots</div>
          <button type="button" onClick={() => setCreating((v) => !v)} aria-label="New bot" className="p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
            <Plus size={13} />
          </button>
        </div>
        {bots.length === 0 && !creating && (
          <p className="text-[12px] px-1 py-2" style={{ color: 'var(--text-3)' }}>No bots yet. A bot has a job, keeps its own memory, and can run routines.</p>
        )}
        <ul className="space-y-1">
          {bots.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => { setSelectedId(b.id); setCreating(false) }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-left"
                style={{ background: b.id === selectedId && !creating ? 'var(--elevated)' : 'transparent' }}>
                <BotFace bot={b} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium truncate">{b.name}</span>
                  <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>
                    {b.routines.length} routine{b.routines.length === 1 ? '' : 's'} · {b.memory.length} memories{b.webAccess ? ' · web' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {creating && <NewBotForm onDone={(id) => { setCreating(false); setSelectedId(id) }} />}
      </aside>

      <section className="min-w-0">
        {selected ? <BotThread bot={selected} /> : (
          <div className="surface p-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            Create a bot to start. Give it a name and the job you want done; you can talk to it here.
          </div>
        )}
      </section>

      <aside className="space-y-4">
        {selected && <BotSide bot={selected} />}
      </aside>
    </div>
  )
}

/** The trace and sources a reply carries. Shown closed, so a long trace does not crowd the thread. */
function ReplyEvidence({ m }: { m: Pick<BotMessage, 'trace' | 'sources'> }) {
  if (!m.trace?.length && !m.sources?.length) return null
  return (
    <div className="mt-1.5 space-y-1">
      {m.trace && m.trace.length > 0 && (
        <details className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          <summary className="cursor-pointer select-none">How it answered ({m.trace.length} web step{m.trace.length === 1 ? '' : 's'})</summary>
          <ol className="list-decimal pl-5 pt-1 space-y-0.5">
            {m.trace.map((t, i) => <li key={`${i}-${t}`}>{t}</li>)}
          </ol>
        </details>
      )}
      {m.sources && m.sources.length > 0 && (
        <ol className="text-[11px] pl-4 list-decimal space-y-0.5" aria-label="Sources">
          {m.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all" style={{ color: 'var(--text-2)' }}>{s.title || s.url}</a></li>
          ))}
        </ol>
      )}
    </div>
  )
}

function BotThread({ bot }: { bot: Bot }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobDraft, setJobDraft] = useState(bot.job)
  const endRef = useRef<HTMLDivElement | null>(null)
  const ui = useUI()

  useEffect(() => { setJobDraft(bot.job); setText('') }, [bot.id])
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [bot.thread.length])

  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    setBusy(true)
    try { await chatWithBot(bot.id, t) } finally { setBusy(false) }
  }

  const removeBot = () => {
    if (!window.confirm(`Delete ${bot.name}? Its thread, memory and routines are removed from this device.`)) return
    useBots.getState().remove(bot.id)
    ui.toast('Bot deleted', bot.name, 'success')
  }

  return (
    <div className="surface flex flex-col min-h-[560px]">
      <header className="px-4 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <BotFace bot={bot} size={36} busy={busy} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold truncate flex items-center gap-1.5">
            {bot.name}
            {bot.webAccess && <span title="Web access on" className="inline-flex items-center gap-0.5 text-[10px] font-normal" style={{ color: 'var(--text-3)' }}><Globe size={11} /> web</span>}
            {bot.role && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{bot.role.name}</span>}
          </div>
          <textarea value={jobDraft} onChange={(e) => setJobDraft(e.target.value)} rows={1}
            onBlur={() => { if (jobDraft !== bot.job) useBots.getState().setJob(bot.id, jobDraft) }}
            aria-label="Bot job" placeholder="Describe its job"
            className="w-full bg-transparent outline-none text-[11.5px] resize-none" style={{ color: 'var(--text-3)' }} />
        </div>
        <button type="button" onClick={removeBot} aria-label={`Delete ${bot.name}`} className="p-1.5 rounded-full" style={{ color: 'var(--text-3)' }}>
          <Trash2 size={13} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {bot.thread.length === 0 && (
          <p className="text-[12.5px] text-center py-10" style={{ color: 'var(--text-3)' }}>
            Say what you need. To save something for later, start with “remember:”.
          </p>
        )}
        {bot.thread.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%]">
              <div className="px-3 py-2 rounded-[12px] text-[12.5px] leading-relaxed whitespace-pre-wrap"
                style={{
                  background: m.role === 'user' ? 'var(--primary)' : m.role === 'note' ? 'transparent' : 'var(--elevated)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  border: m.role === 'note' ? '1px dashed var(--surface-border)' : undefined,
                  fontStyle: m.role === 'note' ? 'italic' : undefined,
                }}>
                {m.routineId && <span className="block text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Routine</span>}
                {m.text}
              </div>
              {m.role === 'bot' && <ReplyEvidence m={m} />}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11.5px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> {bot.name} is thinking</div>}
        <div ref={endRef} />
      </div>

      <form className="p-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--surface-border)' }}
        onSubmit={(e) => { e.preventDefault(); void send() }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label={`Message ${bot.name}`}
          placeholder={`Message ${bot.name}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          className="flex-1 px-3 py-2 rounded-[12px] text-[12.5px] outline-none resize-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="p-2.5 rounded-full disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}

function BotSide({ bot }: { bot: Bot }) {
  const [tab, setTab] = useState<'routines' | 'memory' | 'setup'>('routines')
  const tabs: Array<{ id: typeof tab; label: string; icon: ReactElement }> = [
    { id: 'routines', label: `Routines (${bot.routines.length})`, icon: <Repeat size={12} /> },
    { id: 'memory', label: `Memory (${bot.memory.length})`, icon: <Brain size={12} /> },
    { id: 'setup', label: 'Setup', icon: <Settings2 size={12} /> },
  ]
  return (
    <div className="surface p-3 space-y-3">
      <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
            className="flex-1 px-2 py-1 rounded-full text-[11.5px] inline-flex items-center justify-center gap-1"
            style={{ background: tab === t.id ? 'var(--primary)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-2)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'memory' && <MemoryPanel bot={bot} />}
      {tab === 'routines' && <RoutinesPanel bot={bot} />}
      {tab === 'setup' && <BotSetupPanel bot={bot} />}
    </div>
  )
}

function MemoryPanel({ bot }: { bot: Bot }) {
  const [text, setText] = useState('')
  const ui = useUI()
  const add = () => {
    const err = useBots.getState().remember(bot.id, text)
    if (err) ui.toast('Not saved', err, 'warning')
    else setText('')
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>What {bot.name} keeps between conversations. It reads these before every reply.</p>
      <div className="flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="Something to remember" aria-label="New memory"
          className="flex-1 px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="button" onClick={add} disabled={!text.trim()} className="px-2.5 rounded-[10px] text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>Save</button>
      </div>
      {bot.memory.length === 0 && <p className="text-[12px] py-2" style={{ color: 'var(--text-3)' }}>Nothing saved yet.</p>}
      <ul className="space-y-1">
        {bot.memory.map((m, i) => (
          <li key={`${i}-${m}`} className="group flex items-start gap-2 text-[12px] px-2 py-1.5 rounded-[8px]" style={{ background: 'var(--elevated)' }}>
            <span className="flex-1 leading-snug">{m}</span>
            <button type="button" onClick={() => useBots.getState().forget(bot.id, i)} aria-label={`Forget ${m}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: 'var(--text-3)' }}>
              <Trash2 size={11} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoutinesPanel({ bot }: { bot: Bot }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [every, setEvery] = useState(60)
  const ui = useUI()
  const atLimit = bot.routines.length >= MAX_ROUTINES
  const paused = useBots((s) => s.settings.paused)

  const add = () => {
    const err = useBots.getState().addRoutine(bot.id, { title, instructions, everyMinutes: every })
    if (err) { ui.toast('Routine not added', err, 'warning'); return }
    setTitle(''); setInstructions('')
    ui.toast('Routine added', `${title.trim()} runs every ${every} minutes while the app is open.`, 'success')
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        A routine is a standing job on a schedule. It runs only while Research Engine is open; when the app opens after a missed time, it runs once.
        {paused ? ' Routines are paused in Settings right now.' : ''}
      </p>
      <div className="space-y-1.5 p-2 rounded-[10px]" style={{ background: 'var(--elevated)' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Morning brief" aria-label="Routine title" disabled={atLimit}
          className="w-full px-2 py-1 rounded-[8px] text-[12px] outline-none bg-transparent" />
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="What to do each time" aria-label="Routine instructions" disabled={atLimit}
          className="w-full px-2 py-1 rounded-[8px] text-[12px] outline-none bg-transparent resize-none" />
        <div className="flex items-center gap-2 text-[11.5px]">
          <span style={{ color: 'var(--text-3)' }}>Every</span>
          <input type="number" min={MIN_EVERY_MINUTES} value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="Minutes between runs" disabled={atLimit}
            className="w-[70px] px-2 py-0.5 rounded-[8px] bg-transparent outline-none tabular-nums" style={{ border: '1px solid var(--surface-border)' }} />
          <span style={{ color: 'var(--text-3)' }}>minutes (at least {MIN_EVERY_MINUTES})</span>
        </div>
        <button type="button" onClick={add} disabled={atLimit} className="w-full px-3 py-1.5 rounded-full text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>
          {atLimit ? `Limit of ${MAX_ROUTINES} reached` : 'Add routine'}
        </button>
      </div>
      <ul className="space-y-2">
        {bot.routines.map((r) => <RoutineRow key={r.id} botId={bot.id} routine={r} />)}
      </ul>
    </div>
  )
}

function RoutineRow({ botId, routine }: { botId: string; routine: Routine }) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const lastRun = routine.runs[0]
  const nextText = useMemo(() => (routine.enabled ? `next ${when(routine.nextRunAt)}` : 'paused'), [routine.enabled, routine.nextRunAt])

  const runNow = async () => {
    setRunning(true)
    try { await runRoutine(botId, routine.id) } finally { setRunning(false) }
  }

  return (
    <li className="p-2 rounded-[10px] space-y-1.5" style={{ background: 'var(--elevated)' }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1 min-w-0 flex-1 text-left">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-[12px] font-medium truncate">{routine.title}</span>
        </button>
        <Switch checked={routine.enabled} label={`Enable ${routine.title}`} size="sm"
          onChange={(v) => useBots.getState().patchRoutine(botId, routine.id, { enabled: v })} />
      </div>
      <div className="text-[10.5px] pl-4" style={{ color: 'var(--text-3)' }}>
        every {routine.everyMinutes} min · {nextText}{lastRun ? ` · last ${lastRun.ok ? 'ok' : 'failed'} ${when(lastRun.at)}` : ''}
      </div>
      {open && (
        <div className="pl-4 space-y-2">
          <p className="text-[11.5px] whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{routine.instructions}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void runNow()} disabled={running} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] disabled:opacity-50" style={{ background: 'var(--surface)' }}>
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run now
            </button>
            <button type="button" onClick={() => { if (window.confirm(`Delete “${routine.title}”? This cannot be undone.`)) useBots.getState().deleteRoutine(botId, routine.id) }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]" style={{ color: 'var(--danger)', background: 'var(--surface)' }}>
              <Trash2 size={11} /> Delete
            </button>
          </div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Last {MAX_RUNS_KEPT} runs</div>
          <ul className="space-y-1">
            {routine.runs.length === 0 && <li className="text-[11px]" style={{ color: 'var(--text-3)' }}>No runs yet.</li>}
            {routine.runs.map((run) => (
              <li key={run.id} className="text-[11px] leading-snug">
                <span style={{ color: run.ok ? 'var(--success)' : 'var(--danger)' }}>{run.ok ? '●' : '○'}</span> <span style={{ color: 'var(--text-3)' }}>{when(run.at)}</span>
                <div className="pl-3 whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{run.text.slice(0, 400)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
