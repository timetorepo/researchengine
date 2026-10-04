/**
 * Small, dependency-free RSS 2.0 / Atom 1.0 reader.
 * Feeds are XML, not failed web pages. We reduce entries to plain story text;
 * the XML is never injected into the app as HTML.
 */
import { decodeEntities, type Block } from './html'

export interface FeedArticle {
  title: string
  link?: string
  summary?: string
  published?: string
  author?: string
}

export interface ParsedFeed {
  title: string
  articles: FeedArticle[]
  format: 'rss' | 'atom' | 'rdf'
}

const NS = '(?:[A-Za-z0-9_.-]+:)?'

function element(xml: string, name: string): string {
  const re = new RegExp(`<${NS}${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${NS}${name}\\s*>`, 'i')
  return xml.match(re)?.[1] ?? ''
}

function cleanMarkup(value: string, limit = 2400): string {
  // XML-escaped XHTML (`&lt;p&gt;...`) must be decoded before tags are stripped.
  // Decode once only so double-escaped text cannot become unfiltered markup.
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|br|section|article)\s*>/gi, '\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit)
}

function absoluteLink(block: string, base: URL, format: ParsedFeed['format']): string | undefined {
  let raw = ''
  if (format === 'atom') {
    const links = [...block.matchAll(/<(?:[\w.-]+:)?link\b([^>]*)\/?\s*>/gi)]
    const chosen = links.find((m) => !/\brel=["'](?:self|enclosure)["']/i.test(m[1])) ?? links[0]
    raw = chosen?.[1].match(/\bhref=["']([^"']+)["']/i)?.[1] ?? ''
  } else {
    raw = element(block, 'link')
  }
  const cleaned = cleanMarkup(raw, 2000)
  if (!cleaned) return undefined
  try {
    const url = new URL(cleaned, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function dateOf(block: string): string | undefined {
  const raw = cleanMarkup(element(block, 'pubDate') || element(block, 'published') || element(block, 'updated'), 120)
  if (!raw) return undefined
  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : raw
}

function entryBlocks(xml: string, name: 'item' | 'entry'): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}\\s*>`, 'gi')
  return xml.match(re) ?? []
}

export function looksLikeFeed(xml: string): boolean {
  return /<(?:rss|feed|rdf:RDF)\b/i.test(xml)
}

export function parseFeedXml(xml: string, feedUrl: string): ParsedFeed | null {
  if (!looksLikeFeed(xml)) return null
  let base: URL
  try { base = new URL(feedUrl) } catch { return null }

  const format: ParsedFeed['format'] = /<feed\b/i.test(xml) ? 'atom' : /<rdf:RDF\b/i.test(xml) ? 'rdf' : 'rss'
  const root = xml.match(/<(?:rss|feed|rdf:RDF)\b[^>]*>([\s\S]*?)<\/(?:rss|feed|rdf:RDF)\s*>/i)?.[1] ?? xml
  const title = cleanMarkup(element(root, 'title'), 240) || base.hostname.replace(/^www\./, '')
  const tag = format === 'atom' ? 'entry' : 'item'
  const articles = entryBlocks(root, tag).slice(0, 50).map((block): FeedArticle => {
    const title = cleanMarkup(element(block, 'title'), 300) || 'Untitled story'
    // content:encoded is normally the fullest RSS field. Atom commonly uses
    // content or summary. All are reduced to plain text before rendering.
    const content = element(block, 'encoded')
      || element(block, 'content')
      || element(block, 'description')
      || element(block, 'summary')
    const author = cleanMarkup(element(block, 'author') || element(block, 'creator'), 160)
    return {
      title,
      link: absoluteLink(block, base, format),
      summary: cleanMarkup(content, 3200),
      published: dateOf(block),
      author: author || undefined,
    }
  }).filter((article) => article.title !== 'Untitled story' || !!article.link || !!article.summary)

  return { title, articles, format }
}

/** Convert feed articles into the reader's safe, typed blocks. */
export function feedToBlocks(feed: ParsedFeed): {
  blocks: Block[]
  outline: { id: string; text: string; level: number }[]
  wordCount: number
} {
  const blocks: Block[] = []
  const outline: { id: string; text: string; level: number }[] = []
  feed.articles.forEach((article, index) => {
    const id = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || `story-${index + 1}`
    blocks.push({ type: 'heading', level: 2, text: article.title, id })
    outline.push({ id, text: article.title, level: 2 })
    const meta = [article.published, article.author].filter(Boolean).join(' · ')
    if (meta) blocks.push({ type: 'paragraph', text: meta })
    if (article.summary) blocks.push({ type: 'paragraph', text: article.summary })
    if (article.link) blocks.push({ type: 'link', text: 'Read the original story', href: article.link })
  })
  const wordCount = blocks.reduce((count, block) => count + (block.type === 'paragraph' || block.type === 'heading' ? block.text.split(/\s+/).filter(Boolean).length : 0), 0)
  return { blocks, outline, wordCount }
}
