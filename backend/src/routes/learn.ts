/**
 * Learn-side lookups. Today: YouTube videos that match what is being studied.
 *
 * There is no YouTube key in this app and none is asked for. The search ladder
 * the rest of the app uses is asked for `site:youtube.com <topic>`, and only
 * watch / short / youtu.be links survive the filter. The answer says which
 * engine produced it, the same way /api/search does, so a result is never
 * presented as more authoritative than it is.
 */
import { Hono } from 'hono'
import { searchDdg, searchSearxngAuto, type SearchResult } from '../services/search/adapters'

export const learnRoutes = new Hono()

export interface LearnVideo {
  id: string
  title: string
  url: string
  snippet: string
  channel: string
}

/** The 11-character id from a YouTube URL, or null if the URL is not a video. */
export function youtubeId(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)
      id = m ? m[1] : null
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

export function videosFrom(results: SearchResult[]): LearnVideo[] {
  const seen = new Set<string>()
  const out: LearnVideo[] = []
  for (const r of results) {
    const id = youtubeId(r.url)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      title: r.title.replace(/\s*-\s*YouTube\s*$/i, '').trim() || 'Untitled video',
      url: `https://www.youtube.com/watch?v=${id}`,
      snippet: r.snippet ?? '',
      channel: r.domain && r.domain !== 'youtube.com' ? r.domain : 'YouTube',
    })
    if (out.length >= 8) break
  }
  return out
}

/** GET /api/learn/videos?q=topic */
learnRoutes.get('/videos', async (c) => {
  const topic = (c.req.query('q') ?? '').trim().slice(0, 160)
  if (!topic) return c.json({ error: 'Missing ?q=' }, 400)
  if (c.req.query('offline') === '1') {
    return c.json({ videos: [], engine: null, offline: true, note: 'Offline mode is on, so nothing was searched.' })
  }
  const query = `${topic} site:youtube.com`
  try {
    const results = await searchDdg(query, 8000)
    const videos = videosFrom(results)
    if (videos.length) return c.json({ videos, engine: 'ddg' })
  } catch { /* fall through to SearXNG */ }
  try {
    const { results, instance } = await searchSearxngAuto(query, { own: process.env.SEARXNG_URL || null, timeouts: 3, timeoutMs: 6000 })
    const videos = videosFrom(results)
    return c.json({ videos, engine: `searxng:${instance}`, note: videos.length ? undefined : 'No YouTube videos matched this topic.' })
  } catch (e: any) {
    return c.json({ videos: [], engine: null, error: 'No search engine answered, so videos could not be looked up.', detail: String(e?.message ?? e) }, 502)
  }
})
