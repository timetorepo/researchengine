/**
 * Feeds, typeset for reading.
 *
 * A feed URL in the Browser tab is a wall of XML — correct, and useless. The
 * reader detects RSS and Atom on the way in and reduces the feed to the same
 * blocks it reduces pages to: the channel as a title and a standfirst, then
 * one heading per item with its date, its author and its description with the
 * markup stripped, newest first the way the feed wrote them. The Read tab then
 * reads like a digest instead of showing source.
 */
import { decodeEntities, type Block } from './html'

const strip = (s: string): string => {
  // Decode first: feeds love escaping their own markup (&lt;p&gt;), so the
  // tag strip must run on the decoded text. Block closers become a space so
  // sentences keep their shape; inline tags just disappear.
  let t = decodeEntities(decodeEntities(s))
  t = t.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  t = t.replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote|pre|section|article)>/gi, ' ')
  t = t.replace(/<[^>]*>/g, '')
  return t.replace(/\s+/g, ' ').trim()
}

/** RSS 2.0 or Atom, by root element or content type. */
export function looksLikeFeed(html: string, contentType?: string | null): boolean {
  if (contentType && /rss\+xml|atom\+xml|feed\+xml/i.test(contentType)) return true
  const head = html.slice(0, 2000)
  return /<rss\b/i.test(head) || /<feed\b[^>]*xmlns/i.test(head)
}

const tag = (xml: string, name: string): string | undefined => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (m) return strip(m[1])
  // Atom links carry the URL in an attribute.
  const a = xml.match(new RegExp(`<${name}\\b[^>]*href=["']([^"']+)`, 'i'))
  return a ? a[1] : undefined
}

const slug = (s: string, i: number) =>
  (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || `item-${i}`)

export interface ReducedFeed {
  title: string
  description?: string
  blocks: Block[]
  outline: { id: string; text: string; level: number }[]
  itemCount: number
}

export function feedToBlocks(xml: string, base: URL): ReducedFeed {
  const isAtom = /<feed\b[^>]*xmlns/i.test(xml.slice(0, 2000))
  const channelTitle = tag(xml.slice(0, 4000), 'title') ?? base.hostname
  const channelDesc = tag(xml.slice(0, 4000), 'subtitle') ?? tag(xml.slice(0, 4000), 'description')

  const items: string[] = []
  const itemRe = /<(item|entry)\b([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) && items.length < 24) items.push(m[2])

  const blocks: Block[] = []
  const outline: ReducedFeed['outline'] = []
  const pushHeading = (level: number, text: string, id: string) => {
    blocks.push({ type: 'heading', level, text, id })
    outline.push({ id, text, level })
  }

  const headId = slug(channelTitle, 0)
  pushHeading(1, channelTitle, headId)
  if (channelDesc) blocks.push({ type: 'paragraph', text: channelDesc })

  items.forEach((it, i) => {
    const title = tag(it, 'title') ?? `Item ${i + 1}`
    const link = tag(it, 'link')
    const date = tag(it, 'pubDate') ?? tag(it, 'updated') ?? tag(it, 'published') ?? tag(it, 'date')
    const author = tag(it, 'creator') ?? tag(it, 'author') ?? tag(it, 'name')
    const encoded = it.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1]
    const body =
      (encoded ? strip(encoded) : undefined) ?? tag(it, 'content') ?? tag(it, 'summary') ?? tag(it, 'description')

    const id = slug(title, i + 1)
    pushHeading(2, title, id)
    const meta = [date, author, link].filter(Boolean).join(' · ')
    if (meta) blocks.push({ type: 'quote', text: meta })
    if (body) {
      // A digest, not a reprint: long enough to judge, short enough to scroll.
      const cut = body.length > 900 ? `${body.slice(0, 900).replace(/\s+\S*$/, '')}…` : body
      blocks.push({ type: 'paragraph', text: cut })
    }
  })

  return {
    title: channelTitle,
    description: channelDesc,
    blocks,
    outline,
    itemCount: items.length,
  }
}

/** One honest line about the reduction, for the reader's footer. */
export const feedNote = (r: ReducedFeed) =>
  `${r.itemCount} item${r.itemCount === 1 ? '' : 's'} typeset from the feed`
