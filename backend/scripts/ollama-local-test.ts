// Local models on the server: the pull and delete routes accept only model names that
// look like Ollama names, the pull stream reaches the browser unchanged, and the Hugging
// Face search turns API results into the shape the panel uses. Ollama and Hugging Face
// are replaced by stand-in fetches, so nothing leaves the machine.
import { Hono } from 'hono'
import { ollamaRoutes } from '../src/routes/ollama'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const app = new Hono()
app.route('/api/ollama', ollamaRoutes)

const realFetch = globalThis.fetch
const calls: { url: string; method: string; body?: string }[] = []

const hfModels = (authorParam: string | null) => {
  const byAuthor: Record<string, any[]> = {
    Qwen: [
      { id: 'Qwen/Qwen2.5-7B-Instruct-GGUF', downloads: 900, likes: 40 },
      { id: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF', downloads: 300, likes: 9 },
    ],
    unsloth: [{ id: 'unsloth/Llama-3.2-3B-Instruct-GGUF', downloads: 5000, likes: 80 }],
    // The same repo returned twice must be shown once.
    google: [{ id: 'Qwen/Qwen2.5-7B-Instruct-GGUF', downloads: 900, likes: 40 }],
  }
  return authorParam ? byAuthor[authorParam] ?? [] : [{ id: 'someone/Mystery-Model-abliterated-GGUF', downloads: 10, likes: 1 }]
}

globalThis.fetch = (async (url: any, init: any) => {
  const u = String(url)
  calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body })
  if (u.startsWith('https://huggingface.co/api/models')) {
    const author = new URL(u).searchParams.get('author')
    return new Response(JSON.stringify(hfModels(author)), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (u.endsWith('/api/pull')) {
    const frames = [
      { status: 'pulling manifest' },
      { status: 'downloading sha256:abc', digest: 'sha256:abc', total: 1000, completed: 250 },
      { status: 'downloading sha256:abc', digest: 'sha256:abc', total: 1000, completed: 1000 },
      { status: 'success' },
    ]
    const text = frames.map((f) => JSON.stringify(f) + '\n').join('')
    return new Response(text, { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
  }
  if (u.endsWith('/api/delete')) return new Response('', { status: 200 })
  return new Response('{}', { status: 404 })
}) as typeof fetch

// --- pull: name validation ---------------------------------------------------
const pullBody = (name: unknown) => JSON.stringify({ name })
const headers = { 'content-type': 'application/json' }
for (const bad of ['', 'rm -rf /', 'hf.co/a/b/../../c', 'x; curl evil', 'a'.repeat(200)]) {
  const r = await app.request('/api/ollama/pull', { method: 'POST', headers, body: pullBody(bad) })
  check(`pull refuses ${JSON.stringify(bad.slice(0, 24))}`, r.status === 400, `status ${r.status}`)
}
const notText = await app.request('/api/ollama/pull', { method: 'POST', headers, body: JSON.stringify({ name: 42 }) })
check('pull refuses a non-string name', notText.status === 400)
check('refused pulls never reach Ollama', calls.every((c) => !c.url.endsWith('/api/pull')))

// --- pull: a good name streams through -----------------------------------------
const pulled = await app.request('/api/ollama/pull', {
  method: 'POST', headers, body: pullBody('hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M'),
})
check('valid pull is accepted', pulled.status === 200, `status ${pulled.status}`)
check('pull streams as NDJSON', (pulled.headers.get('content-type') ?? '').includes('x-ndjson'))
const streamed = (await pulled.text()).trim().split('\n').map((l) => JSON.parse(l))
check('every progress frame reaches the browser', streamed.length === 4, `frames ${streamed.length}`)
check('the last frame says success', streamed.at(-1)?.status === 'success')
const pullCall = calls.find((c) => c.url.endsWith('/api/pull') && c.method === 'POST')
check('Ollama gets stream:true and the exact name', !!pullCall && JSON.parse(pullCall.body ?? '{}').name === 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M' && JSON.parse(pullCall.body ?? '{}').stream === true)

// --- delete --------------------------------------------------------------------
const del = await app.request('/api/ollama/delete', { method: 'POST', headers, body: pullBody('hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M') })
check('delete succeeds', del.status === 200, `status ${del.status}`)
const delCall = calls.find((c) => c.url.endsWith('/api/delete'))
check('delete uses Ollama DELETE with the name in the body', delCall?.method === 'DELETE' && JSON.parse(delCall.body ?? '{}').name.startsWith('hf.co/'))
const delBad = await app.request('/api/ollama/delete', { method: 'POST', headers, body: pullBody('../../etc') })
check('delete refuses a path-like name', delBad.status === 400)

// --- Hugging Face search ----------------------------------------------------------
const badCat = await app.request('/api/ollama/hf-search?category=pirated')
check('unknown category is refused', badCat.status === 400)

const official = await app.request('/api/ollama/hf-search?category=official')
const off = await official.json() as any
check('official search answers 200', official.status === 200, `status ${official.status}`)
const repos = off.models.map((m: any) => m.repo)
check('a repo returned by two authors appears once', repos.filter((r: string) => r === 'Qwen/Qwen2.5-7B-Instruct-GGUF').length === 1, repos.join(', '))
check('models are sorted by downloads', off.models[0]?.downloads >= off.models[1]?.downloads)
const seven = off.models.find((m: any) => m.repo === 'Qwen/Qwen2.5-7B-Instruct-GGUF')
check('parameter count parsed from the name', seven?.paramsB === 7, JSON.stringify(seven))
const small = off.models.find((m: any) => m.repo.includes('0.5B'))
check('fractional parameter count parsed', small?.paramsB === 0.5, JSON.stringify(small))
const mystery = off.models.find((m: any) => m.repo.includes('Mystery'))
check('unknown size is null, not guessed', mystery === undefined || mystery.paramsB === null, JSON.stringify(mystery))

const opt = await app.request('/api/ollama/hf-search?category=optimized&q=llama')
const optBody = await opt.json() as any
check('optimized search lists its own authors', optBody.models.some((m: any) => m.author === 'unsloth'), JSON.stringify(optBody))
const hfCall = calls.filter((c) => c.url.startsWith('https://huggingface.co/api/models')).at(-1)
check('author searches carry the query and the GGUF filter', !!hfCall && hfCall.url.includes('filter=gguf') && hfCall.url.includes('search=llama'), hfCall?.url)

const abl = await app.request('/api/ollama/hf-search?category=abliterated')
const ablBody = await abl.json() as any
check('abliterated search uses the abliterated term', calls.some((c) => c.url.includes('search=abliterated')) && ablBody.models.length === 1)

globalThis.fetch = realFetch
console.log(`ollama-local-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
