/**
 * Bots round — the rules behind a bot, checked in Node.
 *
 *  1. Limits: at least five minutes between runs, 50 routines, 100 memories,
 *     300 thread messages, and 20 kept run records per routine.
 *  2. Schedule: a routine is due when its time has come and it is enabled; it
 *     is not due while paused; the next run moves on after each run.
 *  3. Memory: "remember:" saves a memory; duplicates and empty notes are refused.
 *  4. Prompts: the bot reads its memory and only the recent part of the thread,
 *     and is told plainly that it has no live access to the web or apps.
 *
 * Run: npm run bots-test --workspace frontend
 */
import {
  addMemory, addRoutine, appendMessage, applyRunResult, buildRoutinePrompt, buildSystemPrompt, buildTurnPrompt,
  clampEvery, createBot, dueRoutines, memoryCommand, updateRoutine, botAvatar,
  CONTEXT_MESSAGES, MAX_MEMORY, MAX_ROUTINES, MAX_RUNS_KEPT, MAX_THREAD, MIN_EVERY_MINUTES, type Bot, type BotMessage,
} from '../src/lib/bots/logic.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const MIN = 60000
const NOW = Date.UTC(2026, 9, 18, 9, 0)
const base = () => createBot({ name: '  Ana  ', job: ' Keep my reading list ' }, NOW, 'bot_1')

console.log('1. Limits')
check('an interval under five minutes is raised to five', clampEvery(1) === MIN_EVERY_MINUTES)
check('a sensible interval is kept', clampEvery(60) === 60)
check('a non-number falls back to the minimum', clampEvery(Number.NaN) === MIN_EVERY_MINUTES)
const b0 = base()
check('the name and job are trimmed', b0.name === 'Ana' && b0.job === 'Keep my reading list', JSON.stringify([b0.name, b0.job]))
check('an empty name gets a default', createBot({ name: '  ', job: '' }, NOW, 'x').name === 'Untitled bot')

let bm: Bot = base()
for (let i = 0; i < MAX_MEMORY; i++) bm = addMemory(bm, `fact ${i}`).bot
const overMemory = addMemory(bm, 'one more')
check(`memory stops at ${MAX_MEMORY}`, !!overMemory.error && overMemory.bot.memory.length === MAX_MEMORY, overMemory.error)

let br: Bot = base()
for (let i = 0; i < MAX_ROUTINES; i++) br = addRoutine(br, { title: `r${i}`, instructions: 'do it', everyMinutes: 60 }, NOW, `rt${i}`).bot
const overRoutines = addRoutine(br, { title: 'extra', instructions: 'do it', everyMinutes: 60 }, NOW, 'x')
check(`a bot holds ${MAX_ROUTINES} routines and no more`, !!overRoutines.error && overRoutines.bot.routines.length === MAX_ROUTINES)

let bt: Bot = base()
for (let i = 0; i < MAX_THREAD + 25; i++) bt = appendMessage(bt, { id: `m${i}`, role: 'user', text: `m${i}`, at: NOW + i })
check(`the thread keeps the newest ${MAX_THREAD}`, bt.thread.length === MAX_THREAD && bt.thread[0].id === 'm25')

console.log('2. Schedule')
const withRoutine = addRoutine(base(), { title: 'Brief', instructions: 'Summarise my list', everyMinutes: 30 }, NOW, 'rt_a').bot
const rid = withRoutine.routines[0].id
check('a new routine is first due 30 minutes after it is made', withRoutine.routines[0].nextRunAt === NOW + 30 * MIN)
check('it is not due before its time', dueRoutines([withRoutine], NOW + 29 * MIN).length === 0)
check('it is due at its time', dueRoutines([withRoutine], NOW + 30 * MIN).length === 1)
const paused = updateRoutine(withRoutine, rid, { enabled: false }, NOW)
check('a paused routine is never due', dueRoutines([paused], NOW + 999 * MIN).length === 0)
const resumed = updateRoutine(paused, rid, { enabled: true }, NOW + 100 * MIN)
check('resuming sets the next run from the resume time', resumed.routines[0].nextRunAt === NOW + 130 * MIN, `${resumed.routines[0].nextRunAt - NOW}`)
const ran = applyRunResult(withRoutine, rid, { id: 'r1', at: NOW + 31 * MIN, ok: true, text: 'done' }, NOW + 31 * MIN)
check('after a run the next one is one interval later', ran.routines[0].nextRunAt === NOW + 61 * MIN)
const twoBots = [withRoutine, addRoutine(base(), { title: 'Earlier', instructions: 'x', everyMinutes: 5 }, NOW - 10 * MIN, 'rt_b').bot]
const order = dueRoutines(twoBots, NOW + 60 * MIN).map((d) => d.routine.title)
check('due routines come oldest first', order.join(',') === 'Earlier,Brief', order.join(','))

let runs: Bot = withRoutine
for (let i = 0; i < 25; i++) runs = applyRunResult(runs, rid, { id: `run${i}`, at: NOW + i * MIN, ok: true, text: `run ${i}` }, NOW + i * MIN)
const kept = runs.routines[0].runs
check(`only the last ${MAX_RUNS_KEPT} runs are kept`, kept.length === MAX_RUNS_KEPT, `${kept.length}`)
check('the newest run comes first', kept[0].id === 'run24')

console.log('3. Memory')
check('"remember: …" is a memory command', memoryCommand('remember: I prefer short emails') === 'I prefer short emails')
check('"/remember …" is a memory command', memoryCommand('/remember call Ben on Friday') === 'call Ben on Friday')
check('an ordinary message is not a memory command', memoryCommand('hello there') === null)
check('"Remember this" without a colon is not one', memoryCommand('Remember this idea') === null)
const dup = addMemory(addMemory(base(), 'Likes tea').bot, '  likes  TEA ')
check('a repeat is refused, ignoring case and spacing', dup.bot.memory.length === 1 && dup.error === 'Already remembered.')
check('an empty memory is refused', addMemory(base(), '   ').error === 'Write the thing to remember.')

console.log('4. Prompts')
const talking: Bot = {
  ...addMemory(base(), 'Prefers bullet points').bot,
  thread: Array.from({ length: CONTEXT_MESSAGES + 5 }, (_, i): BotMessage => ({ id: `t${i}`, role: i % 2 ? 'bot' : 'user', text: `line ${i}`, at: i })),
}
const sys = buildSystemPrompt(talking)
check('the system prompt names the bot and its job', sys.includes('You are Ana') && sys.includes('Keep my reading list'))
check('the system prompt includes the memory', sys.includes('- Prefers bullet points'))
check('the system prompt says it cannot browse or act in other apps', sys.includes('cannot browse the web'))
const turn = buildTurnPrompt(talking, 'what now?')
check('the turn includes the recent messages', turn.includes('line 24') && turn.includes('line 5'))
check('the turn leaves out messages older than the context window', !turn.includes('line 0\n') && !turn.includes('Person: line 0'))
check('the turn ends with the new message', turn.includes('Person: what now?'))
const notes: Bot = { ...base(), thread: [{ id: 'n', role: 'note', text: 'model unavailable', at: NOW }] }
check('notes are not sent to the model as conversation', !buildTurnPrompt(notes, 'hi').includes('model unavailable'))
const routine = addRoutine(base(), { title: 'Brief', instructions: 'Summarise my reading list', everyMinutes: 60 }, NOW, 'rt').bot.routines[0]
const rp = buildRoutinePrompt(base(), routine, NOW)
check('the routine prompt carries the instructions', rp.includes('Summarise my reading list'))
check('the routine prompt says live access is not available', rp.includes('no live access'))

console.log('5. Avatar')
check('the avatar is the same every time for a name', JSON.stringify(botAvatar('Ana')) === JSON.stringify(botAvatar('Ana')))
check('the avatar letter is capitalised', botAvatar('ana').letter === 'A')

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
