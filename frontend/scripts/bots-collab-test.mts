/**
 * Bots, part two — group chats, handoff, web steps, roles, and export/import,
 * checked in Node against the pure rules in src/lib/bots/logic.ts.
 *
 *  1. Web steps: SEARCH and OPEN lines are read, a non-web line is an answer, and stripping keeps the answer only.
 *  2. Group chats: the first member answers a person; a named bot answers next; a round stops when nobody is named.
 *  3. Group limits: two to six members, no duplicates.
 *  4. Handoff: the new owner is recorded and the log keeps the earlier owner and the brief.
 *  5. Prompts: web instructions appear only with web access; an ECC role is included and capped.
 *  6. Export and import: a file that is not ours is refused; imported items get new ids and references follow them.
 *
 * Run: npm run bots-collab-test --workspace frontend
 */
import {
  applyHandoff, avatarTypeFor, buildRoomPrompt, buildSystemPrompt, createBot, createProject, createRoom,
  fallbackBrief, findToolCall, isAvatarType, isPass, makeBundle, mentionsName, pickSpeaker, readBundle,
  remapIncoming, roleMethodFor, stripToolLines, AVATAR_TYPES, MAX_ROLE_PROMPT, MAX_ROOM_MEMBERS, MAX_TOOL_STEPS,
  type Bot, type Room, type Project,
} from '../src/lib/bots/logic.ts'
import { MAX_ROLE_TEXT } from '../src/lib/ecc/roles.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const NOW = Date.UTC(2026, 9, 18, 9, 0)
const bot = (id: string, name: string, extra: Partial<Bot> = {}): Bot => ({ ...createBot({ name, job: `${name} job` }, NOW, id), ...extra })
const ana = bot('b1', 'Ana')
const ben = bot('b2', 'Ben')
const cy = bot('b3', 'Cy')
const bots = [ana, ben, cy]
const room = (memberIds: string[], thread: Room['thread'] = []): Room => ({ id: 'r1', name: 'Team', memberIds, createdAt: NOW, thread })
const msg = (role: 'user' | 'bot', text: string, botId?: string) => ({ id: `m${Math.random()}`, role, text, at: NOW, ...(botId ? { botId } : {}) })

console.log('1. Web steps')
check('a SEARCH line is read as a search', findToolCall('Let me look.\nSEARCH: solar panel prices 2026')?.kind === 'search')
check('the search query is kept exactly', (findToolCall('SEARCH: solar panel prices') as any)?.query === 'solar panel prices')
check('an OPEN line with a web address is read as an open', (findToolCall('OPEN: https://example.com/a') as any)?.url === 'https://example.com/a')
check('an OPEN line with a non-web address is refused', findToolCall('OPEN: file:///etc/passwd') === null)
check('a plain answer has no tool call', findToolCall('The panels cost about $0.20 per watt.') === null)
check('stripping removes tool lines and keeps the answer', stripToolLines('SEARCH: x\n\nThe answer is 4.') === 'The answer is 4.')
check('the step budget is three', MAX_TOOL_STEPS === 3)

console.log('2. Group chats')
const r0 = room(['b1', 'b2', 'b3'], [msg('user', 'Plan the launch')])
check('the first member answers a person when nobody is named', pickSpeaker(r0, bots, new Set())?.id === 'b1')
const r1 = room(['b1', 'b2', 'b3'], [msg('user', 'Ana, draft it. @Ben please check the numbers after.')])
check('a named bot answers next', pickSpeaker(r1, bots, new Set(['b1']))?.id === 'b2')
const r2 = room(['b1', 'b2', 'b3'], [msg('bot', 'Done. Nothing else to add.', 'b1')])
check('a round stops when the last bot names nobody', pickSpeaker(r2, bots, new Set(['b1'])) === null)
const r3 = room(['b1', 'b2'], [msg('bot', '@Ana I already answered.', 'b2')])
check('a bot that already spoke is not called again', pickSpeaker(r3, bots, new Set(['b1', 'b2'])) === null)
check('a mention is matched without regard to case', mentionsName('hey @ben', 'Ben') && !mentionsName('hey ben', 'Ben'))
check('a pass is exactly [pass]', isPass(' [pass] ') && !isPass('[pass] but I have a note'))
const prompt = buildRoomPrompt(r0, ana, bots)
check('the group prompt lists the members and the pass rule', prompt.includes('Ana, Ben, Cy') && prompt.includes('[pass]'))

console.log('3. Group limits')
check('a group needs two members', !!createRoom({ name: 'x', memberIds: ['b1'] }, NOW, 'r').error)
check('duplicate members count once', !!createRoom({ name: 'x', memberIds: ['b1', 'b1'] }, NOW, 'r').error)
const many = Array.from({ length: MAX_ROOM_MEMBERS + 1 }, (_, i) => `m${i}`)
check(`a group holds at most ${MAX_ROOM_MEMBERS}`, !!createRoom({ name: 'x', memberIds: many }, NOW, 'r').error)
check('a valid group is created with a default name', createRoom({ name: '  ', memberIds: ['b1', 'b2'] }, NOW, 'r').room?.name === 'Group chat')

console.log('4. Handoff')
const pr = createProject({ name: 'Launch page', brief: 'Ship the page by Friday', ownerId: 'b1' }, NOW, 'p1').project as Project
const handed = applyHandoff(pr, { id: 'e1', at: NOW + 1, text: 'Brief for Ben', fromId: 'b1' }, 'b2')
check('the new owner is recorded', handed.ownerId === 'b2')
check('the log keeps the creation and the handoff', handed.log.length === 2 && handed.log[1].kind === 'handoff' && handed.log[1].fromId === 'b1')
check('a project needs a name', !!createProject({ name: ' ', brief: '', ownerId: null }, NOW, 'p').error)
check('the fallback brief keeps the brief and says it was not model-written', fallbackBrief(handed, ana, '').includes('Ship the page') && fallbackBrief(handed, ana, '').includes('not available'))

console.log('5. Prompts')
const webOff = buildSystemPrompt(ana)
const webOn = buildSystemPrompt(ana, { web: true })
check('without web access the prompt says it cannot browse', webOff.includes('cannot browse'))
check('with web access the prompt gives the tool lines', webOn.includes('SEARCH: <query>') && webOn.includes('OPEN: <https'))
check('with web access the prompt drops the no-browse line', !webOn.includes('cannot browse'))
const roled = bot('b9', 'Dee', { role: { source: 'ecc', id: 'planner', name: 'planner', prompt: 'x'.repeat(MAX_ROLE_PROMPT + 500) } })
const roledPrompt = buildSystemPrompt(roled, { roleText: await roleMethodFor(roled, 'review my python code') })
check('a legacy ECC agent role resolves to its family', roledPrompt.includes('Your role is Workflow'))
check('the family method names the members it drew on', roledPrompt.includes('from the Workflow role (planner'))
check('the role text is capped', roledPrompt.length < MAX_ROLE_TEXT + 4000)

console.log('6. Avatars')
check('there are eighteen avatar shapes', AVATAR_TYPES.length === 18)
check('a bot gets the same shape every time', avatarTypeFor('b1') === avatarTypeFor('b1'))
check('every default shape is a known shape', isAvatarType(avatarTypeFor('anything')))

console.log('7. Export and import')
const bundle = makeBundle({ bots: [ana, ben], rooms: [room(['b1', 'b2'])], projects: [handed] }, NOW)
const parsed = readBundle(JSON.parse(JSON.stringify(bundle)))
check('our own export is accepted', parsed.ok)
check('a file that is not ours is refused', !readBundle({ format: 'other', version: 1 }).ok)
check('a bot without a name is refused', !readBundle({ format: 'research-engine.bots', version: 1, bots: [{ id: 'x' }] }).ok)
if (parsed.ok) {
  let n = 0
  const fresh = remapIncoming(parsed.data, (p) => `${p}_new${n++}`)
  const ids = new Set(fresh.bots.map((b) => b.id))
  check('imported bots get new ids', fresh.bots.every((b) => !['b1', 'b2'].includes(b.id)))
  check('a group points at the new bot ids', fresh.rooms[0].memberIds.every((m) => ids.has(m)))
  check('a project points at the new owner', fresh.projects[0].ownerId !== null && ids.has(fresh.projects[0].ownerId!))
  check('the log keeps the earlier owner, remapped', fresh.projects[0].log.some((e) => e.fromId !== undefined && ids.has(e.fromId)))
}

console.log(failed === 0 ? `\nALL PASS: ${passed} passed, 0 failed` : `\n${failed} FAILED, ${passed} passed`)
process.exit(failed === 0 ? 0 : 1)
