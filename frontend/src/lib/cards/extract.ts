/**
 * Turns a tool's raw output into card content, safely.
 *
 * Connected apps answer with different shapes (Spotify nests tracks under
 * `tracks.items`, Gmail under `messages`, GitHub returns a bare array). Rather
 * than write a parser for each one, this reads a fixed set of likely keys, in
 * order, and clips everything. Anything it does not recognise is left out, so a
 * card never shows a raw dump. Secret-looking keys are never read.
 */
import type { CardField, CardItem } from './types'
import { MAX_CARD_FIELDS, MAX_CARD_ITEMS, MAX_CARD_TEXT } from './types'

type Json = unknown
type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Keys whose values must never reach a card. */
const SECRET_KEY = /token|secret|password|passwd|api[_-]?key|auth|cookie|session|credential|private|signature/i

export function clip(v: unknown, max = MAX_CARD_TEXT): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

/** Follows a dotted path; a numeric segment reads an array index. */
export function pick(o: unknown, path: string): unknown {
  let cur: unknown = o
  for (const seg of path.split('.')) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const i = Number(seg)
      if (!Number.isInteger(i)) return undefined
      cur = cur[i]
    } else if (isObj(cur)) {
      cur = cur[seg]
    } else return undefined
  }
  return cur
}

/** The first candidate path that holds a non-empty value, as clipped text. */
function firstText(o: Obj, paths: readonly string[], max = MAX_CARD_TEXT): string | undefined {
  for (const p of paths) {
    const v = pick(o, p)
    if (typeof v === 'string' && v.trim()) return clip(v, max)
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (Array.isArray(v) && v.length) {
      const names = v
        .map((x) => (typeof x === 'string' ? x : isObj(x) ? (x.name ?? x.email ?? x.displayName ?? x.title) : undefined))
        .filter((x): x is string => typeof x === 'string' && !!x.trim())
      if (names.length) return clip(names.slice(0, 3).join(', '), max)
    }
  }
  return undefined
}

function firstUrl(o: Obj, paths: readonly string[]): string | undefined {
  for (const p of paths) {
    const v = pick(o, p)
    if (typeof v === 'string' && /^https:\/\/[^\s]+$/i.test(v.trim()) && v.length < 1000) return v.trim()
  }
  return undefined
}

const TITLE = ['name', 'title', 'subject', 'displayName', 'full_name', 'fullName', 'filename', 'file_name', 'track.name', 'summary', 'headline', 'label', 'text', 'snippet']
const SUB = ['artists', 'artist', 'album.name', 'from', 'sender', 'from.name', 'from.email', 'author', 'user.name', 'owner.login', 'owner.name', 'organizer.email', 'creator.email', 'attendees.0.email', 'assignee.name', 'channel', 'status', 'state', 'description', 'snippet', 'body']
const META = ['date', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'internalDate', 'start.dateTime', 'start.date', 'start', 'due', 'due_date', 'dueDate', 'published_at', 'publishedAt', 'timestamp', 'time', 'modifiedTime', 'createdTime']
const IMAGE = ['album.images.0.url', 'images.0.url', 'image.url', 'image', 'imageUrl', 'image_url', 'thumbnail', 'thumbnailUrl', 'thumbnail_url', 'avatar_url', 'avatarUrl', 'avatar', 'picture', 'cover', 'artwork', 'thumbnailLink', 'media.0.url']
const HREF = ['external_urls.spotify', 'html_url', 'htmlUrl', 'webViewLink', 'alternateLink', 'htmlLink', 'permalink', 'web_url', 'webUrl', 'url', 'link', 'href']

/** Milliseconds → m:ss, or h:mm:ss. */
export function durationLabel(ms: unknown): string | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Pretty date for a card: "12 Oct, 14:05" in the person's locale. */
export function dateLabel(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v
    return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return clip(v, 40)
  }
  return undefined
}

/** A card row from one object. Returns null when there is no usable title. */
export function itemFrom(o: Obj): CardItem | null {
  const title = firstText(o, TITLE, 120)
  if (!title) return null
  const item: CardItem = { title }
  const sub = firstText(o, SUB, 120)
  if (sub && sub !== title) item.subtitle = sub
  const dur = durationLabel(pick(o, 'duration_ms') ?? pick(o, 'durationMs'))
  if (dur) item.meta = dur
  else {
    for (const p of META) {
      const d = dateLabel(pick(o, p))
      if (d) { item.meta = d; break }
    }
  }
  const image = firstUrl(o, IMAGE)
  if (image) item.image = image
  const href = firstUrl(o, HREF)
  if (href) item.href = href
  return item
}

/** Arrays of objects that are likely to be the results, in priority order. */
const RESULT_KEYS = ['items', 'results', 'data', 'tracks', 'albums', 'artists', 'messages', 'emails', 'threads', 'events', 'files', 'issues', 'pull_requests', 'repos', 'repositories', 'pages', 'records', 'contacts', 'deals', 'companies', 'tasks', 'cards', 'projects', 'orders', 'products', 'channels', 'posts', 'videos', 'value', 'list', 'sources', 'hits', 'docs', 'rows']

/** Finds the list of results in a payload: a top-level array, or a known key nested up to a few levels down. */
export function findResultArray(data: Json, depth = 0): Obj[] | undefined {
  if (depth > 4) return undefined
  if (Array.isArray(data)) {
    const objs = data.filter(isObj)
    if (objs.length) return objs
    return undefined
  }
  if (!isObj(data)) return undefined
  for (const k of RESULT_KEYS) {
    if (k in data) {
      const hit = findResultArray(data[k], depth + 1)
      if (hit) return hit
    }
  }
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_KEY.test(k) || RESULT_KEYS.includes(k)) continue
    const hit = findResultArray(v, depth + 1)
    if (hit) return hit
  }
  return undefined
}

/** A total count the source reported, if there is one (also inside a result container, e.g. `tracks.total`). */
export function totalOf(data: Json, depth = 0): number | undefined {
  if (!isObj(data) || depth > 2) return undefined
  for (const k of ['total', 'totalCount', 'total_count', 'count', 'totalResults', 'resultSizeEstimate']) {
    const v = data[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  for (const k of RESULT_KEYS) {
    if (isObj(data[k])) {
      const hit = totalOf(data[k], depth + 1)
      if (hit !== undefined) return hit
    }
  }
  return undefined
}

/** A short humanised label for a key: `publishedAt` → "Published at". */
export function labelOf(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Up to MAX_CARD_FIELDS scalar facts from one object, skipping ids, secrets,
 * links and anything nested. Used for detail cards and receipts.
 */
export function fieldsFrom(o: Obj, skip: ReadonlySet<string> = new Set()): CardField[] {
  const out: CardField[] = []
  for (const [k, v] of Object.entries(o)) {
    if (out.length >= MAX_CARD_FIELDS) break
    if (skip.has(k) || SECRET_KEY.test(k) || /^(id|_id|uuid|etag|kind|url|href|link|html|image|avatar|thumbnail|picture|cover|icon|logo|self)/i.test(k) || /url|link|token|id$/i.test(k)) continue
    if (typeof v === 'string' && v.trim()) {
      if (/^https?:\/\//i.test(v) || v.length > 400) continue
      out.push({ label: labelOf(k), value: clip(v, 120) })
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out.push({ label: labelOf(k), value: String(v) })
    } else if (typeof v === 'boolean') {
      out.push({ label: labelOf(k), value: v ? 'Yes' : 'No' })
    }
  }
  return out
}

/** Plain text lines from a non-JSON tool result, for cards that cannot find structure. */
export function linesOf(text: string, max = MAX_CARD_ITEMS): CardItem[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•#>\d.)]+/, '').trim())
    .filter((l) => l.length > 3 && !/^[{}\[\],"]+$/.test(l))
    .slice(0, max)
    .map((l) => ({ title: clip(l, 120) }))
}
