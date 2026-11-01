/**
 * From one tool call to one card.
 *
 * `resolveSpec` picks the catalog entry (a connected app's action is matched by
 * its name prefix and verb; anything else by tool name). `buildCardPayload`
 * reads the result through the extractor and returns a small payload. It never
 * returns the raw output, so nothing unclipped is stored or drawn.
 */
import { APPS, BUILTIN_TOOL_SPEC, SPEC_BY_ID, type AppDef, type CardSpec } from './catalog'
import {
  findResultArray, fieldsFrom, itemFrom, linesOf, totalOf, clip,
} from './extract'
import {
  MAX_CARD_ITEMS, type CardField, type CardItem, type CardKind, type CardPayload,
} from './types'

/** Verb → kind, checked in this order. The first match wins, so the verb beats the noun (UPDATE_MESSAGE is an update). */
const VERBS: Array<[RegExp, CardKind]> = [
  [/DELETE|REMOVE|TRASH|ARCHIVE|CANCEL|UNSUBSCRIBE|DESTROY/, 'delete'],
  [/CREATE|ADD|NEW|START|UPLOAD|INSERT|CLONE|DUPLICATE|BOOK|SCHEDULE/, 'create'],
  [/UPDATE|EDIT|PATCH|SET|MOVE|RENAME|ASSIGN|CLOSE|COMPLETE|MARK|LABEL|RESCHEDULE|REPLACE|TRANSITION/, 'update'],
  [/SEND|POST|REPLY|PUBLISH|SHARE|COMMENT|MESSAGE|DRAFT|FORWARD|TWEET|INVITE/, 'send'],
  [/SEARCH|FIND|QUERY|LOOKUP|FILTER|MATCH/, 'search'],
  [/LIST|FETCH|GET_ALL|GET_MANY|RETRIEVE_ALL|BROWSE|RECENT/, 'list'],
  [/GET|READ|VIEW|DETAIL|OPEN|INFO|PROFILE|STATUS|METADATA/, 'read'],
]

/** Apps by prefix, longest first, so `MICROSOFT_TEAMS_…` is not read as another app. */
const APP_PREFIXES = [...APPS]
  .sort((a, b) => b.id.length - a.id.length)
  .map((a) => ({ app: a, prefix: a.id.toUpperCase().replace(/-/g, '_') + '_' }))

export function kindOfVerb(rest: string): CardKind {
  for (const [re, kind] of VERBS) if (re.test(rest)) return kind
  return 'read'
}

export interface ResolvedSpec {
  spec: CardSpec
  /** The connected app, when the call was an app action. */
  app?: AppDef
  action?: string
}

/**
 * The card for one tool call. Connected-app actions (`composio_run` with a name
 * like `SPOTIFY_SEARCH_TRACKS`) resolve to that app's card for the action's kind.
 * Unknown apps still get a generic card, labelled with the prefix.
 */
export function resolveSpec(tool: string, args: Record<string, unknown> = {}): ResolvedSpec {
  if (tool === 'composio_run') {
    const action = String(args.tool ?? '').trim().toUpperCase()
    const hit = APP_PREFIXES.find((p) => action.startsWith(p.prefix))
    if (hit) {
      const kind = kindOfVerb(action.slice(hit.prefix.length))
      const spec = SPEC_BY_ID[`${hit.app.id}.${kind}`]
      return { spec, app: hit.app, action }
    }
    const word = action.split('_')[0] || 'App'
    const spec: CardSpec = {
      id: 'composio.generic', appId: 'composio', appName: word.charAt(0) + word.slice(1).toLowerCase(),
      accent: '#7C3AED', icon: 'plug', family: 'generic', kind: 'read',
      headline: 'Connected app result', summary: 'The result of the action.',
    }
    return { spec, action }
  }
  const builtin = BUILTIN_TOOL_SPEC[tool]
  if (builtin) return { spec: builtin }
  const spec: CardSpec = {
    id: 'tool.generic', appId: tool, appName: 'Tool', accent: '#64748B', icon: 'package',
    family: 'generic', kind: 'read', headline: tool.replace(/_/g, ' '), summary: 'The result of the tool.',
  }
  return { spec }
}

const ERROR_TEXT = /^(The action failed|Tool .* failed|Unknown tool|Composio is not|BLOCKED|This tool needs|.* is not set up|The arguments must|Only https|Not allowed|Couldn't|Could not)/i

/** Whether the tool's text reads like a failure rather than an answer. */
export function looksFailed(text: string): boolean {
  return ERROR_TEXT.test(text.trim().slice(0, 160))
}

function parseJson(text: string): unknown {
  const t = text.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return undefined
  try { return JSON.parse(t) } catch { return undefined }
}

/** Web sources: `{ sources: [{title,url,snippet}] }` from web_search. */
function webItems(data: unknown): CardItem[] | undefined {
  if (!data || typeof data !== 'object' || !Array.isArray((data as any).sources)) return undefined
  const out: CardItem[] = []
  for (const s of (data as any).sources as any[]) {
    if (!s || typeof s !== 'object') continue
    const title = clip(s.title ?? s.url ?? '', 120)
    if (!title) continue
    const item: CardItem = { title }
    let host = ''
    try { host = new URL(String(s.url)).hostname.replace(/^www\./, '') } catch { /* not a link */ }
    if (host) item.subtitle = host
    if (typeof s.snippet === 'string' && s.snippet.trim()) item.meta = clip(s.snippet, 140)
    if (typeof s.url === 'string' && /^https:\/\//.test(s.url)) item.href = s.url
    out.push(item)
    if (out.length >= MAX_CARD_ITEMS) break
  }
  return out
}

export interface CardInput {
  tool: string
  args?: Record<string, unknown>
  /** The text the model received. */
  text: string
  /** The structured result, when the tool had one. Otherwise the JSON in `text` is read. */
  data?: unknown
  ok?: boolean
  now?: number
}

/**
 * Build the card for one finished tool call. Returns null only when there is
 * nothing to show (a tool that replied with an empty answer).
 */
export function buildCardPayload(input: CardInput): CardPayload | null {
  const args = input.args ?? {}
  const { spec, app, action } = resolveSpec(input.tool, args)
  const text = input.text ?? ''
  const failed = input.ok === false || looksFailed(text)
  const now = input.now ?? Date.now()
  const base = {
    specId: spec.id,
    family: spec.family,
    kind: spec.kind,
    tool: input.tool,
    action,
    appId: app?.id ?? spec.appId,
    appName: app?.name ?? spec.appName,
    accent: spec.accent,
    icon: spec.icon,
    createdAt: now,
  }

  if (failed) {
    return {
      ...base,
      family: 'generic',
      headline: `Could not finish: ${base.appName}`,
      summary: clip(text.replace(/^[^:]*:\s*/, '') || 'The action did not complete.', 220),
      status: 'error',
      items: [],
      fields: [],
    }
  }

  const data = input.data !== undefined ? input.data : parseJson(text)
  let items: CardItem[] = []
  let fields: CardField[] = []
  let total: number | undefined

  const web = input.tool === 'web_search' ? webItems(data) : undefined
  if (web) {
    items = web
    total = web.length
  } else if (data !== undefined && data !== null) {
    const arr = findResultArray(data)
    if (arr) {
      items = arr.map(itemFrom).filter((x): x is CardItem => !!x).slice(0, MAX_CARD_ITEMS)
      total = totalOf(data) ?? arr.length
    } else if (typeof data === 'object' && !Array.isArray(data)) {
      const single = itemFrom(data as Record<string, unknown>)
      if (single) items = [single]
      fields = fieldsFrom(data as Record<string, unknown>, new Set(single ? ['name', 'title', 'subject'] : []))
    }
  } else if (text.trim()) {
    items = linesOf(text)
  }

  // The best of the lot is the first item; a read or receipt shows its fields.
  const kind = spec.kind
  const wantsFields = kind === 'read' || kind === 'create' || kind === 'update' || kind === 'delete' || kind === 'send' || spec.family === 'metric'
  if (!wantsFields) fields = []
  const status: CardPayload['status'] = items.length || fields.length || (kind !== 'search' && kind !== 'list' && text.trim()) ? 'ok' : 'empty'

  let summary: string
  if (status === 'empty') summary = 'Nothing matched.'
  else if (items.length && (kind === 'search' || kind === 'list')) {
    const n = total ?? items.length
    summary = `${n} ${n === 1 ? 'result' : 'results'}. Best: ${items[0].title}`
  } else if (items.length) summary = items[0].title
  else if (fields.length) summary = fields.slice(0, 2).map((f) => `${f.label}: ${f.value}`).join(' · ')
  else summary = spec.summary

  return {
    ...base,
    headline: spec.headline,
    summary: clip(summary, 220),
    status,
    items,
    fields,
    total,
  }
}
