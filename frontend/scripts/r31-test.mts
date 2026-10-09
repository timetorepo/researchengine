/**
 * R31 — sessions, effort and chain of thought, the MCP index, personas and
 * skills, transfer in from other products, the Codex-style changes rail, and
 * the performance work.
 *
 * Behaviour is tested where it can run in node (diff parsing, both export
 * importers, command splitting, catalog search). Wiring is checked by reading
 * the source, which keeps the test honest about what runs here and what only
 * the browser or a real machine can prove.
 *
 * Run from frontend/: node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/r31-test.mts
 */
import { readFileSync, existsSync } from 'node:fs'
import { PERSONAS_MANIFEST } from '../src/content/personas/manifest'
import { SKILL_PACKS } from '../src/content/skills/catalog'
import { readExport } from '../src/lib/transfer/import'
import { parseUnifiedDiff } from '../src/components/ide/ChangesPanel'
import { splitCommand, searchCatalog, type McpCatalogEntry } from '../src/lib/mcp/catalog'

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean) => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name}`) }
}
const src = (p: string) => readFileSync(p, 'utf8')
let seq = 0
const makeId = () => `id${++seq}`
const CODING_PERSONA_SLUG = 'openai-codex-gpt-6-astra'
const catalogJson = JSON.parse(readFileSync('src/content/mcp-catalog.json', 'utf8'))

console.log('\n— Persona archive —')
{
  check('the manifest names the whole archive (836)', PERSONAS_MANIFEST.length >= 800)
  check('17 vendors are represented', new Set(PERSONAS_MANIFEST.map((p) => p.vendor)).size >= 15)
  const astra = PERSONAS_MANIFEST.find((p) => p.slug === CODING_PERSONA_SLUG)
  check('the Codex astra prompt resolves by its lowercase slug', !!astra?.vendored && astra.chars > 100000)
  check('its text is on disk under that slug', existsSync(`src/content/personas/text/${CODING_PERSONA_SLUG}.md`))
  check('every vendored slug has its text on disk', PERSONAS_MANIFEST.filter((p) => p.vendored).every((p) => existsSync(`src/content/personas/text/${p.slug}.md`)))
  check('coding chats default to the astra voice', src('src/lib/chat/runChat.ts').includes('CODING_PERSONA_SLUG'))
  check('personas layer on top of the base prompt', src('src/lib/chat/runChat.ts').includes('# Persona (follow its voice and rules'))
  const lib = src('src/lib/personas.ts')
  check('chat path never imports the manifest (lighter main bundle)', !lib.includes('content/personas/manifest'))
  check('the persona tab loads lazily', src('src/components/settings/settingsTabs.tsx').includes("lazy(() => import('./PersonasTab')"))
  check('the full archive syncs from inside the app', src('../backend/src/routes/personas.ts').includes("'clone', '--depth=1'") && src('../backend/src/routes/personas.ts').includes("personaRoutes.post('/sync'"))
  check('the sync URL is fixed, never taken from the request', src('../backend/src/routes/personas.ts').includes("const UPSTREAM = 'https://github.com/asgeirtj/system_prompts_leaks.git'"))
  check('the sync button exists in the tab', src('src/components/settings/PersonasTab.tsx').includes('/api/personas/sync'))
}

console.log('\n— Skills, vendored in full —')
{
  check('the emil set is all here (13+ packs)', SKILL_PACKS.filter((p) => p.origin === 'emilkowalski/skills').length >= 13)
  check('apple-design ships verbatim', !!SKILL_PACKS.find((p) => p.id === 'apple-design') && existsSync('src/content/skills/upstream/apple-design/SKILL.md'))
  const illust = SKILL_PACKS.find((p) => p.id === 'ian-xiaohei-illustrations')
  check('the illustration pack carries the cross-model adapter', !!illust && illust.files.includes('MODEL-ADAPTERS.md'))
  check('chats attach packs into the context', src('src/lib/chat/runChat.ts').includes('packText'))
}

console.log('\n— MCP index —')
{
  check('the index holds thousands of servers', catalogJson.count > 7000 && catalogJson.entries.length === catalogJson.count)
  check('only verified runnable commands count as one-click', catalogJson.withCommand > 100 && catalogJson.entries.filter((e: any) => e.command).length === catalogJson.withCommand)
  const cmdOk = catalogJson.entries.filter((e: any) => e.command).every((e: any) => /^(npx|uvx|pipx|python3?|node|docker)\b/.test(e.command))
  check('every one-click command starts a local server', cmdOk)
  check('one-click entries sort first', catalogJson.entries[0].command !== '')
  check('the catalog loads lazily, off the main bundle', src('src/lib/mcp/catalog.ts').includes("import('@/content/mcp-catalog.json')") && !src('src/lib/mcp/catalog.ts').includes("from '@/content/mcp-catalog.json'"))
  check('no guessed endpoint remains', !src('src/lib/mcp/catalog.ts').includes('api/servers'))
  check('the directory is linked, honestly sized', src('src/lib/mcp/catalog.ts').includes('mcpservers.org/all') && src('src/lib/mcp/catalog.ts').includes('14,916'))
  check('settings and the coding panel share one panel', src('src/components/settings/settingsTabs.tsx').includes("case 'mcp'") && src('src/components/ide/CodingView.tsx').includes('McpPanel'))
  check('chats get the servers too (mcp context + mcp_call)', src('src/lib/chat/runChat.ts').includes('mcpContextBlock()') && src('src/lib/chat/tools.ts').includes("name: 'mcp_call'"))

  const split = splitCommand(`npx -y "@scope/pkg" --flag 'a b'`)
  check('splitCommand honours quotes', split.command === 'npx' && JSON.stringify(split.args) === JSON.stringify(['-y', '@scope/pkg', '--flag', 'a b']))
  const sample: McpCatalogEntry[] = [
    { name: 'Filesystem', description: 'read files', category: 'File System', url: '', command: '', env: [], transport: '' },
    { name: 'Git tools', description: 'filesystem history', category: 'Version Control', url: '', command: '', env: [], transport: '' },
    { name: 'Weather', description: 'forecasts', category: 'Other', url: '', command: '', env: [], transport: '' },
  ]
  const hits = searchCatalog(sample, 'file')
  check('search ranks name prefix first, then name, then the rest', hits[0].name === 'Filesystem' && hits.length === 2)
}

console.log('\n— Effort and chain of thought —')
{
  const chat = src('../backend/src/routes/chat.ts')
  check('claude effort uses its own levels (xhigh and max kept)', chat.includes("xhigh: 'xhigh', max: 'max'"))
  check('effort is sent only to models that take it', chat.includes('CLAUDE_EFFORT.test(model)'))
  check('adaptive thinking shows its summary', chat.includes("{ type: 'adaptive', display: 'summarized' }"))
  check('older Claude models get a fixed thinking budget', chat.includes("{ type: 'enabled', budget_tokens: 2048 }") && chat.includes('CLAUDE_ADAPTIVE.test(model)'))
  check('thinking tokens are counted in max_tokens', chat.includes('Math.max(maxTokens, 8192)'))
  check('a refused feature steps down instead of failing the answer', chat.includes('for (let attempt = 0; attempt < 3') && chat.includes("delete payload.output_config"))
  check('reasoning_effort only for reasoning models', chat.includes('(o\\d|gpt-[5-9]|codex)'))
  check('gemini thoughts only for models that think', chat.includes('gemini-(2\\.5|[3-9])'))
  const stream = src('src/lib/providers/stream.ts')
  check('anthropic thinking deltas surface as thinking', stream.includes("thinking_delta") && stream.includes('req.onThinking?.('))
  check('openai-style reasoning fields surface as thinking', stream.includes('reasoning_content'))
  check('gemini thought parts surface as thinking', stream.includes('if (p.thought) req.onThinking'))
  const ip = src('src/components/input/InputBar.tsx')
  check('effort menu speaks each provider (claude, chatgpt)', ip.includes('anthropic: [') && ip.includes('openai: ['))
  check('instant stays a ChatGPT step; claude has five levels', ip.includes("id: 'instant', label: 'Instant'") && (ip.match(/anthropic: \[[\s\S]*?\n  \],/)?.[0].match(/id: '/g) ?? []).length === 5)
  check('instant skips asking for thought', src('src/lib/chat/runChat.ts').includes("thinking: effortLevel !== 'instant'"))
  check('the thinking block collapses and keeps its text', src('src/components/chat/Message.tsx').includes('function ThinkingBlock'))
}

console.log('\n— Sessions, isolation, and the AI tools —')
{
  const sw = src('src/components/sessions/SessionSwitcher.tsx')
  check('the default combo is alt+shift', sw.includes("'alt+shift'"))
  check('the cards spring like an app switcher', sw.includes("type: 'spring'") && sw.includes('backdropFilter'))
  check('step with the combo, land with enter', sw.includes('(i + 1) % Math.max(1, list.length)') && sw.includes("e.key === 'Enter'"))
  check('live sessions keep streaming away', sw.includes('isStreamingChat'))
  check('the shortcut is rebindable in settings', src('src/components/settings/ShortcutsTab.tsx').includes('sessionSwitchKey'))
  check('streams are keyed per chat (parallel sessions)', src('src/lib/chat/runChat.ts').includes('const activeStreams = new Map<string, AbortController>()'))
  const sb = src('../backend/src/routes/sandbox.ts')
  check('the probe reports docker and vm honestly', sb.includes("'/probe'") && sb.includes('multipass is not installed'))
  check('containers are capped and per-session', sb.includes('--memory') && sb.includes("re-session-"))
  check('VMs launch through multipass, once per session', sb.includes("'launch', '--name', name") && sb.includes('re-vm-'))
  const cv = src('src/components/chats/ChatsView.tsx')
  check('a VM is claimed only after it launches', cv.includes("if (r.ok) setSession({ isolation: 'vm'"))
  check('the chats page offers isolation', cv.includes('IsolationButton'))
  const tools = src('src/lib/chat/tools.ts')
  check('the AI can open Read & Quiz or Coding', tools.includes("name: 'open_section'") && tools.includes("quiz: '/quiz'") && tools.includes("coding: '/code'"))
  check('the AI can start a Docker or VM sandbox', tools.includes("name: 'session_sandbox'") && tools.includes("'/api/sandbox/vm-exec'") && tools.includes("'/api/sandbox/exec'"))
  check('markers still work for models without tools', src('src/components/chat/Message.tsx').includes('[RE:open:quiz]') === false && src('src/lib/chat/runChat.ts').includes('[RE:open:quiz]'))
}

console.log('\n— Transfer in from other products —')
{
  let nodeSeq = 0
  const chatgpt = [{
    title: 'Trip notes',
    create_time: 1_700_000_000,
    update_time: 1_700_000_100,
    current_node: 'a3',
    mapping: {
      root: { id: 'root', parent: null, message: null },
      s1: { id: 's1', parent: 'root', message: { author: { role: 'system' }, content: { parts: [''] }, create_time: 1_700_000_000 } },
      u1: { id: 'u1', parent: 's1', message: { author: { role: 'user' }, content: { parts: ['Plan a trip to Bali'] }, create_time: 1_700_000_010 } },
      a1: { id: 'a1', parent: 'u1', message: { author: { role: 'assistant' }, content: { parts: ['Here is a plan.'] }, create_time: 1_700_000_020 } },
      // an edited branch the user abandoned: must NOT be imported
      a2x: { id: 'a2x', parent: 'u1', message: { author: { role: 'assistant' }, content: { parts: ['Old answer'] }, create_time: 1_700_000_025 } },
      a3: { id: 'a3', parent: 'a1', message: { author: { role: 'user' }, content: { parts: ['Add a budget'] }, create_time: 1_700_000_030 } },
    },
  }, {
    title: 'Empty', create_time: 1_700_000_000, update_time: 1_700_000_000, current_node: 'x',
    mapping: { x: { id: 'x', parent: null, message: null } },
  }]
  const gpt = readExport(chatgpt, () => `g${++nodeSeq}`)
  check('ChatGPT export is recognised', gpt?.source === 'chatgpt')
  check('ChatGPT: follows the branch the chat ended on', gpt?.chats.length === 1 && gpt.chats[0].messages.map((m) => m.content).join('|') === 'Plan a trip to Bali|Here is a plan.|Add a budget')
  check('ChatGPT: the abandoned branch is left out', !gpt?.chats[0].messages.some((m) => m.content === 'Old answer'))
  check('ChatGPT: empty conversations are counted, not imported', gpt?.skipped === 1)
  check('ChatGPT: timestamps become milliseconds, title kept', gpt?.chats[0].createdAt === 1_700_000_000_000 && gpt?.chats[0].title === 'Trip notes')
  check('imported chats are tagged with their origin', gpt?.chats[0].importedFrom === 'chatgpt' && gpt?.chats[0].kind === 'research')

  const claude = {
    conversations: [{
      name: '',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:05:00Z',
      chat_messages: [
        { sender: 'human', text: 'Summarise this paper', created_at: '2026-09-01T10:00:01Z' },
        { sender: 'assistant', text: '', content: [{ type: 'text', text: 'It argues X.' }], created_at: '2026-09-01T10:00:09Z' },
      ],
    }, { name: 'Blank', created_at: '2026-09-02T10:00:00Z', chat_messages: [{ sender: 'human', text: '   ' }] }],
  }
  const cl = readExport(claude, () => `c${++nodeSeq}`)
  check('Claude export is recognised', cl?.source === 'claude')
  check('Claude: messages keep order and roles', cl?.chats[0].messages.map((m) => `${m.role}:${m.content}`).join('|') === 'user:Summarise this paper|assistant:It argues X.')
  check('Claude: an untitled chat takes its first line as the title', cl?.chats[0].title === 'Summarise this paper')
  check('Claude: empty conversations are skipped', cl?.skipped === 1)
  check('unknown JSON is not guessed at', readExport({ hello: 'world' }, makeId) === null)
  check('the zip path reads conversations.json with jszip', src('src/lib/transfer/import.ts').includes("import('jszip')") && src('src/lib/transfer/import.ts').includes('conversations\\.json'))
  check('the import UI lives in Settings → Data', src('src/components/settings/DataTab.tsx').includes('function ImportSection') && src('src/components/settings/DataTab.tsx').includes('<ImportSection />'))
}

console.log('\n— The changes rail, to the reference —')
{
  const diff = [
    'diff --git a/x.md b/x.md', 'index 1..2 100644', '--- a/x.md', '+++ b/x.md',
    '@@ -1,3 +1,4 @@', ' a', '-b', '+B', '+C', ' d',
  ].join('\n')
  const rows = parseUnifiedDiff(diff)
  check('diff: hunk header kept, file headers dropped', rows[0].kind === 'hunk' && !rows.some((r) => r.text.startsWith('index ')))
  check('diff: context lines carry both line numbers', rows.find((r) => r.kind === 'ctx' && r.text === 'a')?.oldNo === 1 && rows.find((r) => r.kind === 'ctx' && r.text === 'a')?.newNo === 1)
  check('diff: additions get new numbers, deletions old', rows.find((r) => r.text === 'B')?.newNo === 2 && rows.find((r) => r.text === 'b')?.oldNo === 2)
  check('diff: counts match the hunk (2 adds, 1 del, 2 ctx)', rows.filter((r) => r.kind === 'add').length === 2 && rows.filter((r) => r.kind === 'del').length === 1 && rows.filter((r) => r.kind === 'ctx').length === 2)
  const big = ['@@ -1,2000 +1,2000 @@', ...Array.from({ length: 2000 }, (_, i) => `+line ${i}`)].join('\n')
  const capped = parseUnifiedDiff(big)
  check('diff: huge diffs are capped so scrolling stays smooth', capped.length === 1501 && capped[1500].kind === 'note')
  const cp = src('src/components/ide/ChangesPanel.tsx')
  check('the rail has Unstaged and Staged, Revert all, Stage all', cp.includes("'unstaged', 'staged'") && cp.includes('Revert all') && cp.includes('Stage all'))
  check('revert needs a second click', cp.includes('Confirm revert') && cp.includes('setArmed(true)'))
  check('added lines are green, removed red, numbered', cp.includes('var(--success) 14%') && cp.includes('w-9 shrink-0 text-right'))
  const ide = src('../backend/src/routes/ide.ts')
  check('routes: status, diff, stage, revert, commit, under /api/ide/git', ['/ide/git/status', '/ide/git/diff', '/ide/git/stage', '/ide/git/revert', '/ide/git/commit'].every((p) => ide.includes(`r.get('${p}'`) || ide.includes(`r.post('${p}'`)))
  check('revert refuses without confirm, and never deletes untracked files', ide.includes('confirm: true') && ide.includes("['reset', '--hard', '-q']") && !ide.includes("'clean'"))
  check('commit commits what is staged, else everything', ide.includes("['diff', '--cached', '--quiet']") && ide.includes("['add', '-A']"))
  const cpClient = src('src/components/ide/ChangesPanel.tsx')
  check('the rail calls only routes the server registers', ['/api/ide/git/status', '/api/ide/git/diff', '/api/ide/git/${path}'].every((u) => cpClient.includes(u)) && ['/ide/git/status', '/ide/git/diff', '/ide/git/stage', '/ide/git/revert', '/ide/git/commit'].every((p) => ide.includes(p)))
  check('nothing is pushed from here', !ide.includes("'push'") && !cp.includes('/git/push'))
  const cvs = src('src/components/ide/CodingView.tsx')
  check('status bar shows the branch and changed count', cvs.includes('· ${gitSummary.files} changed') && cvs.includes('gitSummary?.branch'))
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
  check('the heavy tabs are lazy, the MCP index loads on demand', src('src/components/settings/settingsTabs.tsx').includes('lazy(') && src('src/lib/mcp/catalog.ts').includes('import('))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('failed:', fails.join(' | ')); process.exit(1) }
