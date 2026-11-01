/**
 * R30 — the Perplexity round: replicate the RAG pipeline and deep research,
 * fix what Perplexity gets wrong, rank the world's models and our own, make
 * the chat faster on tokens, and stop the home screen dropping frames.
 *
 * Run: node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/r30-test.mts   (from frontend/)
 */
import { readFileSync } from 'node:fs'
import { parseQuery, planSubqueries, trustTier, dedupeRank, fuseContext, prepareRag, type RagHit } from '../../backend/src/services/rag'
import { auditCitations } from '../src/lib/rag/audit'
import { rankExternalModels, rankConnections } from '../src/lib/models/rankings'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const src = (p: string) => readFileSync(p, 'utf8')

console.log('\n— Query parsing and deep-research planning —')
{
  check('how-to intent', parseQuery('How do RAG pipelines work?').intent === 'howto')
  check('comparison intent', parseQuery('Vespa vs Elasticsearch differences').intent === 'compare')
  check('definition intent', parseQuery('What is retrieval-augmented generation').intent === 'define')
  check('factual intent', parseQuery('When was Perplexity founded?').intent === 'factual')
  check('stop words drop out', !parseQuery('what is the meaning of this').terms.includes('the'))

  check('shallow mode: one pass', planSubqueries('sonar models', false, 'general').length === 1)
  const deep = planSubqueries('What are sonar models and how fast are they?', true, 'factual')
  check('deep mode: up to three passes', deep.length === 3)
  check('deep passes stay unique', new Set(deep).size === deep.length)
  check('compare queries get a comparison pass', planSubqueries('vespa vs elastic', true, 'compare').some((q) => q.includes('comparison')))
}

console.log('\n— Trust tiers: spam sources stop ranking like Nature —')
{
  check('wikipedia is primary', trustTier('en.wikipedia.org') === 'primary')
  check('.gov is primary', trustTier('archive.nih.gov') === 'primary')
  check('mozilla docs are trusted', trustTier('developer.mozilla.org') === 'trusted')
  check('a random blog is web tier', trustTier('someblog.example') === 'web')
  check('linkedin posts are web tier', trustTier('www.linkedin.com') === 'web')
}

console.log('\n— Refine: dedupe and relevance ranking —')
{
  const hits: RagHit[] = [
    { title: 'Sonar models overview', url: 'https://a.com/1', snippet: 'sonar models speed tokens', domain: 'a.com' },
    { title: 'Sonar again', url: 'https://a.com/2', snippet: 'sonar sonar sonar sonar', domain: 'a.com' },
    { title: 'Unrelated cooking page', url: 'https://b.com/x', snippet: 'pasta recipes', domain: 'b.com' },
    { title: 'Sonar on Wikipedia', url: 'https://en.wikipedia.org/wiki/Sonar_models', snippet: 'sonar models', domain: 'en.wikipedia.org' },
  ]
  const ranked = dedupeRank(hits, ['sonar', 'models', 'speed'])
  check('one voice per host', ranked.length === 3 && ranked.filter((h) => h.domain === 'a.com').length === 1)
  check('the best-scoring hit wins its host', ranked.find((h) => h.domain === 'a.com')?.title === 'Sonar models overview')
  check('relevance beats order', ranked[0].domain === 'a.com')
  check('a tier bonus lifts wikipedia above a weaker match', ranked.findIndex((h) => h.domain === 'en.wikipedia.org') < ranked.findIndex((h) => h.domain === 'b.com'))
}

console.log('\n— Fuse: one capped, numbered, tier-labelled block —')
{
  const sources = [
    { n: 1, title: 'One', url: 'u1', snippet: 's1', domain: 'en.wikipedia.org', tier: 'primary' as const, body: 'The Sonar family runs on Cerebras hardware at 1200 tokens per second.' },
    { n: 2, title: 'Two', url: 'u2', snippet: 's2', domain: 'blog.example', tier: 'web' as const },
  ]
  const { context, chars } = fuseContext('how fast is sonar', sources)
  check('every source is numbered', context.includes('[1]') && context.includes('[2]'))
  check('tiers are labelled', context.includes('(primary)') && context.includes('(web)'))
  check('page bodies beat snippets', context.includes('1200 tokens per second'))
  check('the budget is real', chars === context.length)
  const tiny = fuseContext('q', Array.from({ length: 40 }, (_, i) => ({
    n: i + 1, title: `T${i}`, url: `u${i}`, snippet: 'x'.repeat(300), domain: `d${i}.com`, tier: 'web' as const,
  })), 1600)
  check('the fuse respects its budget', tiny.context.length <= 1700 && tiny.context.split('\n[').length < 40)
}

console.log('\n— The pipeline end-to-end (offline, injected search) —')
{
  const fakeSearch = async (q: string): Promise<RagHit[]> => q.includes('recent') ? [] : [
    { title: 'Sonar family', url: 'https://10.255.255.1/sonar', snippet: 'sonar reasoning deep research', domain: '10.255.255.1' },
    { title: 'Cerebras speed', url: 'https://10.255.255.2/cerebras', snippet: '1200 tokens per second inference', domain: '10.255.255.2' },
  ]
  const out = await prepareRag({ query: 'How fast is Sonar on Cerebras?', deep: true, search: fakeSearch })
  check('sources are numbered from 1', out.sources.map((s) => s.n).join(',') === '1,2')
  check('stats report the passes', out.stats.subqueries.length === 3 && out.stats.hits === 4)
  check('unread pages stay honest (snippet grounding, thin flag)', out.stats.read === 0 && out.stats.thin === true)
  check('estimated tokens track the fused chars', out.stats.estimatedTokens === Math.round(out.stats.chars / 4))
  const failingSearch = async () => { throw new Error('ladder down') }
  const empty = await prepareRag({ query: 'anything', search: failingSearch })
  check('a dead ladder yields no sources, never fake ones', empty.sources.length === 0 && empty.stats.hits === 0)
}

console.log('\n— The citation audit: invented [n] markers cannot survive —')
{
  const a = auditCitations('Sonar is fast [1] and cheap [2], see also [9] and [1,2].', 2)
  check('valid markers stay', a.text.includes('[1]') && a.text.includes('[1,2]'))
  check('out-of-range markers are stripped', !a.text.includes('[9]') && a.removed === 1)
  check('used set is reported', a.used.join(',') === '1,2')
  const b = auditCitations('No markers here at all.', 5)
  check('plain text passes through', b.text.includes('No markers') && b.removed === 0)
  const c = auditCitations('Only bogus [77].', 3)
  check('a fully-bogus marker leaves no empty brackets', !c.text.includes('[]') && c.removed === 1)
}

console.log('\n— The chat pipeline runs RAG and audits —')
{
  const chat = src('src/lib/chat/runChat.ts')
  check('rag client is called before grounding', chat.includes("await prepareRag(prompt, Boolean(mode.quality))"))
  check('deep research rides the quality mode', chat.includes('prepareRag(prompt, Boolean(mode.quality))'))
  check('grounding rules restrict citation range', chat.includes('using ONLY numbers 1–'))
  check('disagreement must be surfaced, not blended', chat.includes('Where sources disagree, say so'))
  check('the audit runs at finish', chat.includes('auditCitations(text, ctx.ragSourceCount)'))
  check('stripped markers are disclosed to the user', chat.includes('invented citation marker'))
  check('classic snippet path survives as the fallback', chat.includes('Web search results retrieved for this query'))
}

console.log('\n— The RAG route: live ladder, never demo placeholders —')
{
  const route = src('../backend/src/routes/search.ts')
  check('POST /rag/prepare exists', route.includes("'/rag/prepare'"))
  check('searxng then ddg ladder', route.includes('searchSearxngAuto(q, { own, timeoutMs: 5000 })') && route.includes('searchDdg(q, 5000)'))
  const ragBlock = route.slice(route.indexOf("'/rag/prepare'"))
  check('demo placeholders never ground an answer', !ragBlock.includes('searchDemo'))
  check('an empty ladder says ok:false', ragBlock.includes("ok: false"))
}

console.log('\n— Rankings: the world board and your own —')
{
  const models = [
    { id: 'lab/free-big', name: 'Free Big', context_length: 131072, pricing: { prompt: '0', completion: '0' } },
    { id: 'lab/free-small', name: 'Free Small', context_length: 8192, pricing: { prompt: '0', completion: '0' } },
    { id: 'lab/cheap', name: 'Cheap', context_length: 128000, pricing: { prompt: '0.0000001', completion: '0.0000002' } },
    { id: 'lab/pricey', name: 'Pricey', context_length: 200000, pricing: { prompt: '0.00003', completion: '0.00006' } },
    { id: 'broken', context_length: 0 },
  ]
  const ranked = rankExternalModels(models)
  check('free models lead the board', ranked[0].free && ranked[1].free)
  check('bigger free context ranks first among free', ranked[0].id === 'lab/free-big')
  check('paid models rank by context per dollar', ranked.findIndex((r) => r.id === 'lab/cheap') < ranked.findIndex((r) => r.id === 'lab/pricey'))
  check('zero-context rows are dropped', !ranked.some((r) => r.id === 'broken'))
  check('every row explains its rank', ranked.every((r) => r.why.length > 0))

  const now = Date.now()
  const log = [
    { t: now - 1000, endpoint: 'https://api.openai.com/v1', purpose: 'OpenAI · gpt-4o', bytes: 2000, status: 'ok' as const },
    { t: now - 2000, endpoint: 'https://api.openai.com/v1', purpose: 'OpenAI · gpt-4o', bytes: 3000, status: 'ok' as const },
    { t: now - 3000, endpoint: 'https://api.anthropic.com/v1', purpose: 'Anthropic · claude-sonnet-4', bytes: 4000, status: 'error' as const },
    { t: now - 99 * 86_400_000, endpoint: 'https://api.old.com/v1', purpose: 'Old · model', bytes: 100, status: 'ok' as const },
    { t: now - 500, endpoint: 'search://searxng', purpose: 'web search: x', bytes: 500, status: 'ok' as const },
  ]
  const local = rankConnections(log)
  check('provider · model pairs group together', local.some((r) => r.label === 'OpenAI · gpt-4o' && r.calls === 2))
  check('success rate is measured', local.find((r) => r.label === 'Anthropic · claude-sonnet-4')?.okRate === 0)
  check('usage outranks a stale one-off', local.findIndex((r) => r.label === 'OpenAI · gpt-4o') < local.findIndex((r) => r.label === 'Old · model'))
  check('non-model endpoints rank too', local.some((r) => r.label === 'searxng'))

  const picker = src('src/components/topbar/ModelPicker.tsx')
  const board = src('src/components/topbar/RankingsView.tsx')
  check('the picker opens the boards', picker.includes('rankings-toggle') && picker.includes('<RankingsView />'))
  check('world board pulls the live API', board.includes('openrouter.ai/api/v1/models') === false && src('src/lib/models/rankings.ts').includes('openrouter.ai/api/v1/models'))
  check('both boards are labelled honestly', board.includes('Not an arena score') && board.includes('connection log'))
}

console.log('\n— Home screen: the frame-rate fixes —')
{
  const spot = src('src/components/ui/aceternity/SpotlightCard.tsx')
  check('the spotlight no longer re-renders per mousemove', !spot.includes('setPos') && spot.includes("--spot-x"))
  check('it writes CSS variables instead of state', spot.includes("el.style.setProperty('--spot-x'"))

  const aurora = src('src/components/ui/aceternity/AuroraBackground.tsx')
  check('aurora pauses on a hidden tab', aurora.includes('visibilitychange') && aurora.includes('animationPlayState'))
  check('aurora honours reduced motion', aurora.includes('prefers-reduced-motion'))

  const revolve = src('src/components/home/RevolvingText.tsx')
  check('the revolving text skips hidden tabs', revolve.includes('document.hidden'))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('failed:', fails.join(' | ')); process.exit(1) }
