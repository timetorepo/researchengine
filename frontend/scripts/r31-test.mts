/**
 * R31 — the multitasking round: sessions with an iOS-style switcher, docker/vm
 * isolation, the mcpservers-scale catalog everywhere, effort + chain of
 * thought, vendored personas and skills, the Codex-flavoured changes rail,
 * brand doctrine, and the 60fps work.
 *
 * Run: node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/r31-test.mts   (from frontend/)
 */
import { readFileSync, existsSync } from 'node:fs'
import { PERSONAS_MANIFEST } from '../src/content/personas/manifest'
const personaBySlug = (slug: string) => PERSONAS_MANIFEST.find((p) => p.slug === slug)
const CODING_PERSONA_SLUG = 'openai-codex-gpt-6-astra'
import { SKILL_PACKS } from '../src/content/skills/catalog'
import { MCP_SEED, searchCatalog } from '../src/lib/mcp/catalog'

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const src = (p: string) => readFileSync(p, 'utf8')

console.log('\n— Persona archive —')
{
  check('the manifest names the whole archive', PERSONAS_MANIFEST.length >= 800)
  check('17 vendors are represented', new Set(PERSONAS_MANIFEST.map((p) => p.vendor)).size >= 15)
  const astra = personaBySlug(CODING_PERSONA_SLUG)
  check('the Codex astra prompt is vendored', !!astra?.vendored && astra.chars > 100000)
  check('vendored flag marks a curated minority', PERSONAS_MANIFEST.filter((p) => p.vendored).length >= 20 && PERSONAS_MANIFEST.filter((p) => p.vendored).length < 60)
  check('every vendored slug has its text on disk', PERSONAS_MANIFEST.filter((p) => p.vendored).every((p) => existsSync(`src/content/personas/text/${p.slug}.md`)))
  const chat = src('src/lib/chat/runChat.ts')
  check('coding chats default to the astra voice', chat.includes('CODING_PERSONA_SLUG'))
  check('personas layer on top of the base prompt', chat.includes('# Persona (follow its voice and rules'))
  check('the sync script mirrors the full archive', src('scripts/sync-personas.mjs').includes('system_prompts_leaks'))
}

console.log('\n— Skills, vendored in full —')
{
  check('the emil set is all here', SKILL_PACKS.filter((p) => p.origin === 'emilkowalski/skills').length >= 13)
  check('apple-design ships verbatim', !!SKILL_PACKS.find((p) => p.id === 'apple-design') && existsSync('src/content/skills/upstream/apple-design/SKILL.md'))
  const illust = SKILL_PACKS.find((p) => p.id === 'ian-xiaohei-illustrations')
  check('the illustration pack carries the cross-model adapter', !!illust && illust.files.includes('MODEL-ADAPTERS.md'))
  check('the adapter speaks to other models', src('src/content/skills/upstream/ian-xiaohei-illustrations/MODEL-ADAPTERS.md').includes('outside Codex'))
  check('chats attach packs into the context', src('src/lib/chat/runChat.ts').includes('packText'))
}

console.log('\n— The MCP catalog, everywhere —')
{
  check('the seed holds thousands of servers', MCP_SEED.length > 4000)
  check('search ranks name prefix first', searchCatalog(MCP_SEED, 'filesystem', 5)[0]?.name.toLowerCase().includes('filesystem'))
  const panel = src('src/components/ide/McpPanel.tsx')
  check('the coding panel browses the catalog', panel.includes('searchCatalog') && panel.includes('The catalog'))
  check('live refresh targets mcpservers.org and degrades honestly', src('src/lib/mcp/catalog.ts').includes('mcpservers.org/api/servers') && panel.includes('seed kept'))
  check('settings now hosts MCP too', src('src/components/settings/settingsTabs.tsx').includes("case 'mcp'"))
  check('chats already get the tools', src('src/lib/chat/tools.ts').includes('mcp_call'))
}

console.log('\n— Sessions: switcher, isolation, concurrency —')
{
  const sw = src('src/components/sessions/SessionSwitcher.tsx')
  check('the default combo is alt+shift', sw.includes("'alt+shift'"))
  check('the cards spring like an app switcher', sw.includes("type: 'spring'") && sw.includes('backdropFilter'))
  check('step with the combo, land with enter', sw.includes("setIdx((i) => (i + 1) % Math.max(1, list.length))") && sw.includes("e.key === 'Enter'"))
  check('live sessions keep streaming away', sw.includes('isStreamingChat'))
  check('the shortcut is rebindable in settings', src('src/components/settings/ShortcutsTab.tsx').includes('sessionSwitchKey'))
  const sb = src('../backend/src/routes/sandbox.ts')
  check('the probe reports docker and vm honestly', sb.includes('/probe') && sb.includes('no hypervisor CLI'))
  check('containers are capped and per-session', sb.includes('--memory') && sb.includes('re-session-'))
  check('exec is sandbox-only', sb.includes("'exec'"))
  check('the chats page offers isolation', src('src/components/chats/ChatsView.tsx').includes('IsolationButton'))
  check('streams are keyed per chat (parallel sessions)', src('src/lib/chat/runChat.ts').includes('const activeStreams = new Map<string, AbortController>()'))
}

console.log('\n— Effort and chain of thought —')
{
  const chat = src('../backend/src/routes/chat.ts')
  check('claude gets output_config.effort', chat.includes('output_config = { effort: anthropicEffort }'))
  check('openai gets reasoning_effort', chat.includes('reasoning_effort = openaiEffort'))
  check('gemini gets includeThoughts', chat.includes('includeThoughts: true'))
  check('unknown effort fields retry away', chat.includes('delete payload.reasoning_effort') && chat.includes('delete payload.thinking'))
  const stream = src('src/lib/providers/stream.ts')
  check('anthropic thinking deltas surface', stream.includes('thinking_delta'))
  check('openai reasoning fields surface', stream.includes('reasoning_content'))
  check('gemini thought parts surface', stream.includes('p.thought'))
  const msg = src('src/components/chat/Message.tsx')
  check('the thinking block collapses', msg.includes('function ThinkingBlock') && msg.includes('Chain of thought'))
  check('the effort pill spans the ladder', src('src/components/input/InputBar.tsx').includes("'xhigh'") && src('src/components/input/InputBar.tsx').includes('Instant'))
  check('instant skips asking for thought', src('src/lib/chat/runChat.ts').includes("thinking: effortLevel !== 'instant'"))
}

console.log('\n— The coding rail and app actions —')
{
  const cv = src('src/components/ide/CodingView.tsx')
  check('the dock gains a Changes tab', cv.includes("id: 'changes'") && cv.includes('<ChangesPanel project={project} />'))
  const cp = src('src/components/ide/ChangesPanel.tsx')
  check('diffs render green and red', cp.includes("l.startsWith('+')") && cp.includes("l.startsWith('-')"))
  check('commit is explicit and local-only', cp.includes('/api/ide/git/commit') && !/git push|\/git\/push/.test(cp))
  const ide = src('../backend/src/routes/ide.ts')
  check('status, diff and commit endpoints exist', ide.includes("'/git/status'") && ide.includes("'/git/diff'") && ide.includes("'/git/commit'"))
  const msg = src('src/components/chat/Message.tsx')
  check('the AI can open Read, Quiz and Coding', msg.includes('sectionActions') && msg.includes('re-navigate'))
  check('runChat teaches the marker protocol', src('src/lib/chat/runChat.ts').includes('[RE:open:quiz]'))
  check('markers never leak into the copy', msg.includes('stripMarkers(msg.content)'))
}

console.log('\n— Brand and performance —')
{
  const brand = src('../docs/BRAND.md')
  check('the brand doctrine is written down', brand.includes('nominative use') && brand.includes('Not affiliated'))
  check('the About tab carries the independence line', src('src/components/settings/AboutTab.tsx').includes('not affiliated with, endorsed by, or connected to'))
  check('transfer guides map the other products', brand.includes('They get here'))
  const cv = src('src/components/chat/ChatView.tsx')
  check('long chats render a window', cv.includes('slice(-60)') && cv.includes('earlier messages'))
  check('rows stay content-visibility auto', src('src/styles/globals.css').includes('.msg-row { content-visibility: auto'))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('failed:', fails.join(' | ')); process.exit(1) }
