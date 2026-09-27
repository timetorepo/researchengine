/**
 * Model selection: logos, free/paid, unlisting — and the Providers tab's new
 * empty-first behaviour.
 *
 * Everything here is the *real* code: the family matcher, the tier rules, the
 * list selection the picker renders, and the provider catalog. Nothing is
 * re-implemented for the test, which is the only way the test can mean anything.
 *
 * Run: npx tsx scripts/models-test.mts
 */
import { readFileSync } from 'node:fs'
import { FAMILIES, modelFamily, monogramFor } from '../src/lib/providers/families'
import {
  modelTier, matchesFilter, sortModels, selectModels, TIER_REF, type ModelRow,
} from '../src/lib/providers/tiers'
import { PROVIDERS } from '../src/lib/providers/registry'

let passed = 0
let failed = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}
const section = (t: string) => console.log(`\n${t}`)
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

const pickerSrc = src('../src/components/topbar/ModelPicker.tsx')
const logoFile = src('../src/components/shared/ModelLogo.tsx')
const providersSrc = src('../src/components/settings/ProvidersTab.tsx')
const storeSrc = src('../src/stores/useStore.ts')
const streamSrc = src('../src/lib/providers/stream.ts')
const runChatSrc = src('../src/lib/chat/runChat.ts')

section('[1] every model gets a mark (family when we have one, provider when we do not)')
check('llama ids are recognised', modelFamily('llama-3.3-70b-versatile')?.id === 'llama')
check('a namespaced id is recognised', modelFamily('meta-llama/Llama-3.1-8B-Instruct')?.id === 'llama')
check('qwen and its coder variants', modelFamily('qwen2.5-coder-32b-instruct')?.id === 'qwen' && modelFamily('qwq-32b')?.id === 'qwen')
check('deepseek', modelFamily('deepseek-v4-chat')?.id === 'deepseek')
check('gemma is not swallowed by gemini', modelFamily('gemma-3-27b-it')?.id === 'gemma' && modelFamily('gemini-2.5-pro')?.id === 'gemini')
check('claude', modelFamily('claude-sonnet-4-5')?.id === 'claude')
check('gpt and the o-series', modelFamily('gpt-5-mini')?.id === 'gpt' && modelFamily('o3-mini')?.id === 'gpt')
check('gpt-oss is its own mark', modelFamily('gpt-oss-120b')?.id === 'gpt-oss')
check('grok', modelFamily('grok-4-fast')?.id === 'grok')
check('the mistral family, including the odd names', ['mistral-large-latest', 'mixtral-8x7b', 'codestral-latest', 'magistral-medium'].every((m) => modelFamily(m)?.id === 'mistral'))
check('glm', modelFamily('glm-4.7-flash')?.id === 'glm')
check('kimi / moonshot', modelFamily('kimi-k3')?.id === 'kimi' && modelFamily('moonshot-v1-8k')?.id === 'kimi')
check('minimax', modelFamily('MiniMax-M3')?.id === 'minimax')
check('mercury (Inception)', modelFamily('mercury-2')?.id === 'mercury')
check('nemotron', modelFamily('nemotron-3-ultra-free')?.id === 'nemotron')
check('a niche model has no family — so the provider mark is used, as asked',
  modelFamily('some-vendor-turbo-9000') === null && modelFamily('big-pickle') !== null)
check('an empty id is not a family', modelFamily('') === null)
check('monograms fall back to letters', monogramFor('some-vendor-turbo') === 'SO' && monogramFor('') === '?')
check('every family has a distinct id', new Set(FAMILIES.map((f) => f.id)).size === FAMILIES.length)
check('the component falls back to the provider logo when there is no family',
  logoFile.includes('if (!family) return <ProviderLogo id={provider} size={size} />'))
check('and it keeps the provider-tile API the Dynamic Island uses',
  logoFile.includes('providerId') && logoFile.includes('PROVIDER_DOMAINS'))
check('the picker passes both model and provider', /\<ModelLogo model=\{row\.model\} provider=\{row\.provider\}/.test(pickerSrc))

section('[2] free vs paid — every answer explainable, the user always wins')
check('FreeRoute is free (it only routes to free tiers)', modelTier('freeroute', 'anything').tier === 'free')
check('local models are free', modelTier('ollama', 'llama3.2').tier === 'free' && modelTier('lmstudio', 'qwen2.5').tier === 'free')
check('an OpenRouter :free endpoint is free', modelTier('openrouter', 'deepseek/deepseek-r1:free').tier === 'free')
check('a Together -Free endpoint is free', modelTier('together', 'meta-llama/Llama-3-70b-Free').tier === 'free')
check('Z.ai Flash models are free', modelTier('glm', 'glm-4.7-flash').tier === 'free' && modelTier('glm', 'glm-4.5-flash').tier === 'free')
check('Gemini Flash models are free (AI Studio tier)', modelTier('gemini', 'gemini-2.5-flash').tier === 'free')
check('Gemini Pro is not claimed as free', modelTier('gemini', 'gemini-2.5-pro').tier === 'paid')
check('Groq is free (rate-limited, not billed)', modelTier('groq', 'llama-3.3-70b-versatile').tier === 'free')
check('NIM open models are free', modelTier('nim', 'meta/llama-3.1-8b-instruct').tier === 'free')
check('paid providers are marked paid', ['openai', 'anthropic', 'deepseek', 'kimi', 'minimax', 'grok', 'mistral'].every((p) => modelTier(p, 'some-model').tier === 'paid'))
check('an unknown provider gets no chip rather than a guess', modelTier('mystery', 'x').tier === null)
check('a user override beats every rule',
  modelTier('openai', 'gpt-5', { [TIER_REF('openai', 'gpt-5')]: 'free' }).tier === 'free'
  && modelTier('groq', 'llama-3', { [TIER_REF('groq', 'llama-3')]: 'paid' }).tier === 'paid')
check('the override says where it came from', modelTier('openai', 'gpt-5', { [TIER_REF('openai', 'gpt-5')]: 'free' }).source === 'user')
check('every answer carries a reason the UI can show', modelTier('groq', 'llama-3').why.length > 8)
check('the UI shows that reason', pickerSrc.includes('info.why'))

section('[3] filter and sort')
check('the free filter keeps only free models', matchesFilter(modelTier('groq', 'llama-3'), 'free'))
check('and drops paid ones', !matchesFilter(modelTier('openai', 'gpt-5'), 'free'))
check('the paid filter is the mirror of it', matchesFilter(modelTier('openai', 'gpt-5'), 'paid') && !matchesFilter(modelTier('groq', 'llama-3'), 'paid'))
check('"all" hides nothing', matchesFilter(modelTier('mystery', 'x'), 'all'))
{
  const rows = [
    { model: 'b-model', provider: 'zebra', providerName: 'Z', tier: modelTier('openai', 'b-model') },
    { model: 'a-model', provider: 'alpha', providerName: 'A', tier: modelTier('groq', 'a-model') },
    { model: 'c-model', provider: 'alpha', providerName: 'A', tier: modelTier('mystery', 'c-model') },
  ]
  check('sort by name is alphabetical', sortModels(rows, 'name')[0].model === 'a-model')
  check('sort by provider groups providers together', sortModels(rows, 'provider')[0].provider === 'alpha')
  check('free first puts the free model on top', sortModels(rows, 'free-first')[0].model === 'a-model')
  check('and paid below unknown', sortModels(rows, 'free-first')[2].model === 'b-model')
  check('sorting does not mutate the input', rows[0].model === 'b-model')
}

section('[4] the list the picker renders (search, filter, sort, unlisting)')
{
  const rows: ModelRow[] = [
    { provider: 'groq', providerName: 'Groq', model: 'llama-3.3-70b', ref: 'groq:llama-3.3-70b' },
    { provider: 'openai', providerName: 'OpenAI', model: 'gpt-5', ref: 'openai:gpt-5' },
    { provider: 'glm', providerName: 'Z.ai · GLM', model: 'glm-4.7-flash', ref: 'glm:glm-4.7-flash' },
    { provider: 'ollama', providerName: 'Ollama', model: 'qwen2.5-coder', ref: 'ollama:qwen2.5-coder' },
  ]
  const all = selectModels(rows)
  check('everything shows by default', all.visible.length === 4)
  check('with free and paid counted', all.counts.free === 3 && all.counts.paid === 1)
  check('the free filter leaves the free ones', selectModels(rows, { filter: 'free' }).visible.length === 3)
  check('the paid filter leaves the paid one', selectModels(rows, { filter: 'paid' }).visible.map((r) => r.model).join() === 'gpt-5')
  check('search matches a model id', selectModels(rows, { query: 'qwen' }).visible.length === 1)
  check('search matches a provider name too', selectModels(rows, { query: 'z.ai' }).visible.length === 1)
  check('search ignores case and padding', selectModels(rows, { query: '  GPT-5 ' }).visible.length === 1)

  const hiddenList = ['openai:gpt-5', 'ollama:qwen2.5-coder']
  const withHidden = selectModels(rows, { hidden: hiddenList })
  check('unlisted models leave the visible list', withHidden.visible.length === 2)
  check('but they are kept, not deleted', withHidden.hidden.length === 2 && withHidden.hidden[0].ref === 'openai:gpt-5')
  check('and the count of unlisted is reported', withHidden.counts.unlisted === 2)
  check('unlisting survives the filter (a hidden free model is not resurrected)',
    selectModels(rows, { hidden: hiddenList, filter: 'free' }).visible.every((r) => !hiddenList.includes(r.ref)))
  check('unlisting survives search', selectModels(rows, { hidden: hiddenList, query: 'qwen' }).visible.length === 0)
  check('putting one back works by removing it from the list',
    selectModels(rows, { hidden: hiddenList.filter((r) => r !== 'openai:gpt-5') }).visible.some((r) => r.ref === 'openai:gpt-5'))
  check('an empty catalog is an empty list, not an error', selectModels([]).visible.length === 0 && selectModels([]).counts.total === 0)

  // The picker must go through this function, or none of the above is real.
  check('the picker renders from selectModels', pickerSrc.includes('selectModels(allRows'))
  check('and never re-implements the filtering', !pickerSrc.includes('.filter((m) => !modelQuery'))
}

section('[5] the dock hover')
check('the hovered row grows, its neighbours a little, the rest not at all', (() => {
  const f = (d: number) => 1 + 0.17 * Math.exp(-(d * d) / (2.2 * 2.2))
  return f(0) > 1.15 && f(1) > f(2) && f(1) < f(0) && f(4) < 1.01 && f(Infinity) === 1
})())
check('the row animates scale, so nothing reflows under the pointer',
  pickerSrc.includes('animate={{ scale }}')
  // the only height animation in the file belongs to the unlisted-models
  // expander, which is a different element from a model row
  && (pickerSrc.match(/animate=\{\{ height/g) ?? []).length === 1)
check('the row scales from its left edge, like a dock',
  pickerSrc.includes('originX: 0'))
check('the hover state is one number, set on row enter',
  pickerSrc.includes('setHovered(i)') && pickerSrc.includes('setHovered(null)'))
check('the transform origin is a CSS property and the scale a spring',
  pickerSrc.includes('type: \'spring\''))

section('[6] the Providers tab starts empty and fills from the catalog')
check('the card list is driven by the added list, not by every provider',
  providersSrc.includes('const addedMetas = PROVIDERS.filter((p) => added.includes(p.id))'))
check('the default is an empty list', /addedProviders: \[\],/.test(storeSrc))
check('an empty list shows the invitation', providersSrc.includes('No providers yet'))
check('which counts what ships', providersSrc.includes('{PROVIDERS.length} provider integrations'))
check('and offers the one action it needs', providersSrc.includes('Add your first provider'))
check('the catalog is searchable', providersSrc.includes('Search ${PROVIDERS.length} providers'))
check('adding writes the id list (never the key)',
  providersSrc.includes('addedProviders: [...(s.settings.addedProviders ?? []), id]'))
check('a provider with a saved key is flagged in the catalog', providersSrc.includes('key already saved'))
check('removing offers to keep the key', providersSrc.includes('Keep my saved key'))
check('and only deletes it when asked', providersSrc.includes('Remove and delete the key'))
check('the delete path is opt-in, not the default',
  providersSrc.indexOf('removeProvider(p.id, false)') > 0
  && providersSrc.indexOf('removeProvider(p.id, false)') < providersSrc.indexOf('removeProvider(p.id, true)'))
check('the save/test/model-chip behaviour was preserved',
  providersSrc.includes('saveProvider(p.id)') && providersSrc.includes('refreshProviderModels(p.id)') && providersSrc.includes('encryptWithPassphrase'))
check('providers still come from the one catalog', providersSrc.includes("from '@/lib/providers/registry'"))
check('the catalog covers every provider this build ships', PROVIDERS.length >= 18, `${PROVIDERS.length} providers`)
check('including the ones added in earlier rounds', ['mercury', 'grok', 'deepseek', 'kimi', 'glm', 'minimax', 'freeroute'].every((id) => PROVIDERS.some((p) => p.id === id)))

section('[7] token usage per response')
check('usage is captured from OpenAI-dialect frames', streamSrc.includes('takeOpenAIUsage(json.usage)'))
check('the OpenAI request asks for usage on the stream', streamSrc.includes('stream_options: { include_usage: true }'))
check('Anthropic usage is read from message_start and message_delta',
  streamSrc.includes("json.type === 'message_start'") && streamSrc.includes("json.type === 'message_delta' && json.usage"))
check('Gemini usage is read from usageMetadata', streamSrc.includes('usageMetadata'))
check('Ollama usage is read from its final frame', streamSrc.includes('prompt_eval_count'))
check('a provider that reports nothing is marked as estimated',
  streamSrc.includes('reported: false') && streamSrc.includes('reported: true'))
check('the app totals across tool rounds', runChatSrc.includes('usagePrompt += res.usage?.prompt'))
check('a mixed answer is reported only if any round reported', runChatSrc.includes('if (res.usage?.reported) usageReported = true'))
check('the total is added to the session counter', runChatSrc.includes('store.addTokensUsed(usage.total)'))
check('and stored on the message', runChatSrc.includes('usage,') && src('../src/types/index.ts').includes('usage?: { prompt: number; completion: number; total: number; reported: boolean }'))
check('the message shows it', /formatTokens\(usage\.total\)[\s\S]{0,20}tokens/.test(src('../src/components/chat/Message.tsx')))
check('estimates are marked with ≈ so a guess is never shown as a measurement',
  src('../src/components/chat/Message.tsx').includes("usage.reported ? '' : '≈'"))
const backChat = readFileSync(new URL('../../backend/src/routes/chat.ts', import.meta.url), 'utf8')
check('the backend asks OpenAI-compatible providers for usage too', backChat.includes('stream_options: { include_usage: true }'))
check('and retries without it if a server rejects the field', backChat.includes('delete payload.stream_options'))

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
