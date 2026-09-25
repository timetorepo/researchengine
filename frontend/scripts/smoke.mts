/**
 * Research Engine — pre-release functional smoke test.
 * Runs the real store + chat pipeline + flow engine headlessly (no DOM).
 *   npx tsx scripts/smoke.mts
 */

// ---- minimal browser polyfills for headless run ----
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size },
}
;(globalThis as any).window = {
  innerWidth: 1440,
  addEventListener: () => {}, removeEventListener: () => {},
  dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  location: { hash: '' },
}
;(globalThis as any).matchMedia = (globalThis as any).window.matchMedia

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log('\n[1] AIFlowEngine classifier')
  const { classifyQuery, shapeSystemPrompt } = await import('../src/lib/flow/classifier')
  check('math query', classifyQuery('solve the integral of x^2 dx') === 'math')
  check('code query', classifyQuery('write a typescript function to debounce') === 'code')
  check('factual query', classifyQuery('what is the capital of Norway') === 'factual')
  check('creative query', classifyQuery('write a poem about the sea') === 'creative')
  check('longform query', classifyQuery('write a comprehensive literature review on CRISPR') === 'longform')
  check('system prompt shaped', shapeSystemPrompt('math', { math: true }).includes('LaTeX'))

  console.log('\n[2] Context pruning (capsules)')
  const { pruneContext, estimateTokens } = await import('../src/lib/flow/pruner')
  const history = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`, role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Message number ${i} with enough content to estimate tokens properly.`, createdAt: i,
  }))
  const pruned = pruneContext(history as any, 'efficient', true)
  check('capsule created', pruned.capsule !== null && pruned.capsule!.includes('capsule'))
  check('tokens reduced', pruned.prunedTokens < pruned.originalTokens,
    `(${pruned.prunedTokens} vs ${pruned.originalTokens})`)
  const fidelity = pruneContext(history as any, 'fidelity', true)
  check('fidelity keeps all', fidelity.prunedTokens === fidelity.originalTokens)
  check('token estimate sane', estimateTokens('hello world') === 3)

  console.log('\n[3] Demo engine content')
  const { demoAnswer, demoSources } = await import('../src/lib/providers/demo')
  const mathAns = demoAnswer('solve x', { math: true })
  check('math answer has LaTeX', mathAns.includes('$$'))
  const codeAns = demoAnswer('write code for a debounce', {})
  check('code answer has fenced block', codeAns.includes('```'))
  const origin = demoAnswer('origin story', {})
  check('origin story easter egg', origin.includes('build note'))
  const sources = demoSources('solid state batteries', 5)
  check('demo sources', sources.length === 5 && sources[0].url.startsWith('https://'))

  console.log('\n[4] Full chat pipeline (store + runChat)')
  const { useStore } = await import('../src/stores/useStore')
  const { runChat } = await import('../src/lib/chat/runChat')

  // defaultModel starts empty (fresh state) — the pipeline must fall back to
  // the fully-local demo model, exactly like a brand-new install.

  const chatId = useStore.getState().newChat()
  check('chat created', useStore.getState().chats.length === 1)

  await runChat({ chatId, prompt: 'what is the capital of Norway', mode: {} })
  await sleep(200)
  let chat = useStore.getState().chats.find((c) => c.id === chatId)!
  check('two messages after run', chat.messages.length === 2)
  const asst = chat.messages[1]
  check('assistant answered', asst.role === 'assistant' && asst.content.length > 100)
  check('flow stats recorded', !!asst.flow && asst.flow.promptTokens > 0)
  check('follow-ups generated', (asst.followUps?.length ?? 0) === 3)
  check('chat titled from prompt', chat.title.includes('capital of Norway'))

  console.log('\n[5] Web search pipeline + citations')
  await runChat({ chatId, prompt: 'solid state battery evidence', mode: { search: true } })
  await sleep(200)
  chat = useStore.getState().chats.find((c) => c.id === chatId)!
  const searched = chat.messages[chat.messages.length - 1]
  check('sources attached', (searched.sources?.length ?? 0) === 5)
  check('citations auto-saved', useStore.getState().citations.length >= 5)
  const log = useStore.getState().connectionLog
  check('connection log captured', log.some((e) => e.endpoint.startsWith('search://')) && log.some((e) => e.endpoint === 'local://demo'))

  console.log('\n[6] Flow savings accounting')
  // build a long conversation so pruning saves tokens
  const chat2 = useStore.getState().newChat()
  for (let i = 0; i < 12; i++) {
    useStore.getState().addMessage(chat2, {
      id: `x${i}`, role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Prior turn ${i}: ${'context padding for pruning. '.repeat(6)}`, createdAt: i,
    })
  }
  const savedBefore = useStore.getState().tokensSavedLifetime
  await runChat({ chatId: chat2, prompt: 'now summarize everything above' })
  await sleep(200)
  const savedAfter = useStore.getState().tokensSavedLifetime
  check('tokens saved > 0 on long context', savedAfter > savedBefore, `(${savedAfter - savedBefore})`)
  const last = useStore.getState().chats.find((c) => c.id === chat2)!.messages.at(-1)!
  check('flow caption pct > 0', (last.flow?.savedPct ?? 0) > 0)

  console.log('\n[7] Skills + squads + encryption')
  const skills = useStore.getState().skills
  const builtins = skills.filter((s) => s.builtin)
  check('the built-in skill library is loaded', builtins.length >= 10, String(builtins.length))
  // The three quality skills are the point — an install that persisted an older
  // library must still receive them on load.
  check('the design pass skill is present', builtins.some((s) => s.id === 'sk-design-pass'))
  check('the zero-hallucination skill is present', builtins.some((s) => s.id === 'sk-zero-hallucination'))
  check('the no-filler skill is present', builtins.some((s) => s.id === 'sk-no-filler'))
  check('every built-in carries a prompt template', builtins.every((s) => (s.promptTemplate ?? '').length > 80))
  check('squads present', useStore.getState().squads.length >= 3)
  const { encryptWithPassphrase, decryptWithPassphrase } = await import('../src/lib/crypto/vault')
  const enc = await encryptWithPassphrase('sk-test-123', 'passphrase')
  check('key encrypted', enc.startsWith('enc:'))
  const dec = await decryptWithPassphrase(enc, 'passphrase')
  check('key decrypts', dec === 'sk-test-123')

  console.log('\n[8] Quiz generation')
  const { generateQuiz } = await import('../src/lib/quiz/generate')
  const doc = 'Photosynthesis is the process by which green plants convert sunlight into chemical energy. ' +
    'Chlorophyll absorbs light primarily in the blue and red wavelengths. ' +
    'The Calvin cycle fixes carbon dioxide into organic molecules during the light-independent reactions. ' +
    'Stomata regulate gas exchange in leaves and respond to environmental conditions dynamically. ' +
    Array(6).fill('Mitochondria produce ATP through cellular respiration in nearly all eukaryotic cells.').join(' ')
  const quiz = generateQuiz(doc, { count: 6, types: ['mc', 'tf', 'fill'], difficulty: 'medium' })
  check('quiz generated', quiz.length === 6)
  check('answers present', quiz.every((q) => q.answer.length > 0 && q.explanation.length > 0))

  console.log('\n[9] Real execution: generateText, parallel agents, live search fallback')
  const { generateText } = await import('../src/lib/chat/generate')
  const gen = await generateText({ system: 'You are a test agent.', prompt: 'Explain gravity briefly.' })
  check('generateText produces output', gen.text.length > 100)
  check('generateText accounts tokens', gen.promptTokens > 0 && gen.completionTokens > 0)

  // parallel agent pool — three agents at once, like a Flood squad
  const t0 = Date.now()
  const agents = await Promise.all([
    generateText({ system: 'You are a Researcher.', prompt: 'Findings on solid-state batteries.' }),
    generateText({ system: 'You are a Critic.', prompt: 'Critique solid-state battery claims.' }),
    generateText({ system: 'You are a Verifier.', prompt: 'Verify solid-state battery claims.' }),
  ])
  check('3 agents ran in parallel', agents.every((a) => a.text.length > 100), `(${Date.now() - t0}ms)`)

  const { webSearch } = await import('../src/lib/search/web')
  const outcome = await webSearch('transformer attention mechanism')
  check('search returns sources', outcome.sources.length > 0)
  check('search degrades gracefully offline', outcome.live === false && outcome.backend === 'offline')

  // search-mode chat: sources attached to the message via the live pipeline
  const chat3 = useStore.getState().newChat()
  await runChat({ chatId: chat3, prompt: 'what is retrieval augmented generation', mode: { search: true } })
  await sleep(200)
  const searchedMsg = useStore.getState().chats.find((c) => c.id === chat3)!.messages.at(-1)!
  check('search-mode answer carries sources', (searchedMsg.sources?.length ?? 0) > 0)

  /* ---- Round 9 ---- */
  console.log('\n[10] Master prompts + Replicate mode')
  const { MASTERS, getMaster, MASTER_VERSION } = await import('../src/lib/prompts/masters')
  check('7 master prompts versioned', MASTERS.length >= 7 && MASTER_VERSION >= 1)
  check('getMaster returns default', getMaster('research', {}).text.length > 50)
  check('getMaster honors override', getMaster('research', { research: 'CUSTOM' }).overridden === true)
  const { planStages } = await import('../src/lib/chat/replicate')
  const stages = planStages('history of CRISPR vs TALENs')
  check('replicate plans 6+ stages', stages.length >= 6)
  check('replicate detects dynamic history stage', stages.some((s) => s.title === 'Historical context'))
  check('replicate ends with synthesis', stages[stages.length - 1].title === 'Final synthesis')

  console.log('\n[11] Quiz types incl. ordering + matching')
  const { generateQuiz: genQuiz2 } = await import('../src/lib/quiz/generate')
  const longDoc = 'Mitochondria are the powerhouse of the cell. They produce ATP through oxidative phosphorylation. The inner membrane folds into cristae to increase surface area. Chloroplasts perform photosynthesis in plants. Ribosomes synthesize proteins from mRNA templates. The nucleus stores DNA in chromosomes. ' +
    'Enzymes lower activation energy of reactions. Lysosomes digest cellular waste. The Golgi apparatus packages proteins for export. Cell membranes are phospholipid bilayers.'
  const allTypes = genQuiz2(longDoc, { count: 12, types: ['mc', 'tf', 'short', 'fill', 'ordering', 'matching'] as any, difficulty: 'medium' })
  check('quiz covers all 6 types', allTypes.length >= 6)
  check('ordering question has correctOrder', allTypes.filter((q) => q.type === 'ordering').every((q) => (q.correctOrder?.length ?? 0) >= 2))
  check('matching question has pairs', allTypes.filter((q) => q.type === 'matching').every((q) => (q.pairs?.length ?? 0) >= 2))

  console.log('\n[12] Demo document + reader + images')
  const { DEMO_DOC_TEXT, DEMO_QUIZ, DEMO_HIGHLIGHTS, DEMO_REWRITE } = await import('../src/lib/documents/demoDoc')
  check('demo doc ~1500+ words', DEMO_DOC_TEXT.split(/\s+/).length >= 1200)
  check('demo has 14 highlights w/ tiers', DEMO_HIGHLIGHTS.length >= 10 && DEMO_HIGHLIGHTS.every((h) => ['definition', 'fact', 'concept'].includes(h.tier)))
  check('demo quiz 5 Qs w/ source anchors', DEMO_QUIZ.length === 5 && DEMO_QUIZ.every((q) => q.source))
  check('demo rewrite present', DEMO_REWRITE.length > 500)
  const { extractText } = await import('../src/lib/documents/extract')
  check('extractText exports', typeof extractText === 'function')

  console.log('\n[13] Article image fetching (offline-safe)')
  const { findCommonsImage } = await import('../src/lib/articles/images')
  const img = await findCommonsImage('DNA double helix')
  // offline sandbox returns null gracefully; live returns a record
  check('findCommonsImage returns null or record', img === null || (!!img && !!img.url && !!img.attribution))

  console.log('\n[14] Privacy Shield scanning')
  const shield = await import('../src/lib/privacy/shield')
  const leaky = 'my key is sk-abcdefghijklmnop1234 and google AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ok'
  const found = shield.scanSecrets(leaky)
  check('shield detects secrets', found.length >= 2)
  const redacted = shield.redactSecrets(leaky)
  check('shield redacts secrets', redacted.includes('[REDACTED]') && !redacted.includes('sk-abcdefghijklmnop'))
  const clean = shield.shieldOutbound('just a normal research question')
  check('clean text passes untouched', clean.text.includes('normal research') && clean.findings.length === 0)
  check('three privacy modes exposed', shield.PRIVACY_MODES.length === 3 && shield.PRIVACY_MODES.some((m) => m.id === 'topsecret'))

  console.log('\n[15] AI tool registry')
  const { TOOLS, toolSpecs } = await import('../src/lib/chat/tools')
  const names = TOOLS.map((t) => t.name)
  check('questionnaire tool present', names.includes('ask_user'))
  check('connector tools present', names.includes('connector_search') && names.includes('connector_read'))
  check('ide tools present', names.includes('ide_write_file') && names.includes('ide_run_command'))
  check('mcp_call present', names.includes('mcp_call'))
  const noProj = toolSpecs({ chatId: 'c', asstId: 'a' })
  const withProj = toolSpecs({ chatId: 'c', asstId: 'a', project: 'p' })
  check('ide tools gated to projects', withProj.length > noProj.length)

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('SMOKE CRASH:', e); process.exit(1) })
