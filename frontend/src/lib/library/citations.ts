/**
 * Cite what you just read.
 *
 * The reader already knows the title, the site and the address of the page on
 * screen, which is everything a citation needs — so the viewer offers the three
 * formats researchers actually paste: APA, MLA and BibTeX. Everything is built
 * locally from what the reader reduced; nothing is fetched and nothing is
 * invented, and fields the page did not provide are marked as such ("n.d.").
 */

export interface CitationsSource {
  title?: string
  url: string
  siteName?: string
  fetchedAt?: number
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const yearOf = (s?: CitationsSource) =>
  new Date(s?.fetchedAt ?? Date.now()).getFullYear()

const bibKey = (s: CitationsSource) => {
  const word = clean(s.title ?? (host(s.url) || 'source')).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'source'
  return `${word}${yearOf(s)}`
}

export function citeAPA(s: CitationsSource): string {
  const title = clean(s.title ?? '') || 'Untitled page'
  const site = s.siteName ?? host(s.url)
  const wiki = /wikipedia\.org$/.test(host(s.url))
  if (wiki) return `${title}. (${yearOf(s)}). In Wikipedia. ${s.url}`
  return `${title}. (n.d.). ${site}. Retrieved ${new Date(s.fetchedAt ?? Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}, from ${s.url}`
}

export function citeMLA(s: CitationsSource): string {
  const title = clean(s.title ?? '') || 'Untitled page'
  const site = s.siteName ?? host(s.url)
  const accessed = new Date(s.fetchedAt ?? Date.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `"${title}." ${site}, ${accessed}, ${s.url}.`
}

export function citeBibTeX(s: CitationsSource): string {
  const title = clean(s.title ?? '') || 'Untitled page'
  const site = s.siteName ?? host(s.url)
  return [
    `@misc{${bibKey(s)},`,
    `  title     = {${title}},`,
    `  publisher = {${site}},`,
    `  year      = {${yearOf(s)}},`,
    `  url       = {${s.url}},`,
    `  note      = {Accessed: ${new Date(s.fetchedAt ?? Date.now()).toISOString().slice(0, 10)}}`,
    '}',
  ].join('\n')
}

export const CITATION_FORMATS: { id: 'apa' | 'mla' | 'bibtex'; label: string; build: (s: CitationsSource) => string }[] = [
  { id: 'apa', label: 'APA 7', build: citeAPA },
  { id: 'mla', label: 'MLA 9', build: citeMLA },
  { id: 'bibtex', label: 'BibTeX', build: citeBibTeX },
]
