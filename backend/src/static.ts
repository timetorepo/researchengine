// Tiny static file server for the built frontend — no extra dependency.
// SPA fallback: any GET that is not /api and not a real file serves index.html.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { extname, join, normalize } from 'node:path'
import type { Context } from 'hono'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

export function staticHandler(root: string) {
  const indexHtml = join(root, 'index.html')

  return async (c: Context) => {
    const url = new URL(c.req.url)
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '') // path traversal guard
    const file = rel ? join(root, rel) : indexHtml

    const target = existsSync(file) && statSync(file).isFile() ? file : indexHtml
    if (!existsSync(target)) return c.notFound()

    const isIndex = target === indexHtml
    const headers: Record<string, string> = {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'content-length': String(statSync(target).size),
    }
    if (isIndex) headers['cache-control'] = 'no-cache'
    else if (rel.startsWith('assets/')) headers['cache-control'] = 'public, max-age=31536000, immutable'

    const rs = createReadStream(target)
    return new Response(Readable.toWeb(rs) as ReadableStream, { status: 200, headers })
  }
}
