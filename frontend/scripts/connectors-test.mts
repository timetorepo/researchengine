/**
 * Connector access for the bots, checked in Node against src/lib/bots/logic.ts
 * (the browser side of Composio and the integrations is exercised by the app).
 *
 *  1. Tool lines: FIND, APPS, TOOLS and RUN are read with their arguments.
 *  2. Strict: only uppercase keywords with a colon count, so ordinary prose is an answer.
 *  3. RUN: the action name must look like a Composio slug (case is folded), and its arguments must be a JSON object.
 *  4. Web lines are still gated by web access; connector lines are not.
 *  5. Prompts: connector instructions are always present; the no-browse line only when web is off.
 *  6. Stripping removes every tool line and keeps the answer.
 *  7. Composio input rules: app and tool slugs, and user ids, are checked before they go anywhere.
 *
 * Run: npm run connectors-test --workspace frontend
 */
import { buildSystemPrompt, createBot, findToolCall, stripToolLines, MAX_TOOL_STEPS } from '../src/lib/bots/logic.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const NOW = Date.UTC(2026, 9, 23, 9, 0)
const bot = createBot({ name: 'Ana', job: 'Keeps my inbox sorted' }, NOW, 'b1')

console.log('1. Tool lines')
const find = findToolCall('Let me check.\nFIND: invoice from acme') as any
check('a FIND line is read', find?.kind === 'find' && find.query === 'invoice from acme')
check('an APPS line needs no argument', (findToolCall('APPS:') as any)?.kind === 'apps')
check('an APPS line may stand alone', (findToolCall('APPS') as any)?.kind === 'apps')
check('a TOOLS line names the app in lowercase', (findToolCall('TOOLS: Gmail') as any)?.app === 'gmail')
const run = findToolCall('RUN: GMAIL_FETCH_EMAILS {"max_results": 5}') as any
check('a RUN line reads the action name', run?.kind === 'run' && run.tool === 'GMAIL_FETCH_EMAILS')
check('a RUN line reads its JSON arguments', run?.args?.max_results === 5)
check('a RUN line with no arguments gets an empty object', (findToolCall('RUN: SLACK_LIST_CHANNELS') as any)?.args && Object.keys((findToolCall('RUN: SLACK_LIST_CHANNELS') as any).args).length === 0)

console.log('2. Strict')
check('ordinary prose with “Run:” is an answer', findToolCall('Run: npm test to check it.') === null)
check('ordinary prose with “Find:” is an answer', findToolCall('Find: the cheapest option is B.') === null)
check('a lowercase “find:” is an answer', findToolCall('find: the file') === null)
check('a sentence that mentions FIND without a colon is an answer', findToolCall('I could FIND it later.') === null)

console.log('3. RUN checks')
check('a RUN with non-JSON arguments is refused', findToolCall('RUN: GMAIL_SEND_EMAIL not json') === null)
check('a RUN with an array as arguments is refused', findToolCall('RUN: GMAIL_SEND_EMAIL [1,2]') === null)
check('a RUN with a lowercase action is read as its upper-case slug', (findToolCall('RUN: gmail_send_email {}') as any)?.tool === 'GMAIL_SEND_EMAIL')
check('a RUN with a shell command is refused', findToolCall('RUN: rm -rf /') === null)

console.log('4. Web gating')
check('SEARCH is read with web access on', (findToolCall('SEARCH: solar prices', { web: true }) as any)?.kind === 'search')
check('SEARCH is ignored with web access off', findToolCall('SEARCH: solar prices', { web: false }) === null)
check('OPEN is ignored with web access off', findToolCall('OPEN: https://example.com', { web: false }) === null)
check('FIND is read with web access off', (findToolCall('FIND: notes', { web: false }) as any)?.kind === 'find')
check('the default still reads web lines', (findToolCall('SEARCH: x') as any)?.kind === 'search')

console.log('5. Prompts')
const off = buildSystemPrompt(bot)
const on = buildSystemPrompt(bot, { web: true })
check('connector instructions are in the prompt with web off', off.includes('FIND: <query>') && off.includes('RUN: <ACTION>'))
check('connector instructions are in the prompt with web on', on.includes('TOOLS: <app>'))
check('the no-browse line is there only with web off', off.includes('Web access is off') && !on.includes('Web access is off'))
check('the web lines are there only with web on', on.includes('SEARCH: <query>') && !off.includes('SEARCH: <query>'))
check('the approval rule is stated', off.includes('wait for their go-ahead'))
check('the limit is stated', off.includes(`Use at most ${MAX_TOOL_STEPS} tool lines`))

console.log('6. Stripping')
check('every tool line is removed', stripToolLines('APPS:\nFIND: x\nRUN: GMAIL_FETCH_EMAILS {}\n\nYou have 3 emails.') === 'You have 3 emails.')
check('prose with a colon is kept', stripToolLines('Run: npm test is what I would do.') === 'Run: npm test is what I would do.')

console.log('7. Composio input rules')
const { isToolkitSlug, isToolSlug } = await import('../../backend/src/services/composio.ts')
check('a toolkit slug is accepted', isToolkitSlug('gmail') && isToolkitSlug('google-sheets') && isToolkitSlug('my_app2'))
check('a toolkit slug with a path or spaces is refused', !isToolkitSlug('../x') && !isToolkitSlug('gmail x') && !isToolkitSlug(''))
check('an action slug is accepted', isToolSlug('GMAIL_FETCH_EMAILS'))
check('an action slug in lowercase is refused', !isToolSlug('gmail_fetch_emails'))

console.log(failed === 0 ? `\nALL PASS: ${passed} passed, 0 failed` : `\n${failed} FAILED, ${passed} passed`)
process.exit(failed === 0 ? 0 : 1)
