// Context budget and streaming split: the caps hold, recent turns keep their
// text, and nothing is dropped silently.
import { fitHistory, compactToolRounds, clip, LIMITS, tokensOf } from '../src/lib/context/budget.ts'
import { pruneContext } from '../src/lib/flow/pruner.ts'
import { splitStable, plainifyTail, chunkTail } from '../src/lib/chat/streamSplit.ts'
import { trimForQuota, isQuotaError } from '../src/lib/security/quota.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`)
}

// ---- clip
check('clip leaves short text alone', clip('abc', 10) === 'abc')
const c = clip('x'.repeat(100), 10)
check('clip cuts and says how much went', c.startsWith('x'.repeat(10)) && c.includes('90 characters left out'), c.slice(0, 60))

// ---- history fit
const long = 'word '.repeat(4000) // 20k chars
const msgs = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `Q${i} ` + long }))
const fit = fitHistory(msgs, 12_000)
check('history fits the budget', tokensOf(fit.messages) <= 12_000 + LIMITS.verbatimMessages * 3000, `${tokensOf(fit.messages)} tokens`)
check('folded older turns produce a capsule', !!fit.capsule && fit.capsule.includes('earlier messages'))
const last = fit.messages[fit.messages.length - 1]
check('newest message is kept', last.content.startsWith('Q29 '))
check('newest message is capped at verbatimChars', last.content.length <= LIMITS.verbatimChars + 200)
const small = fitHistory([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }], 12_000)
check('short conversations are untouched', small.messages.length === 2 && small.capsule === null && small.folded === 0)

// ---- pruneContext: budget applies to every mode, fidelity gets the larger one
const hist = msgs.map((m, i) => ({ id: String(i), role: m.role, content: m.content, createdAt: i }) as any)
const eff = pruneContext(hist, 'efficient', true)
const fid = pruneContext(hist, 'fidelity', true)
check('efficient mode sends less than fidelity', tokensOf(eff.messages) < tokensOf(fid.messages), `${tokensOf(eff.messages)} vs ${tokensOf(fid.messages)}`)
check('fidelity still gets a budget', tokensOf(fid.messages) <= LIMITS.historyTokens.fidelity + LIMITS.verbatimMessages * 3000)
const off = pruneContext(hist, 'balanced', false)
check('flow off still obeys a budget', tokensOf(off.messages) <= LIMITS.historyTokens.fidelity + LIMITS.verbatimMessages * 3000)
const tiny = pruneContext(hist.slice(0, 3), 'balanced', true)
check('tiny history is returned in full', tiny.messages.length === 3 && tiny.capsule === null)

// ---- tool rounds
const toolBig = 'r'.repeat(9000)
const rounds = [
  { role: 'user', content: 'go' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'a' }] },
  { role: 'tool', name: 'ide_read_file', content: toolBig },
  { role: 'assistant', content: '', toolCalls: [{ id: 'b' }] },
  { role: 'tool', name: 'ide_read_file', content: toolBig },
]
const comp = compactToolRounds(rounds as any[])
check('older tool output is shortened', comp[2].content.length < 1200 && comp[2].content.includes('characters left out'))
check('current round tool output is kept in full', comp[4].content === toolBig)
check('original messages are not mutated', rounds[2].content === toolBig)

// ---- streaming split
const s1 = splitStable('Hello **world**.\n\nSecond para still ar')
check('settled paragraph is split off', s1.stable === 'Hello **world**.\n\n' && s1.tail === 'Second para still ar')
const s2 = splitStable('intro\n\n```ts\nconst x = 1\n\nmore')
check('open code block is never split', s2.stable.endsWith('more') && s2.tail === '')
const s3 = splitStable('no paragraph yet')
check('single paragraph is all tail', s3.stable === '' && s3.tail === 'no paragraph yet')
check('tail markup is stripped', plainifyTail('see [1](https://x.y) **bold** `code`') === 'see 1 bold code')
const ch = chunkTail('a b c d e f g h i j k')
check('chunks settle every 8 words', ch.settled.length === 1 && ch.settled[0] === 'a b c d e f g h' && ch.live === 'i j k')
check('short tail is all live', chunkTail('a b').settled.length === 0 && chunkTail('a b').live === 'a b')

// ---- storage quota trim
{
  const chats = Array.from({ length: 70 }, (_, i) => ({ id: 'c' + i, messages: Array.from({ length: 130 }, (_, j) => ({ id: j, content: 'x', toolTrace: [{ a: 1 }] })) }))
  const r = trimForQuota(JSON.stringify({ state: { chats }, version: 1 }))
  const out = JSON.parse(r.value).state.chats
  check('oldest chats are dropped first', out.length === 60 && out[0].id === 'c10', String(out.length))
  check('older messages are capped per chat', out.every((c: any) => c.messages.length === 120))
  check('latest answers keep their tool trace', out[59].messages[119].toolTrace !== undefined)
  check('older tool traces are removed', out[0].messages[0].toolTrace === undefined)
  check('the note says what was trimmed', /oldest chats/.test(r.note) && /Export chats/.test(r.note), r.note)
  check('garbage input is returned untouched', trimForQuota('not json').value === 'not json')
  check('quota errors are recognised', isQuotaError({ name: 'QuotaExceededError' }) && !isQuotaError(new Error('nope')))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
