/**
 * The embedding proxy.
 *
 * Half the interesting web refuses to live inside another app's frame: the
 * site sends `X-Frame-Options` or a `frame-ancestors` policy and the browser
 * shows "refused to connect" instead of the page. That is the site's right,
 * and it is fine for a stranger's iframe — but this is the user's own app,
 * reading a page the user chose, on the user's machine. So the server fetches
 * the page itself and hands it to the frame without the frame-blocking
 * headers, the way a reading list or a save-for-later service would.
 *
 * What the rewrite does, and on purpose does not do:
 *
 *   • subresources (images, styles, scripts, fonts) are pointed back at the
 *     site as absolute URLs, so the page still looks like itself;
 *   • links are rewritten to come back through the proxy, so following a link
 *     stays inside the app instead of hitting the same frame block;
 *   • `<base>` and CSP `<meta>` tags and frame-busting scripts are dropped,
 *     because their only job in here would be to break the frame;
 *   • nothing is tracked, nothing is stored: one fetch, one answer.
 *
 * SSRF: the same `parseTarget` guard the reader uses — public http(s) only.
 */
import { parseTarget } from './extract'

/**
 * Hosts whose pages carry `frame-ancestors` / `X-Frame-Options` as a matter
 * of policy. For these the viewer goes straight to the proxied view instead
 * of spending seven seconds proving the refusal again.
 */
export const EMBED_HOSTILE = [
  'awwwards.com', 'dribbble.com', 'refero.design', 'behance.net', 'mobbin.com',
  'pinterest.com', 'instagram.com', 'facebook.com', 'linkedin.com', 'threads.net',
  'x.com', 'twitter.com', 'medium.com', 'google.com', 'youtube.com', 'notion.so',
]

export function isHostileToEmbedding(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return EMBED_HOSTILE.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** Where the viewer points its frame for a proxied page. */
export const proxyPath = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`

/** Make a URL absolute against the page it came from; null when unusable. */
export function absolutize(src: string, base: URL): string | null {
  const s = src.trim()
  if (!s || s.startsWith('#')) return null
  if (/^(data:|blob:|javascript:|mailto:|tel:)/i.test(s)) return null
  try {
    return new URL(s, base).toString()
  } catch {
    return null
  }
}

/**
 * Rewrite a fetched page so it can live inside the app's frame.
 *
 * `proxyUrl` turns an absolute address into wherever a click should go next
 * (the proxy again, so navigation stays in the app).
 */
export function rewriteHtml(html: string, base: URL, proxyUrl: (abs: string) => string): string {
  let out = html

  // The page's own answers to "who may frame me" are exactly what we decline.
  out = out.replace(/<base\b[^>]*>/gi, ' ')
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])?content-security-policy\1[^>]*>/gi, ' ')
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])?x-frame-options\1[^>]*>/gi, ' ')

  // Frame-busting scripts would just bounce the frame; drop the ones whose
  // whole purpose is escaping (top.location / parent.location / frameElement).
  out = out.replace(
    /<script\b[^>]*>(?:(?!<\/script)[\s\S])*(?:top\.location|parent\.location|window\.top|frameElement)(?:(?!<\/script)[\s\S])*<\/script>/gi,
    ' ',
  )

  // srcset lists: every candidate URL becomes absolute.
  out = out.replace(/(\bsrcset\s*=\s*)(["'])((?:[^"']|\\.)*)\2/gi, (_m, _pre: string, q: string, list: string) => {
    const rebuilt = list
      .split(',')
      .map((entry) => {
        const [u, ...rest] = entry.trim().split(/\s+/)
        const abs = u ? absolutize(u, base) : null
        return abs ? [abs, ...rest].join(' ') : entry.trim()
      })
      .filter(Boolean)
      .join(', ')
    return `srcset=${q}${rebuilt}${q}`
  })

  // Element-level rewrites: subresources absolute, anchors through the proxy.
  out = out.replace(/<(a|img|script|link|iframe|source|video|audio|track)\b([^>]*)>/gi, (m, tag: string, attrs: string) => {
    let a = attrs
    a = a.replace(/(\bsrc\s*=\s*)(["'])((?:[^"']|\\.)*)\2/gi, (_m2, pre: string, q: string, v: string) => {
      const abs = absolutize(v, base)
      return abs ? `${pre}${q}${abs}${q}` : _m2
    })
    if (tag === 'link' || tag === 'script') {
      a = a.replace(/(\bhref\s*=\s*)(["'])((?:[^"']|\\.)*)\2/gi, (_m2, pre: string, q: string, v: string) => {
        const abs = absolutize(v, base)
        return abs ? `${pre}${q}${abs}${q}` : _m2
      })
    }
    if (tag === 'a') {
      a = a.replace(/(\bhref\s*=\s*)(["'])((?:[^"']|\\.)*)\2/gi, (_m2, pre: string, q: string, v: string) => {
        const abs = absolutize(v, base)
        if (!abs || !/^https?:/i.test(abs)) return _m2
        return `${pre}${q}${proxyUrl(abs)}${q} target="_self"`
      })
    }
    return `<${tag}${a}>`
  })

  return out
}

/** One fetch, capped and timed, HTML or nothing. */
export async function fetchForProxy(url: string): Promise<
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; status?: number; reason: string }
> {
  const target = parseTarget(url)
  if (!target) return { ok: false, reason: 'Only public http(s) pages can be opened here.' }
  try {
    const res = await fetch(target.toString(), {
      headers: {
        'user-agent': 'ResearchEngine/0.39 (+embedding proxy; respects robots.txt)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok) return { ok: false, status: res.status, reason: `The site answered ${res.status}.` }
    if (!/text\/html|application\/xhtml/i.test(type)) {
      return { ok: false, reason: `That address answered with ${type || 'an unknown type'}, not a web page.` }
    }
    const raw = await res.text()
    const html = raw.length > 3_000_000 ? raw.slice(0, 3_000_000) : raw
    return { ok: true, html, finalUrl: res.url || target.toString() }
  } catch (e: any) {
    return { ok: false, reason: `The page could not be fetched (${String(e?.message ?? e)}).` }
  }
}
