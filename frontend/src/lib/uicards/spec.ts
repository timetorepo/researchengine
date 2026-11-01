/**
 * Interactive cards the model can write into an answer.
 *
 * The model writes a fenced block tagged `ui-card` containing one JSON object.
 * The chat turns it into a card with real controls (tabs, sliders, choice
 * buttons, bars, timelines), the way Google's AI Mode answers a question with
 * an explorable widget rather than a wall of text.
 *
 * Nothing here runs model code. The JSON is only data: this module checks every
 * field, drops what it does not recognise, clips every string, caps every list,
 * and refuses any link that is not https. The renderer then draws the result
 * with React, which escapes text, so a card can never inject markup or script.
 *
 * A block that does not parse falls back to a plain code block, so a bad card
 * never hides the answer around it.
 */

export const UI_CARD_LANG = 'ui-card'

export const UI_CARD_LIMITS = {
  blocks: 10,
  text: 600,
  label: 80,
  items: 12,
  tabs: 5,
  options: 6,
  bars: 8,
  title: 120,
} as const

export type UiBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'stats'; items: Array<{ label: string; value: string; hint?: string }> }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'bars'; title?: string; unit?: string; items: Array<{ label: string; value: number }> }
  | { type: 'tabs'; tabs: Array<{ label: string; text: string }> }
  | { type: 'choice'; prompt?: string; options: Array<{ label: string; reply?: string }> }
  | { type: 'slider'; label: string; min: number; max: number; step: number; value: number; unit?: string; note?: string }
  | { type: 'timeline'; items: Array<{ when: string; title: string; text?: string }> }
  | { type: 'link'; label: string; href: string }
  | { type: 'ask'; label: string; prompt: string }

export interface UiCardSpec {
  title?: string
  summary?: string
  blocks: UiBlock[]
}

export type UiCardResult = { ok: true; card: UiCardSpec } | { ok: false; error: string }

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A string, trimmed and clipped. Control characters are removed so nothing odd reaches the screen. */
function str(v: unknown, max: number = UI_CARD_LIMITS.text): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
  if (!s) return null
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function num(v: unknown, fallback?: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (Number.isFinite(n)) return n
  return fallback ?? null
}

function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : []
}

/** Only https links are kept. Anything else (http, javascript:, data:) is dropped. */
export function safeHttps(v: unknown): string | null {
  const s = str(v, 2048)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function parseBlock(raw: unknown): UiBlock | null {
  if (!isRec(raw)) return null
  switch (raw.type) {
    case 'heading': {
      const text = str(raw.text, UI_CARD_LIMITS.title)
      return text ? { type: 'heading', text } : null
    }
    case 'text': {
      const text = str(raw.text)
      return text ? { type: 'text', text } : null
    }
    case 'stats': {
      const items = arr(raw.items, 6).flatMap((i) => {
        if (!isRec(i)) return []
        const label = str(i.label, UI_CARD_LIMITS.label)
        const value = str(i.value, 40)
        if (!label || !value) return []
        return [{ label, value, hint: str(i.hint, UI_CARD_LIMITS.label) ?? undefined }]
      })
      return items.length ? { type: 'stats', items } : null
    }
    case 'list': {
      const items = arr(raw.items, UI_CARD_LIMITS.items).map((i) => str(i)).filter((s): s is string => !!s)
      return items.length ? { type: 'list', items, ordered: raw.ordered === true } : null
    }
    case 'bars': {
      const items = arr(raw.items, UI_CARD_LIMITS.bars).flatMap((i) => {
        if (!isRec(i)) return []
        const label = str(i.label, UI_CARD_LIMITS.label)
        const value = num(i.value)
        if (!label || value === null || value < 0) return []
        return [{ label, value }]
      })
      if (!items.length) return null
      return { type: 'bars', title: str(raw.title, UI_CARD_LIMITS.label) ?? undefined, unit: str(raw.unit, 12) ?? undefined, items }
    }
    case 'tabs': {
      const tabs = arr(raw.tabs, UI_CARD_LIMITS.tabs).flatMap((t) => {
        if (!isRec(t)) return []
        const label = str(t.label, UI_CARD_LIMITS.label)
        const text = str(t.text)
        return label && text ? [{ label, text }] : []
      })
      return tabs.length >= 2 ? { type: 'tabs', tabs } : null
    }
    case 'choice': {
      const options = arr(raw.options, UI_CARD_LIMITS.options).flatMap((o) => {
        if (!isRec(o)) return []
        const label = str(o.label, UI_CARD_LIMITS.label)
        return label ? [{ label, reply: str(o.reply) ?? undefined }] : []
      })
      return options.length >= 2 ? { type: 'choice', prompt: str(raw.prompt) ?? undefined, options } : null
    }
    case 'slider': {
      const label = str(raw.label, UI_CARD_LIMITS.label)
      const min = num(raw.min, 0)
      const max = num(raw.max, 100)
      if (!label || min === null || max === null || max <= min) return null
      const step = Math.max(num(raw.step, 1) ?? 1, (max - min) / 1000)
      const value = Math.min(max, Math.max(min, num(raw.value, min) ?? min))
      return {
        type: 'slider', label, min, max, step, value,
        unit: str(raw.unit, 12) ?? undefined,
        note: str(raw.note) ?? undefined,
      }
    }
    case 'timeline': {
      const items = arr(raw.items, UI_CARD_LIMITS.items).flatMap((i) => {
        if (!isRec(i)) return []
        const when = str(i.when, UI_CARD_LIMITS.label)
        const title = str(i.title, UI_CARD_LIMITS.label)
        return when && title ? [{ when, title, text: str(i.text) ?? undefined }] : []
      })
      return items.length ? { type: 'timeline', items } : null
    }
    case 'link': {
      const label = str(raw.label, UI_CARD_LIMITS.label)
      const href = safeHttps(raw.href)
      return label && href ? { type: 'link', label, href } : null
    }
    case 'ask': {
      const label = str(raw.label, UI_CARD_LIMITS.label)
      const prompt = str(raw.prompt)
      return label && prompt ? { type: 'ask', label, prompt } : null
    }
    default:
      return null
  }
}

/** Parse the text of a `ui-card` block. Never throws. */
export function parseUiCard(source: string): UiCardResult {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return { ok: false, error: 'not valid JSON' }
  }
  if (!isRec(data)) return { ok: false, error: 'expected one JSON object' }
  const blocks = arr(data.blocks, UI_CARD_LIMITS.blocks).map(parseBlock).filter((b): b is UiBlock => !!b)
  if (!blocks.length) return { ok: false, error: 'no usable blocks' }
  return {
    ok: true,
    card: {
      title: str(data.title, UI_CARD_LIMITS.title) ?? undefined,
      summary: str(data.summary) ?? undefined,
      blocks,
    },
  }
}

/**
 * What the model is told about the format. Short on purpose: it is paid for on
 * every turn, so it only has to be clear, not complete.
 */
export const UI_CARD_PROMPT = `# Interactive cards
When an answer is clearer as something to explore (a comparison, a calculation the user can tune, a timeline, a set of options), add ONE fenced block tagged ui-card containing a single JSON object:
{"title":"…","summary":"one line","blocks":[ … ]}
Block types (use only these):
- {"type":"heading","text":"…"}
- {"type":"text","text":"…"}
- {"type":"stats","items":[{"label":"…","value":"…","hint":"…"}]}   (up to 6)
- {"type":"list","items":["…"],"ordered":false}
- {"type":"bars","title":"…","unit":"…","items":[{"label":"…","value":12}]}
- {"type":"tabs","tabs":[{"label":"…","text":"…"}]}   (2–5 tabs)
- {"type":"choice","prompt":"…","options":[{"label":"…","reply":"what to ask next"}]}
- {"type":"slider","label":"…","min":0,"max":100,"step":1,"value":50,"unit":"…","note":"…"}
- {"type":"timeline","items":[{"when":"…","title":"…","text":"…"}]}
- {"type":"link","label":"…","href":"https://…"}
- {"type":"ask","label":"…","prompt":"a follow-up question to send"}
Rules: at most 10 blocks; plain text only (no markdown inside the JSON strings); no invented numbers (use only figures you have from the conversation or sources); keep the surrounding prose complete so the card is a bonus, not the answer.`
