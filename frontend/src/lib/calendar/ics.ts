/**
 * iCalendar (RFC 5545) in plain functions, so it can be read and tested without
 * a browser. Covers what calendar exports actually contain: folded lines, escaped
 * text, all-day dates, UTC times, times with a TZID, DURATION, and the common
 * RRULE forms (DAILY, WEEKLY with BYDAY, MONTHLY, YEARLY). Anything else is kept
 * as text and does not stop the rest of the file from loading.
 */

export interface CalEvent {
  id: string
  title: string
  /** Epoch milliseconds. For all-day events this is local midnight. */
  start: number
  end: number
  allDay: boolean
  location?: string
  notes?: string
  /** The recurrence rule as written, e.g. "FREQ=WEEKLY;BYDAY=MO". */
  rrule?: string
  /** Set on events that came from a feed; the feed owns and replaces them. */
  feedId?: string
  uid?: string
}

type Line = { name: string; params: Record<string, string>; value: string }

/** Joins continuation lines (a line that starts with a space or tab) back onto the line before. */
export function unfold(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1)
    else if (line.length) out.push(line)
  }
  return out
}

export function parseLine(line: string): Line | null {
  let inQuotes = false
  let sep = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) { sep = i; break }
  }
  if (sep < 0) return null
  const head = line.slice(0, sep)
  const value = line.slice(sep + 1)
  const parts = head.split(';')
  const name = parts[0].toUpperCase()
  const params: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name, params, value }
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

export function escapeText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Offset of a time zone from UTC at an instant, in milliseconds. Throws for a zone name Intl does not know. */
function zoneOffset(tz: string, ms: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, number> = {}
  for (const part of dtf.formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** Wall-clock time in a named zone, as epoch ms. Two passes so a daylight-saving edge lands on the right side. */
export function zonedToEpoch(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  const first = wall - zoneOffset(tz, wall)
  return wall - zoneOffset(tz, first)
}

const DATE_RE = /^(\d{4})(\d{2})(\d{2})$/
const DATETIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/

/** A DTSTART/DTEND/UNTIL value to epoch ms. Returns null when it cannot be read. */
export function parseIcsTime(value: string, params: Record<string, string> = {}): { ms: number; allDay: boolean } | null {
  const v = value.trim()
  const date = DATE_RE.exec(v)
  if (date || params.VALUE === 'DATE') {
    const m = date ?? DATE_RE.exec(v.slice(0, 8))
    if (!m) return null
    return { ms: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime(), allDay: true }
  }
  const m = DATETIME_RE.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '00'].map(Number)
  if (m[7] === 'Z') return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false }
  if (params.TZID) {
    try { return { ms: zonedToEpoch(y, mo, d, h, mi, s, params.TZID), allDay: false } } catch { /* unknown zone: read as local time */ }
  }
  return { ms: new Date(y, mo - 1, d, h, mi, s).getTime(), allDay: false }
}

/** PT1H30M, P1D, P1W and so on, to milliseconds. */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim())
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const n = (x?: string) => (x ? Number(x) : 0)
  const ms = ((n(m[2]) * 7 + n(m[3])) * 86400 + n(m[4]) * 3600 + n(m[5]) * 60 + n(m[6])) * 1000
  return sign * ms
}

export interface ParsedFile {
  events: CalEvent[]
  /** Events that were present but could not be read. The rest of the file still loads. */
  skipped: number
}

/** Every VEVENT in a calendar file. Cancelled events are left out. */
export function parseIcs(text: string): ParsedFile {
  const lines = unfold(text)
  const events: CalEvent[] = []
  let skipped = 0
  let cur: Line[] | null = null
  for (const raw of lines) {
    const line = parseLine(raw)
    if (!line) continue
    if (line.name === 'BEGIN' && line.value.toUpperCase() === 'VEVENT') { cur = []; continue }
    if (line.name === 'END' && line.value.toUpperCase() === 'VEVENT') {
      if (cur) {
        const ev = eventFromLines(cur)
        if (ev === 'cancelled') { /* left out on purpose */ } else if (ev) events.push(ev); else skipped++
      }
      cur = null
      continue
    }
    if (cur) cur.push(line)
  }
  return { events, skipped }
}

function eventFromLines(lines: Line[]): CalEvent | 'cancelled' | null {
  const get = (name: string) => lines.find((l) => l.name === name)
  if (get('STATUS')?.value.toUpperCase() === 'CANCELLED') return 'cancelled'
  const dtStart = get('DTSTART')
  if (!dtStart) return null
  const start = parseIcsTime(dtStart.value, dtStart.params)
  if (!start) return null
  let end: number | null = null
  const dtEnd = get('DTEND')
  if (dtEnd) end = parseIcsTime(dtEnd.value, dtEnd.params)?.ms ?? null
  if (end === null) {
    const dur = get('DURATION') ? parseDuration(get('DURATION')!.value) : null
    end = start.ms + (dur ?? (start.allDay ? 86400000 : 0))
  }
  const uid = get('UID')?.value ?? undefined
  const rrule = get('RRULE')?.value ?? undefined
  return {
    id: uid ? `ics_${uid}` : `ics_${start.ms}_${Math.random().toString(36).slice(2, 8)}`,
    title: unescapeText(get('SUMMARY')?.value ?? '(no title)'),
    start: start.ms,
    end: Math.max(end, start.ms),
    allDay: start.allDay,
    location: get('LOCATION') ? unescapeText(get('LOCATION')!.value) : undefined,
    notes: get('DESCRIPTION') ? unescapeText(get('DESCRIPTION')!.value) : undefined,
    rrule,
    uid,
  }
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
/** Upper bound on steps through a rule: about 110 years of daily occurrences. */
const MAX_ITERATIONS = 40000

export interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: number
  byDay?: number[]
}

export function parseRrule(rrule: string): Rule | null {
  const map: Record<string, string> = {}
  for (const part of rrule.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) map[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).toUpperCase()
  }
  const freq = map.FREQ as Rule['freq']
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null
  const rule: Rule = { freq, interval: Math.max(1, Number(map.INTERVAL) || 1) }
  if (map.COUNT) rule.count = Number(map.COUNT)
  if (map.UNTIL) rule.until = parseIcsTime(map.UNTIL)?.ms
  if (map.BYDAY) {
    rule.byDay = map.BYDAY.split(',')
      .map((d) => DAYS.indexOf(d.replace(/^[+-]?\d*/, '')))
      .filter((d) => d >= 0)
  }
  return rule
}

/**
 * Start times of one recurring event that fall inside [from, to). Times are
 * taken in the viewer's local zone, which is right for everything made in this
 * app and close for imported events; the limit is noted in the README.
 */
export function occurrences(ev: CalEvent, from: number, to: number): CalEvent[] {
  if (!ev.rrule) return ev.end > from && ev.start < to ? [ev] : []
  const rule = parseRrule(ev.rrule)
  if (!rule) return ev.end > from && ev.start < to ? [ev] : []
  const span = ev.end - ev.start
  const base = new Date(ev.start)
  const out: CalEvent[] = []
  let n = 0
  let iter = 0
  const keep = (ms: number): 'stop' | 'more' => {
    if (ms < ev.start) return 'more'
    if (rule.until !== undefined && ms > rule.until) return 'stop'
    if (rule.count !== undefined && n >= rule.count) return 'stop'
    if (ms >= to) return 'stop'
    if (++iter > MAX_ITERATIONS) return 'stop'
    n++
    if (ms + span > from) out.push({ ...ev, id: `${ev.id}@${ms}`, start: ms, end: ms + span, rrule: undefined })
    return 'more'
  }
  const at = (y: number, mo: number, d: number) =>
    new Date(y, mo, d, base.getHours(), base.getMinutes(), base.getSeconds()).getTime()

  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i += rule.interval) {
      if (keep(at(base.getFullYear(), base.getMonth(), base.getDate() + i)) === 'stop') break
    }
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byDay?.length ? [...rule.byDay].sort((a, b) => a - b) : [base.getDay()]
    const weekStart = base.getDate() - base.getDay()
    let done = false
    for (let w = 0; !done; w += rule.interval) {
      for (const dow of days) {
        if (keep(at(base.getFullYear(), base.getMonth(), weekStart + w * 7 + dow)) === 'stop') { done = true; break }
      }
      if (iter > MAX_ITERATIONS) break
    }
  } else {
    const step = rule.freq === 'MONTHLY' ? 1 : 12
    for (let i = 0; ; i += rule.interval) {
      const date = new Date(base.getFullYear(), base.getMonth() + i * step, base.getDate(), base.getHours(), base.getMinutes(), base.getSeconds())
      if (date.getDate() !== base.getDate()) { if (i > MAX_ITERATIONS) break; continue } // a month without this day is skipped, as RFC 5545 says
      if (keep(date.getTime()) === 'stop') break
    }
  }
  return out
}

/** Calendar file text for a list of events. All-day events stay all-day; the rest are written in UTC. */
export function toIcs(events: CalEvent[], name = 'Research Engine'): string {
  const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const day = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Research Engine//Calendar//EN', `X-WR-CALNAME:${escapeText(name)}`, 'CALSCALE:GREGORIAN']
  const stamp = utc(Date.now())
  for (const ev of events) {
    const uid = `${(ev.uid ?? ev.id).replace(/[^A-Za-z0-9@._-]/g, '')}@researchengine`
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`)
    if (ev.allDay) lines.push(`DTSTART;VALUE=DATE:${day(ev.start)}`, `DTEND;VALUE=DATE:${day(ev.end > ev.start ? ev.end : ev.start + 86400000)}`)
    else lines.push(`DTSTART:${utc(ev.start)}`, `DTEND:${utc(Math.max(ev.end, ev.start))}`)
    lines.push(`SUMMARY:${escapeText(ev.title)}`)
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`)
    if (ev.notes) lines.push(`DESCRIPTION:${escapeText(ev.notes)}`)
    if (ev.rrule) lines.push(`RRULE:${ev.rrule}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map((l) => (l.length > 74 ? l.slice(0, 74) + '\r\n ' + l.slice(74) : l)).join('\r\n') + '\r\n'
}
