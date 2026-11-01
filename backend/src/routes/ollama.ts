import { Hono } from 'hono'

export const ollamaRoutes = new Hono()

// Proxy Ollama model discovery so the frontend can hit a same-origin endpoint.
ollamaRoutes.get('/tags', async (c) => {
  const base = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/tags`)
    if (!res.ok) return c.json({ error: `Ollama responded ${res.status}` }, 502)
    return c.json(await res.json())
  } catch (e: any) {
    return c.json({ error: `Cannot reach Ollama at ${base}: ${e.message}` }, 502)
  }
})

const baseUrl = () => (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')

/** Ollama model names: a plain library name, or a Hugging Face GGUF as hf.co/<owner>/<repo>[:quant]. */
const MODEL_NAME = /^(hf\.co\/)?[A-Za-z0-9._-]{1,80}(\/[A-Za-z0-9._-]{1,80})?(:[A-Za-z0-9._-]{1,40})?$/

/**
 * Pull a model into Ollama. Ollama streams progress as NDJSON; the stream is passed
 * straight through so the browser can draw a progress bar.
 */
ollamaRoutes.post('/pull', async (c) => {
  const body = await c.req.json().catch(() => null) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!MODEL_NAME.test(name)) return c.json({ error: 'That model name does not look like an Ollama model (for example hf.co/owner/repo:Q4_K_M).' }, 400)
  try {
    const res = await fetch(`${baseUrl()}/api/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    })
    if (!res.ok || !res.body) return c.json({ error: `Ollama refused the download (${res.status}).` }, 502)
    return c.body(res.body, 200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' })
  } catch (e: any) {
    return c.json({ error: `Cannot reach Ollama at ${baseUrl()}: ${e.message}` }, 502)
  }
})

/** Remove a local model. Ollama takes the name in the body of a DELETE. */
ollamaRoutes.post('/delete', async (c) => {
  const body = await c.req.json().catch(() => null) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!MODEL_NAME.test(name)) return c.json({ error: 'Unknown model name.' }, 400)
  try {
    const res = await fetch(`${baseUrl()}/api/delete`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return c.json({ error: `Ollama could not remove it (${res.status}).` }, 502)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: `Cannot reach Ollama at ${baseUrl()}: ${e.message}` }, 502)
  }
})

/**
 * Three ways to find GGUF models on Hugging Face. Official means the lab that made
 * the model published it; Abliterated means safety-tuned-out variants; Optimized
 * means quantised re-uploads by the people who make local runs fast. The author
 * lists are a starting point, shown in the UI, not a verdict on any model.
 */
export const LOCAL_CATEGORIES = {
  official: { authors: ['Qwen', 'google', 'meta-llama', 'mistralai', 'microsoft', 'deepseek-ai', 'ibm-granite', 'HuggingFaceTB'], search: '' },
  abliterated: { authors: [], search: 'abliterated' },
  optimized: { authors: ['unsloth', 'bartowski', 'lmstudio-community', 'mradermacher'], search: '' },
} as const
export type LocalCategory = keyof typeof LOCAL_CATEGORIES

export interface HfModel {
  repo: string
  author: string
  downloads: number
  likes: number
  paramsB: number | null
}

const PARAMS = /(?:^|[-_.\s])(\d+(?:\.\d+)?)\s?[bB](?![a-zA-Z])/

async function hfList(query: Record<string, string>): Promise<any[]> {
  const url = new URL('https://huggingface.co/api/models')
  for (const [k, v] of Object.entries({ filter: 'gguf', sort: 'downloads', direction: '-1', limit: '24', ...query })) {
    if (v) url.searchParams.set(k, v)
  }
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Hugging Face responded ${res.status}`)
  const json = await res.json()
  return Array.isArray(json) ? json : []
}

function toModel(m: any): HfModel | null {
  const repo = typeof m?.id === 'string' ? m.id : ''
  if (!repo.includes('/')) return null
  const name = repo.split('/')[1] ?? ''
  const hit = PARAMS.exec(name)
  return {
    repo,
    author: repo.split('/')[0],
    downloads: Number(m.downloads ?? 0),
    likes: Number(m.likes ?? 0),
    paramsB: hit ? Number(hit[1]) : null,
  }
}

ollamaRoutes.get('/hf-search', async (c) => {
  const category = (c.req.query('category') ?? 'official') as LocalCategory
  const spec = LOCAL_CATEGORIES[category]
  if (!spec) return c.json({ error: 'Unknown category.' }, 400)
  const q = (c.req.query('q') ?? '').trim().slice(0, 80)
  try {
    let lists: any[][]
    if (spec.authors.length) {
      lists = await Promise.all(spec.authors.map((author) => hfList({ author, search: q, limit: '8' }).catch(() => [])))
    } else {
      lists = [await hfList({ search: q || spec.search, limit: '24' })]
    }
    const seen = new Set<string>()
    const models: HfModel[] = []
    for (const m of lists.flat().map(toModel)) {
      if (!m || seen.has(m.repo)) continue
      seen.add(m.repo)
      models.push(m)
    }
    models.sort((a, b) => b.downloads - a.downloads)
    return c.json({ category, models: models.slice(0, 40) })
  } catch (e: any) {
    return c.json({ error: `Could not reach Hugging Face: ${e.message}` }, 502)
  }
})
