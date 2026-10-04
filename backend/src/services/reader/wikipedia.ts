/**
 * Wikipedia result links and the exact page target the reader asks the API for.
 *
 * Search results historically used `/?curid=<pageid>`, but the reader treated
 * `/` as a title and asked MediaWiki for `titles=/`. That redirected to the
 * article about the slash character, so searching for JavaScript could open
 * "Slash (punctuation)". Keep the page id all the way into the read request.
 */
export interface WikipediaPageTarget {
  parameter: 'pageids' | 'titles'
  value: string
}

export function wikipediaPageTarget(url: URL): WikipediaPageTarget | null {
  const pageId = url.searchParams.get('curid')
  if (pageId && /^\d+$/.test(pageId)) return { parameter: 'pageids', value: pageId }

  const match = url.pathname.match(/^\/wiki\/(.+)$/)
  if (!match) return null
  try {
    const title = decodeURIComponent(match[1]).replace(/_/g, ' ').trim()
    return title ? { parameter: 'titles', value: title } : null
  } catch {
    return null
  }
}

export function wikipediaPageUrl(title: string, pageId?: number | string, language = 'en'): string {
  const lang = /^[a-z-]+$/i.test(language) ? language : 'en'
  const slug = encodeURIComponent(String(title ?? '').trim().replace(/\s+/g, '_'))
  const url = new URL(`https://${lang}.wikipedia.org/wiki/${slug}`)
  if (pageId != null && /^\d+$/.test(String(pageId))) url.searchParams.set('curid', String(pageId))
  return url.toString()
}
