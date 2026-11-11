// Rich-card reference. Writes docs/technical/17-rich-cards.md from the catalogue
// (frontend/src/lib/cards/catalog.ts), so the list and the count come from the code.
//
//   tsx scripts/cards-doc.mts          write the page
//   tsx scripts/cards-doc.mts --check  fail if the page is out of date, or the count
//                                      is outside the 200–300 the product promises
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DOC = resolve(here, '../../docs/technical/17-rich-cards.md')
const { CARD_SPECS, APPS, BUILTIN_TOOL_SPEC } = await import('../src/lib/cards/catalog.ts')

const MIN = 200
const MAX = 300
const KIND_ORDER = ['search', 'list', 'read', 'create', 'send', 'update', 'delete', 'builtin'] as const
const esc = (s: string) => s.replace(/\|/g, '\\|')

function count(map: Map<string, number>, keys: readonly string[]): string {
  return keys.filter((k) => map.has(k)).map((k) => `${k} ${map.get(k)}`).join(', ')
}

function build(): string {
  const total = CARD_SPECS.length
  const unique = new Set(CARD_SPECS.map((s) => s.id)).size
  const builtin = Object.keys(BUILTIN_TOOL_SPEC).length
  const appSpecs = CARD_SPECS.filter((s) => s.id.includes('.') && !s.id.startsWith('tool.'))
  const byKind = new Map<string, number>()
  for (const s of CARD_SPECS) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1)
  const byFamily = new Map<string, number>()
  for (const s of CARD_SPECS) byFamily.set(s.family, (byFamily.get(s.family) ?? 0) + 1)

  const out: string[] = []
  out.push('# 17 — Rich in-app cards: the variant catalogue')
  out.push('')
  out.push('When a tool answers in chat, the answer is drawn as a card, never as raw data. This page')
  out.push('lists every card variant the app can draw. The list is generated from the code in')
  out.push('`frontend/src/lib/cards/catalog.ts`; run `tsx scripts/cards-doc.mts` from `frontend/` to')
  out.push('rebuild it, and `--check` to make sure it still matches.')
  out.push('')
  out.push(`**${total} variants** (${unique} unique ids). The product range is ${MIN}–${MAX}.`)
  out.push('')
  out.push('## How the variants are made')
  out.push('')
  out.push(`- **Connected apps:** ${APPS.length} apps × 7 action kinds = ${appSpecs.length} variants. Each app's`)
  out.push('  kinds are search, list, read, create, send, update and delete. Each has its own id (`github.search`),')
  out.push('  accent colour, icon and headline.')
  out.push(`- **Built-in tools:** ${builtin} variants, one per tool (\`web_search\`, \`crm_create\`, \`ide_write_file\`, …).`)
  out.push('- **Ids are stored on messages.** They are stable: renaming one would change old chats, so add new ids instead.')
  out.push('')
  out.push('Counts by kind: ' + count(byKind, KIND_ORDER) + '.')
  out.push('')
  out.push('Counts by layout family (how the results are drawn): ' +
    [...byFamily.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ') + '.')
  out.push('')
  out.push('## Connected apps')
  out.push('')
  out.push('| App | Id | Layout | Noun | Accent |')
  out.push('| --- | --- | --- | --- | --- |')
  for (const a of APPS) out.push(`| ${esc(a.name)} | \`${a.id}\` | ${a.family} | ${a.noun} / ${a.plural} | \`${a.accent}\` |`)
  out.push('')
  out.push('## Variants for connected apps')
  out.push('')
  out.push('| Card id | Headline | Kind | Layout |')
  out.push('| --- | --- | --- | --- |')
  for (const s of appSpecs) out.push(`| \`${s.id}\` | ${esc(s.headline)} | ${s.kind} | ${s.family} |`)
  out.push('')
  out.push('## Built-in tool variants')
  out.push('')
  out.push('| Card id | Area | Headline | Summary | Kind | Layout |')
  out.push('| --- | --- | --- | --- | --- | --- |')
  for (const s of CARD_SPECS.filter((x) => x.id.startsWith('tool.'))) {
    out.push(`| \`${s.id}\` | ${esc(s.appName)} | ${esc(s.headline)} | ${esc(s.summary)} | ${s.kind} | ${s.family} |`)
  }
  out.push('')
  out.push('## Checks')
  out.push('')
  out.push('`tsx scripts/cards-doc.mts --check` fails when the count is outside the range, when an id is')
  out.push('duplicated, or when this page no longer matches the catalogue.')
  out.push('')
  return out.join('\n')
}

const text = build()
const total = CARD_SPECS.length

if (process.argv.includes('--check')) {
  const problems: string[] = []
  if (total < MIN || total > MAX) problems.push(`the catalogue has ${total} variants, outside ${MIN}–${MAX}`)
  if (new Set(CARD_SPECS.map((s) => s.id)).size !== total) problems.push('a card id is duplicated')
  let current = ''
  try { current = readFileSync(DOC, 'utf8') } catch { problems.push('the page does not exist yet') }
  if (current && current !== text) problems.push('the page is out of date; run tsx scripts/cards-doc.mts')
  if (problems.length) {
    console.log('cards-doc check failed:\n- ' + problems.join('\n- '))
    process.exit(1)
  }
  console.log(`cards-doc check passed: ${total} variants, page up to date.`)
} else {
  writeFileSync(DOC, text)
  console.log(`wrote ${DOC} (${total} variants)`)
}
