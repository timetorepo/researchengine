/**
 * Study-text tidying — the website's job, not the model's.
 *
 * Models write step-by-step material in a dozen near-markdown dialects:
 *
 *     1. Collect the samples
 *
 *     :dot: label each tube
 *     :dot: keep them on ice
 *
 * …and text like that, rendered as-is, reads as a wall instead of a list.
 * Everything here runs locally at render time: no second AI call, no network,
 * no waiting. It normalises the *shape* of the text and leaves the words alone —
 * `normalizeStepText` only adds markers, moves line breaks and renumbers items;
 * it never rewrites, summarises or drops prose.
 */

/** A glyph a model might use where a bullet belongs. */
const BULLET_MARKER = '[\\u2022\\u25CF\\u25CB\\u25AA\\u25AB\\u2023\\u2043\\u2219\\u00B7\\u25B8\\u25B9\\u2192\\u2794\\u203A\\u27A4\\u00BB\\u2713\\u2714\\u2610\\u2611\\u2765\\u25E6\\u25A0\\u25A1\\u2B1B\\u2B1C\\u2666\\u25C6\\u00B0]'
const DOT_TOKEN = '[:\\uFF1A]?\\s*dot\\s*[:\\uFF1A]?'
const BULLET_RE = new RegExp(`^(?:${DOT_TOKEN}|${BULLET_MARKER}|[-*+])\\s+`, 'i')
/** "1.", "1)", "(1)", "1:", "1 -", "1 —", "Step 1:", "Step 1." */
const ORDERED_RE = /^(?:step\s+)?\(?(\d{1,3})\)?\s*(?:[.\]:]|[-–—])?\s+(?=\S)/i
const HEADING_RE = /^(#{1,6})\s+(.+)$/
const QUOTE_RE = /^>\s?/
const FENCE_RE = /^\s*(?:```|~~~)/
const TABLE_RE = /^\s*\|/
/** Marker sitting mid-line — "…first :dot: then…" becomes a real list break. */
const INLINE_DOT_RE = new RegExp(`\\s(?:${DOT_TOKEN})\\s+`, 'gi')

export interface StudyItem { text: string; depth: number }

export interface StudyBlock {
  kind: 'heading' | 'paragraph' | 'bullets' | 'steps' | 'quote' | 'code' | 'table'
  /** Heading depth 1-6 (heading), or the list's first number (steps). */
  level?: number
  start?: number
  /** heading / paragraph / quote / code / table */
  text?: string
  /** bullets / steps — `depth` > 0 is nested under the item above. */
  items?: StudyItem[]
}

const isBlank = (l: string) => !l.trim()
const indentOf = (l: string) => (l.match(/^[ \t]*/) ?? [''])[0].replace(/\t/g, '  ').length
const matchBullet = (line: string) => BULLET_RE.exec(line.trimStart())
const matchOrdered = (line: string) => ORDERED_RE.exec(line.trimStart())

/**
 * Rewrite the dialect into clean markdown:
 *   · `:dot:` (and every other bullet glyph) becomes `- `
 *   · marked lines separated by blank lines are pulled into one list
 *   · `Step 3 —` becomes `3. `, and repeated numbers renumber 1, 2, 3…
 *   · bullets that follow a numbered step nest under it
 *   · continuation lines are folded into the item they belong to
 */
export function normalizeStepText(input: string): string {
  if (!input) return ''
  const src = String(input).replace(/\r\n?/g, '\n').replace(INLINE_DOT_RE, ' \n- ')
  const lines = src.split('\n')
  const out: string[] = []
  let inFence = false
  let run: 'bullets' | 'steps' | null = null
  let nextNumber = 1
  let pendingBlank = false

  const blankBeforeList = () => {
    if (out.length && !isBlank(out[out.length - 1])) out.push('')
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+$/, '')

    if (FENCE_RE.test(line)) {
      inFence = !inFence
      run = null
      if (pendingBlank) blankBeforeList()
      pendingBlank = false
      out.push(line)
      continue
    }
    if (inFence) { out.push(line); continue }

    if (isBlank(line)) { pendingBlank = true; continue }

    const bullet = matchBullet(line)
    if (bullet) {
      const text = line.trimStart().replace(BULLET_RE, '').trim()
      if (run === 'steps') {
        // A bullet inside a numbered run is detail for the step above it.
        out.push(`  - ${text}`)
      } else {
        if (run !== 'bullets') { blankBeforeList(); run = 'bullets' }
        const depth = indentOf(line) >= 2 ? 2 : 0
        out.push(`${' '.repeat(depth)}- ${text}`)
      }
      pendingBlank = false
      continue
    }

    const ordered = matchOrdered(line)
    if (ordered) {
      const text = line.trimStart().replace(ORDERED_RE, '').trim()
      if (run !== 'steps') {
        blankBeforeList()
        run = 'steps'
        // Honour the author's first number, then count on from it.
        nextNumber = Number(ordered[1]) || 1
      }
      out.push(`${nextNumber}. ${text}`)
      nextNumber++
      pendingBlank = false
      continue
    }

    // Wrapped or indented continuation of the item above.
    if (run && /^\s{2,}\S/.test(line) && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${line.trim()}`
      pendingBlank = false
      continue
    }

    run = null
    if (pendingBlank) blankBeforeList()
    pendingBlank = false
    out.push(line)
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(#{1,6} .+)\n\n/gm, '$1\n')
    .trim()
}

/**
 * Split normalised text into blocks the reader can render with real list
 * markup. Headings, quotes, fences and tables pass through untouched.
 */
export function toStudyBlocks(input: string): StudyBlock[] {
  const text = normalizeStepText(input)
  if (!text) return []
  const lines = text.split('\n')
  const blocks: StudyBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    if (FENCE_RE.test(line)) {
      const body: string[] = []
      const fence = line.trimStart().slice(0, 3)
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(fence)) body.push(lines[i++])
      i++
      blocks.push({ kind: 'code', text: body.join('\n') })
      continue
    }

    const h = HEADING_RE.exec(line)
    if (h) { blocks.push({ kind: 'heading', level: h[1].length, text: h[2].trim() }); i++; continue }

    if (TABLE_RE.test(line)) {
      const body: string[] = []
      while (i < lines.length && TABLE_RE.test(lines[i])) body.push(lines[i++])
      blocks.push({ kind: 'table', text: body.join('\n') })
      continue
    }

    // One list run: the kind comes from the first marker in it, so bullets that
    // follow a numbered step stay with it as nested detail.
    if (matchBullet(line) || matchOrdered(line)) {
      const ordered = !!matchOrdered(line)
      const items: StudyItem[] = []
      let start = 1
      while (i < lines.length && !isBlank(lines[i])) {
        const l = lines[i]
        const ob = matchBullet(l)
        const oo = matchOrdered(l)
        if (!ob && !oo) {
          if (items.length && /^\s{2,}\S/.test(l)) { items[items.length - 1].text += ` ${l.trim()}`; i++; continue }
          break
        }
        if (oo) {
          items.push({ text: l.trimStart().replace(ORDERED_RE, '').trim(), depth: indentOf(l) >= 2 ? 1 : 0 })
          if (items.length === 1) start = Number(oo[1]) || 1
        } else {
          const rawDepth = Math.max(0, Math.floor(indentOf(l) / 2))
          items.push({ text: l.trimStart().replace(BULLET_RE, '').trim(), depth: ordered ? Math.min(1, Math.max(1, rawDepth)) : Math.min(2, rawDepth) })
        }
        i++
      }
      blocks.push(ordered
        ? { kind: 'steps', start, items }
        : { kind: 'bullets', items: items.map((it) => ({ ...it, depth: Math.min(2, it.depth) })) })
      continue
    }

    const para: string[] = []
    while (i < lines.length && !isBlank(lines[i]) && !matchBullet(lines[i]) && !matchOrdered(lines[i]) && !HEADING_RE.test(lines[i])) {
      para.push(lines[i]); i++
    }
    if (!para.length) { i++; continue }
    const joined = para.join(' ').replace(/\s{2,}/g, ' ').trim()
    blocks.push(QUOTE_RE.test(joined) ? { kind: 'quote', text: joined.replace(QUOTE_RE, '') } : { kind: 'paragraph', text: joined })
  }

  return blocks
}

/** Does this text look like it wants structure? */
export function looksStructured(input: string): boolean {
  return /(^|\n)\s*(?:[:：]?\s*dot\s*[:：]?|[\u2022\u25CF\u25AA\u00B7]|[-*+]|\d{1,3}[.)\]:]|step\s+\d)/im.test(input)
}
