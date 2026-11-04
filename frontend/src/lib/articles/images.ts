// AI image fetching for the Article editor.
// Primary path: Wikimedia Commons search API (free, permissively licensed,
// no key). Fallback: null → UI offers local upload.

export interface FetchedImage {
  url: string
  title: string
  attribution: string
  sourceUrl: string
  reason: string
}

export async function findCommonsImage(query: string, signal?: AbortSignal): Promise<FetchedImage | null> {
  try {
    const url =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrnamespace: '6', // File namespace
        gsrlimit: '4',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '1000',
        format: 'json',
        origin: '*',
      })
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    const list = Object.values<any>(pages).sort((a: any, b: any) => (a.index ?? 99) - (b.index ?? 99))
    for (const p of list) {
      const info = p.imageinfo?.[0]
      if (!info?.thumburl) continue
      const meta = info.extmetadata ?? {}
      const strip = (h: any) => String(h?.value ?? '').replace(/<[^>]*>/g, '').trim()
      const artist = strip(meta.Artist) || 'Wikimedia Commons contributor'
      const license = strip(meta.LicenseShortName) || 'open license'
      return {
        url: info.thumburl,
        title: String(p.title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        attribution: `${artist} · ${license} · Wikimedia Commons`,
        sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        reason: `Best Commons match for “${query}” — ${p.title}.`,
      }
    }
    return null
  } catch {
    return null
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}
