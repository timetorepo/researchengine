/**
 * HTML reduced to something worth reading.
 *
 * Deliberately not a full parser: no dependency, no DOM, and no selector list
 * that quietly stops matching when a site redesigns. Instead the document is cut
 * into its block-level pieces, obvious chrome (nav, footer, aside, cookie bars,
 * forms, scripts) is thrown away, and the region with the most prose per
 * character of markup wins as the main content. That heuristic is old and
 * boring, and it is exactly why it still works.
 */

export type Block =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

export const decodeEntities = (s: string): string =>
  s
    .replace(/&(nbsp|#160);/gi, ' ')
    .replace(/&(amp|#38);/gi, '&')
    .replace(/&(lt|#60);/gi, '<')
    .replace(/&(gt|#62);/gi, '>')
    .replace(/&(quot|#34);/gi, '"')
    .replace(/&(#39|apos|rsquo|lsquo);/gi, "'")
    .replace(/&(mdash|#8212);/gi, '\u2014')
    .replace(/&(ndash|#8211);/gi, '\u2013')
    .replace(/&(hellip|#8230);/gi, '\u2026')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))

const strip = (s: string): string =>
  decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

export function titleOf(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
  if (og) return decodeEntities(og).trim()
  const t = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]
  return t ? decodeEntities(t).trim() : undefined
}

export function metaOf(html: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return decodeEntities(m[1]).trim().slice(0, 300)
  }
  return undefined
}

/** Blocks whose text is definitely not the article. */
const CHROME = /<(nav|footer|header|aside|form|script|style|noscript|svg|iframe|template|button|select)\b[\s\S]*?<\/\1>/gi

const BLOCK_RE = /<(h[1-6]|p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi

const slug = (s: string, i: number) =>
  (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || `s-${i}`)

export interface Reduced {
  blocks: Block[]
  outline: { id: string; text: string; level: number }[]
  images: { src: string; alt?: string }[]
  /** True when a lot of markup was discarded — used to explain thin results. */
  dropped: boolean
}

export function htmlToBlocks(html: string, base: URL): Reduced {
  // Drop chrome, then comments and inline noise.
  let body = html
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) body = bodyMatch[1]
  const before = body.length
  body = body.replace(CHROME, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  const dropped = before - body.length > before * 0.35

  // Pick the densest prose region: split on the classic containers and score
  // each one by how much text it carries per byte of markup.
  const regions = body.split(/<(?:article|main|section|div)\b[^>]*>/i)
  let best = body
  let bestScore = 0
  for (const region of regions) {
    const text = strip(region)
    if (text.length < 200) continue
    const score = text.length / Math.max(1, region.length)
    if (score > bestScore) { bestScore = score; best = region }
  }
  if (bestScore === 0) best = body

  const blocks: Block[] = []
  const outline: Reduced['outline'] = []
  let headingIndex = 0
  let lastWasItem = false
  let itemBuffer: string[] = []
  const flushItems = () => {
    if (itemBuffer.length) {
      blocks.push({ type: 'list', items: itemBuffer })
      itemBuffer = []
    }
  }

  BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BLOCK_RE.exec(best))) {
    const tag = m[1].toLowerCase()
    const text = strip(m[2])
    if (!text || text.length < 2) { lastWasItem = false; continue }
    if (tag === 'li') {
      // Only treat list items as a list when they look like content, not menus.
      if (text.length >= 40 || /[.!?:]$/.test(text)) { itemBuffer.push(text); lastWasItem = true }
      continue
    }
    flushItems()
    lastWasItem = false
    if (tag.startsWith('h')) {
      const level = Math.min(3, Math.max(1, Number(tag[1]) - 1)) // h1 → 1, h2 → 1, h3 → 2 …
      const id = slug(text, headingIndex++)
      blocks.push({ type: 'heading', level, text, id })
      outline.push({ id, text, level })
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', text })
    } else if (tag === 'pre') {
      blocks.push({ type: 'code', text: decodeEntities(m[2].replace(/<[^>]*>/g, '')) })
    } else {
      if (text.length < 25) continue // captions, labels, button text
      blocks.push({ type: 'paragraph', text })
    }
  }
  flushItems()

  // A page with no <p> at all but plenty of text: split the raw text instead of
  // returning nothing.
  if (blocks.length === 0) {
    const text = strip(best)
    for (const para of text.split(/(?<=\.)\s{2,}/)) {
      const p = para.trim()
      if (p.length > 60) blocks.push({ type: 'paragraph', text: p })
    }
  }

  const images: Reduced['images'] = []
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let img: RegExpExecArray | null
  while ((img = imgRe.exec(best)) && images.length < 12) {
    const src = img[1]
    if (/\.(svg|gif)($|\?)/i.test(src) || /sprite|icon|logo|avatar|pixel|1x1/i.test(src)) continue
    const alt = img[0].match(/alt=["']([^"']*)/i)?.[1]
    try { images.push({ src: new URL(src, base).toString(), alt: alt ? decodeEntities(alt) : undefined }) } catch { /* relative junk */ }
  }

  return { blocks, outline, images, dropped }
}

/** Does this page need its own JavaScript to say anything? */
export function looksLikeAppShell(html: string, blocks: Block[]): boolean {
  const textLength = blocks.reduce((n, b) => n + (b.type === 'paragraph' ? b.text.length : b.type === 'quote' ? b.text.length : 0), 0)
  if (textLength > 900) return false
  const scriptBytes = (html.match(/<script[\s\S]*?<\/script>/gi) ?? []).join('').length
  return scriptBytes > html.length * 0.35 || /<div id=["'](root|app|__next)["']\s*>\s*<\/div>/i.test(html)
}
