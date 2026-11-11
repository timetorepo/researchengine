/**
 * Client for the server's bot web routes (backend/src/routes/botweb.ts). A bot
 * searches with SearXNG and reads pages either directly or through the headless
 * browser you run in Docker. Nothing is kept on the server.
 */
import { useBots } from './store'

export interface WebHit { title: string; url: string; snippet: string }

export type WebSearch = { ok: true; results: WebHit[] } | { ok: false; error: string }
export type WebPage = { ok: true; url: string; title: string; text: string; via: string } | { ok: false; error: string }

async function json(res: Response): Promise<any> {
  return res.json().catch(() => ({}))
}

export async function webSearch(query: string): Promise<WebSearch> {
  const { searxng } = useBots.getState().settings
  const params = new URLSearchParams({ q: query })
  if (searxng.trim()) params.set('searxng', searxng.trim())
  try {
    const res = await fetch(`/api/bots/web/search?${params.toString()}`)
    const body = await json(res)
    if (!res.ok) return { ok: false, error: body.error ?? `Search answered ${res.status}.` }
    return { ok: true, results: Array.isArray(body.results) ? body.results : [] }
  } catch {
    return { ok: false, error: 'The local server did not answer the search.' }
  }
}

export async function webOpen(url: string): Promise<WebPage> {
  const { browserUrl } = useBots.getState().settings
  try {
    const res = await fetch('/api/bots/web/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, browser: browserUrl.trim() || undefined }),
    })
    const body = await json(res)
    if (!res.ok) return { ok: false, error: body.error ?? `Reading the page answered ${res.status}.` }
    return { ok: true, url: body.url ?? url, title: body.title ?? url, text: body.text ?? '', via: body.via ?? 'http' }
  } catch {
    return { ok: false, error: 'The local server did not open the page.' }
  }
}
