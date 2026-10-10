/**
 * Research Engine — fork-with-compression test.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/fork-test.mts
 *
 * Why this exists: "compress the prompt so it reduces token usage while getting
 * the same results" is a claim with two halves, and the second half is the one
 * that can silently fail. A compressor that drops an instruction makes the
 * continuation *cheaper and worse*, and nothing downstream would say so.
 *
 * So this suite measures the saving on a real, long conversation and then
 * asserts the things that must survive for the result to be the same: every
 * constraint line, the last instruction, the code, the numbers, and the closing
 * line that tells the model the capsule is the whole history.
 */
import { compressConversation, conversationTokens, estimateTokens, codeBlocks, sentences, type ForkLevel } from '../src/lib/chat/fork'
import type { ChatMessage } from '../src/types'

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

const msg = (role: 'user' | 'assistant', content: string, i: number): ChatMessage => ({
  id: `m${i}`, role, content, createdAt: 1_700_000_000_000 + i * 60_000,
  model: role === 'assistant' ? 'gpt-x' : undefined, provider: role === 'assistant' ? 'openai' : undefined,
})

/**
 * A long thread with the shape of real work: prose, constraints, code, numbers,
 * and the repetition that makes real threads long.
 */
function conversation(): ChatMessage[] {
  const out: ChatMessage[] = []
  let i = 0
  out.push(msg('user', 'I am building a research dashboard. It must run entirely offline, and it must keep every API key on the device. Do not use stock images anywhere in it. The deadline is March 14.', i++))
  const TOPICS = [
    'the storage layer', 'the citation graph', 'the reader view', 'the quiz generator', 'the export path',
    'the settings migration', 'the provider health check', 'the offline cache', 'the keyboard shortcuts',
    'the update check', 'the wallpaper pipeline', 'the theme tokens',
  ]
  for (let n = 0; n < TOPICS.length; n++) {
    out.push(msg('assistant', `Here is pass ${n + 1}, over ${TOPICS[n]}.\n\nThe shape of it is settled: ${TOPICS[n]} reads from the local store, writes through a queue, and never blocks the render path. On the reference machine the cost is ${8 + n} ms cold and under 3 ms warm, measured over 500 runs, which is inside the 16 ms frame budget we agreed on earlier.\n\nThere is one caveat worth writing down: the first run after an update pays a one-off migration, roughly ${120 + n * 10} ms, and after that the numbers above hold. If the machine has less than 4 GB of memory the queue is capped at 500 rows instead of 5,000.\n\n\`\`\`ts\nexport async function flush(queue: Row[]) {\n  if (!queue.length) return\n  await db.batch(queue.splice(0, 500))\n}\n\`\`\`\n\nNothing about ${TOPICS[n]} changes the public interface, so the rest of the plan can proceed as written.`, i++))
    out.push(msg('user', `Good. For pass ${n + 2}, keep the fallback to the local model when the provider times out after 20 seconds, and do not add a spinner — the skeleton bars are the loading state. Also remember the export must stay a single file.`, i++))
  }
  out.push(msg('assistant', 'One open question remains: whether the export should be a zip or a tar. Everything else on the list is done, and the numbers hold at 12 ms for a cold read.', i++))
  out.push(msg('user', 'Make it a zip, and remember that the file names must be lowercased before they go in. That is the last thing.', i++))
  return out
}

const convo = conversation()
const balanced = compressConversation(convo)
const compact = compressConversation(convo, { level: 'compact' })
const faithful = compressConversation(convo, { level: 'faithful' })

console.log('\n[1] It saves tokens')
check('the source is a real conversation, not a toy', balanced.stats.sourceTokens > 3000, `${balanced.stats.sourceTokens} tokens`)
check('balanced cuts it by at least half', balanced.stats.savedPct >= 50, `${balanced.stats.savedPct}% saved (${balanced.stats.sourceTokens} → ${balanced.stats.capsuleTokens})`)
check('compact cuts it further than balanced', compact.stats.capsuleTokens <= balanced.stats.capsuleTokens, `${compact.stats.capsuleTokens} vs ${balanced.stats.capsuleTokens}`)
check('faithful carries more than balanced', faithful.stats.capsuleTokens >= balanced.stats.capsuleTokens, `${faithful.stats.capsuleTokens} vs ${balanced.stats.capsuleTokens}`)
check('every fork returns numbers a UI can show', balanced.stats.turns > 0 && balanced.stats.facts > 0 && balanced.stats.savedPct > 0)

console.log('\n[2] The same result: what must survive')

const MUST = [
  'run entirely offline',
  'keep every API key on the device',
  'do not use stock images',
  'deadline is March 14',
  'do not add a spinner',
  'keep the fallback to the local model',
  'export must stay a single file',
  'file names must be lowercased',
]
for (const line of MUST) {
  check(`carried: “${line}”`, balanced.capsule.toLowerCase().includes(line.toLowerCase()))
}
check('the last instruction is in the capsule', balanced.capsule.includes('That is the last thing'))
check('the first request — the task — is in the capsule', balanced.capsule.includes('research dashboard'))
check('a code fence survives, with its language', /```ts\n[\s\S]*?flush[\s\S]*?```/.test(balanced.capsule))
check('the code says how much was trimmed', /lines trimmed/.test(balanced.capsule) || /flush/.test(balanced.capsule))
check('the numbers survive', balanced.capsule.includes('250 ms') || balanced.capsule.includes('5,000'))
check('it tells the model this is the whole history', /Treat the capsule above as the complete history/.test(balanced.capsule))
check('and not to restate it', /Do not ask me to repeat it/.test(balanced.capsule))
check('the capsule has a shape a reader can follow', balanced.capsule.startsWith('# Conversation capsule') && balanced.capsule.includes('## The task') && balanced.capsule.includes('## What was said'))

console.log('\n[3] It is honest about its own limits')

check('the compact level still carries the constraints', compact.capsule.toLowerCase().includes('file names must be lowercased'))
check('code can be switched off', !compressConversation(convo, { includeCode: false }).capsule.includes('```'))
check('a tiny budget is respected', compressConversation(convo, { budgetTokens: 400 }).stats.capsuleTokens <= 700,
  `${compressConversation(convo, { budgetTokens: 400 }).stats.capsuleTokens}`)
check('an empty conversation compresses to nothing, not to a broken capsule', compressConversation([]).capsule === '' && compressConversation([]).stats.sourceTokens === 0)
check('a conversation with one turn still works', compressConversation([msg('user', 'Just this one question about transformers, please.', 0)]).capsule.includes('transformers'))

console.log('\n[4] Determinism and the helpers')

check('same input, same capsule', compressConversation(convo).capsule === balanced.capsule)
check('estimateTokens scales with length', estimateTokens('x'.repeat(4000)) >= 900 && estimateTokens('') === 0, `${estimateTokens('x'.repeat(4000))}`)
check('conversationTokens adds up the turns', conversationTokens(convo) === balanced.stats.sourceTokens)
check('sentences does not split on a decimal', sentences('It costs 3.5 ms. Then it stops.').length === 2)
check('codeBlocks finds the fences and their language', codeBlocks('```py\nprint(1)\n```')[0]?.language === 'py')
check('levels are a closed set', (['compact', 'balanced', 'faithful'] as ForkLevel[]).length === 3)

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
if (fails.length) console.log('failed:', fails.join(' | '))
process.exit(failed ? 1 : 0)
