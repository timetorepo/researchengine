// Tiny static file server for the built frontend — no extra dependency.
// SPA fallback: any GET that is not /api and not a real file serves index.html.
//
// Two things matter more than they look. First, everything is compressed: the
// app shell is ~1 MB of JavaScript, and brotli takes that to a third of the size
// on the wire — over the WebView's local loopback that is still tens of
// milliseconds off every cold start, and it makes a browser visit over the LAN
// feel local. Compression is done once per file and kept in memory, because the
// files behind hashed names never change.
//
// Second, conditional requests. Hashed assets are immutable and cached for a
// year; `index.html` is `no-cache` and revalidated with an ETag, so a rebuilt
// server is picked up on the next load while an unchanged one costs a 304.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { extname, join, normalize } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
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

/** Already-compressed formats: running them through brotli only wastes cycles. */
const INCOMPRESSIBLE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.gz', '.br', '.zip'])
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.webmanifest', '.map'])

type Cached = { body: Buffer; etag: string; mtimeMs: number; size: number; enc: Record<string, Buffer> }
const cache = new Map<string, Cached>()

function load(target: string): Cached {
  const st = statSync(target)
  const hit = cache.get(target)
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit
  const body = readFileSync(target)
  const etag = `"${createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`
  const ext = extname(target).toLowerCase()
  const enc: Record<string, Buffer> = {}
  if (COMPRESSIBLE.has(ext) && body.length > 1024) {
    // Brotli wins where it is supported; gzip is the fallback for older clients.
    enc.br = brotliCompressSync(body, {
      params: { 1: 5, 2: 20 }, // quality 5, window 20 — fast enough to do inline
    } as any)
    enc.gzip = gzipSync(body, { level: 6 })
  }
  const entry: Cached = { body, etag, mtimeMs: st.mtimeMs, size: body.length, enc }
  cache.set(target, entry)
  return entry
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
    const hit = load(target)
    const headers: Record<string, string> = {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      etag: hit.etag,
      'last-modified': new Date(hit.mtimeMs).toUTCString(),
      vary: 'accept-encoding',
    }
    if (isIndex) headers['cache-control'] = 'no-cache'
    else if (rel.startsWith('assets/')) headers['cache-control'] = 'public, max-age=31536000, immutable'
    else headers['cache-control'] = 'public, max-age=3600'

    // A conditional request that still matches costs a header round-trip, not a
    // megabyte of JavaScript.
    const inm = c.req.header('if-none-match')
    if (inm && inm.split(',').some((t) => t.trim() === hit.etag)) {
      return new Response(null, { status: 304, headers })
    }

    const accept = c.req.header('accept-encoding') ?? ''
    const pick = /\bbr\b/.test(accept) && hit.enc.br ? 'br' : /\bgzip\b/.test(accept) && hit.enc.gzip ? 'gzip' : ''
    if (pick) {
      headers['content-encoding'] = pick
      headers['content-length'] = String(hit.enc[pick].length)
      return new Response(new Uint8Array(hit.enc[pick]), { status: 200, headers })
    }

    headers['content-length'] = String(hit.body.length)
    if (target === indexHtml || hit.body.length < 64 * 1024) {
      // Small files and the shell: send bytes, not a stream — one less moving
      // part on the path that decides how fast the window fills.
      return new Response(new Uint8Array(hit.body), { status: 200, headers })
    }
    const rs = createReadStream(target)
    delete headers['content-length']
    return new Response(Readable.toWeb(rs) as ReadableStream, { status: 200, headers })
  }
}
