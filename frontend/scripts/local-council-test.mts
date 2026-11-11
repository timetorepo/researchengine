// Local models, AI council and the Composio endpoint rule, checked without a browser.
// The Ollama pull is replayed from a stub stream split at awkward places, so the
// progress parser is tested on the bytes it will really see.
import { estimateGB, fitFor, recommend, QUANTS } from '../src/lib/local-models/fit'
import { budgetFor } from '../src/lib/local-models/hardware'
import { ollamaNameFor, pullLocalModel, CATEGORIES } from '../src/lib/local-models/client'
import { councilBlock, councilMembers, COUNCIL_MAX, type CouncilDraft } from '../src/lib/chat/council'
import { composioEndpointProblem } from '../src/lib/composio/endpoint'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

// --- memory estimate ---------------------------------------------------------------
check('7B at Q4 is about 5.4 GB', estimateGB(7, 'Q4_K_M') === 5.4, String(estimateGB(7, 'Q4_K_M')))
check('Q8 needs more than Q4', estimateGB(7, 'Q8_0') > estimateGB(7, 'Q4_K_M'))
check('every quantisation is listed', QUANTS.length === 3)
check('a 7B fits 8 GB comfortably', fitFor(estimateGB(7, 'Q4_K_M'), 8) === 'comfortable')
check('a 7B is tight in 6 GB', fitFor(estimateGB(7, 'Q4_K_M'), 6) === 'tight')
check('a 7B is too heavy in 4 GB', fitFor(estimateGB(7, 'Q4_K_M'), 4) === 'too-heavy')
check('unknown size is unknown', fitFor(null, 8) === 'unknown')

// --- budget from the device -------------------------------------------------------
check('4 GB laptop gets a 2 GB budget', budgetFor(4, undefined).budgetGB === 2)
check('16 GB machine gets 8 GB', budgetFor(16, undefined).budgetGB === 8)
check('unreported memory assumes 8 GB', budgetFor(null, undefined).budgetGB === 4)
check('entered VRAM takes priority', budgetFor(16, 8).budgetGB === 6.8)
check('the basis is said out loud', /entered/.test(budgetFor(16, 8).basis) && /half/.test(budgetFor(16, undefined).basis))

// --- recommendation -----------------------------------------------------------------
const models = [
  { repo: 'a/Big-70B-GGUF', paramsB: 70 },
  { repo: 'a/Mid-7B-GGUF', paramsB: 7 },
  { repo: 'a/Small-3B-GGUF', paramsB: 3 },
  { repo: 'a/Unknown-GGUF', paramsB: null },
]
check('recommends the largest model that fits comfortably', recommend(models, 8, 'Q4_K_M')?.repo === 'a/Mid-7B-GGUF')
check('on a 4 GB laptop it recommends the 3B', recommend(models, 4, 'Q4_K_M')?.repo === 'a/Small-3B-GGUF', String(recommend(models, 4, 'Q4_K_M')?.repo))
check('an unknown size is never recommended', recommend([{ repo: 'x/y-GGUF', paramsB: null }], 8, 'Q4_K_M') === null)
check('nothing fits in 1 GB', recommend(models, 1, 'Q4_K_M') === null)

// --- Ollama name and categories ----------------------------------------------------
check('Hugging Face names use hf.co and the quant', ollamaNameFor('Qwen/Qwen2.5-7B-Instruct-GGUF', 'Q4_K_M') === 'hf.co/Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M')
check('three categories: Official, Abliterated, Optimized', CATEGORIES.map((c) => c.label).join() === 'Official,Abliterated,Optimized')
check('abliterated carries a caution', !!CATEGORIES.find((c) => c.id === 'abliterated')?.caution)

// --- the progress parser, on split bytes -------------------------------------------
{
  const frames = [
    { status: 'pulling manifest' },
    { status: 'downloading', total: 1000, completed: 500 },
    { status: 'success' },
  ]
  const text = frames.map((f) => JSON.stringify(f) + '\n').join('')
  // Cut the stream at awkward points, including inside a JSON line.
  const cuts = [7, 33, 61, text.length - 4]
  const chunks: Uint8Array[] = []
  let last = 0
  const enc = new TextEncoder()
  for (const c of [...cuts, text.length]) { chunks.push(enc.encode(text.slice(last, c))); last = c }
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    let i = 0
    const body = new ReadableStream<Uint8Array>({ pull(ctrl) { if (i < chunks.length) ctrl.enqueue(chunks[i++]); else ctrl.close() } })
    return new Response(body, { status: 200 })
  }) as typeof fetch
  const seen: { status: string; pct?: number }[] = []
  await pullLocalModel('hf.co/a/b:Q4_K_M', (p) => seen.push({ status: p.status, pct: p.completed }))
  globalThis.fetch = realFetch
  check('split frames are reassembled', seen.length === 3, JSON.stringify(seen))
  check('progress values survive the split', seen[1]?.pct === 500)
  check('the stream ends on success', seen.at(-1)?.status === 'success')
}
{
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{"status":"pulling manifest"}\n{"error":"pull model manifest: file does not exist"}\n', { status: 200 })) as typeof fetch
  let message = ''
  try { await pullLocalModel('hf.co/a/b:Q9', () => {}) } catch (e: any) { message = e.message }
  globalThis.fetch = realFetch
  check("Ollama's own error reaches the person", message.includes('file does not exist'), message)
}
{
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{"status":"pulling manifest"}\n', { status: 200 })) as typeof fetch
  let message = ''
  try { await pullLocalModel('hf.co/a/b:Q4_K_M', () => {}) } catch (e: any) { message = e.message }
  globalThis.fetch = realFetch
  check('a stream cut short is reported, not called success', /stopped before/.test(message), message)
}

// --- council -----------------------------------------------------------------------
const settings = (members: string[]) => ({ councilMembers: members } as any)
check('council keeps at most four members', councilMembers(settings(['a:1', 'b:2', 'c:3', 'd:4', 'e:5'])).length === COUNCIL_MAX)
check('council drops entries that are not provider:model', councilMembers(settings(['nothing', 'openai:gpt-4o'])).join() === 'openai:gpt-4o')
check('no members when none are set', councilMembers(settings([])).length === 0)

const draft = (over: Partial<CouncilDraft>): CouncilDraft => ({
  model: 'x:y', label: 'X · y', text: '', ok: true, promptTokens: 0, completionTokens: 0, reported: false, ...over,
})
check('no block when no member answered', councilBlock([draft({ ok: false, error: 'no key' })]) === '')
const block = councilBlock([
  draft({ label: 'A', text: 'Answer A' }),
  draft({ label: 'B', ok: false, text: '', error: 'timeout' }),
  draft({ label: 'C', text: 'Answer C' }),
])
check('only answering members go into the block', block.includes('Answer A') && block.includes('Answer C') && !block.includes('timeout'))
check('the block asks the chair to weigh, not paste', /Do not paste the drafts back/.test(block))
check('a very long draft is clipped', councilBlock([draft({ text: 'z'.repeat(9000) })]).length < 7000)

// --- Composio endpoint rule (browser side) ----------------------------------------
check('empty endpoint is fine (hosted)', composioEndpointProblem('') === null)
check('https gateway is fine', composioEndpointProblem('https://composio.corp.internal') === null)
check('localhost http is fine', composioEndpointProblem('http://localhost:8080') === null)
check('remote http is refused', composioEndpointProblem('http://composio.example.com') !== null)
check('credentials are refused', composioEndpointProblem('https://u:p@x.example.com') !== null)
check('a non-URL is refused', composioEndpointProblem('my gateway') !== null)

console.log(`local-council-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
