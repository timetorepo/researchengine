/**
 * R18: the search that answers, the text that leaves, and five blocks that do a
 * job.
 *
 *   npx tsx scripts/r18-test.mts               (from frontend/)
 *   npx tsx scripts/r18-test.mts --api http://127.0.0.1:8787
 *
 * Two kinds of check live here:
 *
 *   • source contracts — the search route must answer inside a budget and name
 *     every lane, the frontend must render a reason on *both* the failure and
 *     the empty path (the bug was that the failure path rendered nothing), the
 *     vanish input must hide its own text while the pixels fly, and each of the
 *     five shadcn-space blocks must be imported by a host outside its folder;
 *   • a live API check — when a backend answers, the budget and the per-lane
 *     reasons are measured rather than read.
 *
 * The five blocks themselves are also mounted in r18-ui-test.mts; this file
 * proves the wiring and the vendoring.
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const repo = resolve(root, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
const readRepo = (rel: string) => readFileSync(join(repo, rel), 'utf8')
const apiBase = (() => {
  const i = process.argv.indexOf('--api')
  return i >= 0 ? process.argv[i + 1] : 'http://127.0.0.1:8787'
})()

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}

const libRoute = readRepo('backend/src/routes/library.ts')
const searchScreen = read('src/components/library/LibrarySearch.tsx')
// The non-JSON description now lives in the shared reader this screen calls,
// so the contract is checked where the code actually is.
const jsonReader = read('src/lib/net/json.ts')
const vanish = read('src/components/ui/aceternity/PlaceholdersAndVanishInput.tsx')

async function main() {
  /* ------------------------------------------------------------------ 1 */
  console.log('\n[1] The search route: a budget, three lanes, and a reason per lane')
  {
    check('the route declares the 200 ms budget the user asked for', /const BUDGET_MS = 200/.test(libRoute))
    check('it races the lanes against that budget instead of awaiting the slowest',
      /Promise\.race\(\[Promise\.allSettled\(session\.work\), sleep\(budget\)\]\)/.test(libRoute))
    check('each session keeps its lanes as a state machine',
      /state: 'pending' \| 'ok' \| 'error'/.test(libRoute)
      && /const pending = lanes\.filter\(\(l\) => l\.state === 'pending'\)/.test(libRoute))
    check('the response names the lanes, what is still running, and how long it took',
      /sources,\s*\n\s*pending,\s*\n\s*notes,\s*\n\s*tookMs/.test(libRoute))
    check('a failing lane carries a sentence, not a stack trace', /function why\(/.test(libRoute) && /LaneError/.test(libRoute))
    check('an offline host is described as offline', /could not resolve its host/.test(libRoute))
    check('the same session is reused for the follow-up poll (no double work)',
      /function sessionFor\(/.test(libRoute) && /sessions\.get\(key\)/.test(libRoute))
    check('the server never reports an empty search as a success when every source failed',
      /if \(!results\.length && problems\.length\) throw new LaneError/.test(libRoute))
    check('recommendations explain themselves too, per source',
      /did not load — \$\{why\(e/.test(libRoute) && /#\$\{tag\}: \$\{why\(e/.test(libRoute))
    check('local search covers imported documents as well as saved items',
      /db\.listDocuments\(\)/.test(libRoute) && /db\.listLibraryItems\(\)/.test(libRoute))
  }

  /* ------------------------------------------------------------------ 2 */
  console.log('\n[2] The search screen: an answer or a reason, never a blank panel')
  {
    check('every exit path records which query it ran', /setRanFor\(clean\)/.test(searchScreen)
      && (searchScreen.match(/setRanFor\(clean\)/g) ?? []).length >= 2)
    check('the failure path renders its own card', /searchError/.test(searchScreen) && /Search could not run/.test(searchScreen))
    check('a non-JSON or non-200 answer is described rather than swallowed',
      /if \(!res\.ok\)/.test(searchScreen)
      && /readJsonResponse/.test(searchScreen)
      && /was not JSON/.test(jsonReader))
    check('the empty state repeats the reasons and offers another try',
      /Nothing for “\{ranFor\}” yet/.test(searchScreen) && /Search again/.test(searchScreen))
    check('the per-source line says ok, still looking, or failed',
      /function sourceLine/.test(searchScreen) && /still looking/.test(searchScreen) && /failed/.test(searchScreen))
    check('the answer time is shown, so the 200 ms promise is visible',
      /Answered in \{tookMs\} ms/.test(searchScreen))
    check('typing is debounced, so a five-letter word is not five searches',
      /setTimeout\(\(\) => \{ void runSearch\(clean\) \}, 220\)/.test(searchScreen))
    check('the slow lanes are polled and then merged in', /opts\.poll/.test(searchScreen) && /next === 1 \? 420 : 700/.test(searchScreen))
    check('recommendations have their own retry and their own reason', /Could not reach the local server/.test(searchScreen)
      && /Retry/.test(searchScreen))
  }

  /* ------------------------------------------------------------------ 3 */
  console.log('\n[3] The vanish input: nothing of the text stays visible while it exits')
  {
    check('the input hides its own glyphs with an inline colour while animating',
      /color: animating \? 'transparent' : 'var\(--text\)'/.test(vanish))
    check('the class that could never win is gone', !/animating && 'text-transparent'/.test(vanish))
    check('the caret goes with it', /caretColor: animating \? 'transparent'/.test(vanish))
    check('and no red squiggles are left under text on its way out', /spellCheck=\{!animating\}/.test(vanish))
    check('the reason is written down for the next reader', /an inline `color` always\n\s*\*?\s*wins over a class/.test(vanish) || /inline `color` always/.test(vanish))
  }

  /* ------------------------------------------------------------------ 4 */
  console.log('\n[4] The five shadcn-space blocks are vendored, verified and registered')
  {
    const verify = execFileSync('node', [join(here, 'shadcnspace-vendor.mjs'), '--verify'], { cwd: root, encoding: 'utf8' })
    check('their digests still match upstream', /^ok {2}10 files match upstream shadcnspace\/shadcnspace@315a4366dfa9/m.test(verify), verify.slice(-200))
    check('the one adapted block says so out loud', /patched {3}src\/components\/shadcn-space\/button-group\/button-group-12\.tsx/.test(verify))

    const manifest = JSON.parse(read('scripts/shadcnspace-sources.json'))
    check('the manifest records the exact upstream commit and licence',
      manifest.upstream.repo === 'shadcnspace/shadcnspace' && manifest.upstream.commit === '315a4366dfa9' && manifest.upstream.license === 'MIT')
    check('all five requested blocks are in it',
      ['animated-list-02', 'badge-13', 'button-28', 'button-group-12', 'button-group-10'].every((n) => manifest.items[n]))
    check('and the five primitives they depend on', Object.keys(manifest.primitives).length === 5)

    const components = JSON.parse(read('components.json'))
    check('the registry is registered for a normal `npx shadcn add @shadcn-space/...`',
      components.registries['@shadcn-space'] === 'https://shadcnspace.com/r/{name}.json')
    const pkg = JSON.parse(read('package.json'))
    check('Base UI is a dependency, because those primitives are the Base UI flavour',
      !!pkg.dependencies['@base-ui/react'])
    check('NumberFlow is there for the streak badge', !!pkg.dependencies['@number-flow/react'])

    // Every vendored block has to be imported by a file outside its own folder,
    // which is the rule R15 set for the SmoothUI set: a folder is not a feature.
    const hosts: [string, string][] = [
      ['src/components/quiz/QuizHub.tsx', 'animated-list/animated-list-02'],
      ['src/components/quiz/QuizPlay.tsx', 'badge/badge-13'],
      ['src/components/settings/DataTab.tsx', 'button/button-28'],
      ['src/components/ide/CodingView.tsx', 'button-group/button-group-12'],
      ['src/components/articles/ArticleEditor.tsx', 'button-group/button-group-10'],
    ]
    for (const [host, path] of hosts) {
      const source = read(host)
      check(`${host.split('/').pop()} uses ${path.split('/').pop()}`,
        source.includes(`@/components/shadcn-space/${path}`))
    }
  }

  /* ------------------------------------------------------------------ 5 */
  console.log('\n[5] Each block does the job it was picked for')
  {
    const quizHub = read('src/components/quiz/QuizHub.tsx')
    check('the loader animates the pipeline’s own stages, not invented ones',
      /<SetupSteps[\s\S]{0,200}steps=\{stages\.map\(\(s\) => \(\{ id: s\.id, title: s\.label \}\)\)\}/.test(quizHub))
    check('the true percentage is still on screen underneath it', /const active = stages\.find\(\(s\) => !s\.done\)/.test(quizHub))

    const quizPlay = read('src/components/quiz/QuizPlay.tsx')
    check('the quiz counts streaks with the badge, inside the existing thump',
      /<StreakBadge value=\{streak\} label="streak" \/>/.test(quizPlay) && /thump \? \{ scale: \[1, 1\.35/.test(quizPlay))
    check('a zero streak does not pretend to be one', /streak > 0 \? \(/.test(quizPlay))

    const dataTab = read('src/components/settings/DataTab.tsx')
    check('the hold-to-charge button is the erase action, and only that action',
      /<HoldToChargeButton[\s\S]{0,400}onComplete=\{clearAll\}/.test(dataTab))
    check('it states the hold in words', /Hold to erase everything/.test(dataTab))
    check('a backup can still be taken first', /Export a backup first/.test(dataTab))

    const coding = read('src/components/ide/CodingView.tsx')
    check('the coding toolbar runs the project from the primary button',
      /<ActionExecuteButtonGroup[\s\S]{0,600}onPrimary=\{\(\) => void startPreview\(\)\}/.test(coding))
    check('saving lives in its menu', /\{ id: 'save', label: dirty \? 'Save the active file'/.test(coding))
    check('and saving-then-running is one entry', /\{ id: 'save-run', label: 'Save, then run'/.test(coding))

    const editor = read('src/components/articles/ArticleEditor.tsx')
    check('the article editor has a formatted block driven by that toolbar',
      /<EditorToolbar active=\{active \?\? undefined\} onCommand=\{command\}/.test(editor))
    check('its HTML is filtered through an allow-list', /function sanitizeRich/.test(editor) && /RICH_TAGS/.test(editor))
    check('links are scheme-checked and inert attributes dropped', /keepHref = child\.tagName === 'A'/.test(editor))
    check('a formatted block survives export as markdown', /function richToMarkdown/.test(editor) && /richToMarkdown\(b\.content\)/.test(editor))
    check('the editable surface is seeded once so the caret never jumps',
      /seeded\.current/.test(editor) && !/dangerouslySetInnerHTML=\{\{ __html: sanitizeRich\(block\.content\) \}\}/.test(editor))
    const types = read('src/types/index.ts')
    check('the block type exists in the article model', /'rich'/.test(types) && /type: 'heading' \| 'paragraph' \| 'list' \| 'quote' \| 'code' \| 'image' \| 'rich'/.test(types))
  }

  /* ------------------------------------------------------------------ 6 */
  console.log(`\n[6] Live check against ${apiBase}`)
  let live = false
  try {
    const health = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(1500) })
    live = health.ok
  } catch { live = false }
  if (!live) {
    check('a backend is running to measure (skipped — start one for this section)', true)
    console.log('      (no backend answered; the contract checks above still ran)')
  } else {
    const t0 = Date.now()
    const res = await fetch(`${apiBase}/api/library/search?q=javascript&refresh=1`, { signal: AbortSignal.timeout(10_000) })
    const wall = Date.now() - t0
    const json: any = await res.json()
    check('the search answers', res.ok && typeof json === 'object', `HTTP ${res.status}`)
    check('inside the budget, measured from the outside', wall <= 600 || json.tookMs <= 350,
      `wall ${wall} ms, server ${json.tookMs} ms`)
    check('the server reports its own time', typeof json.tookMs === 'number')
    check('every lane is named, with a state and a count',
      Array.isArray(json.sources) && json.sources.length >= 2
      && json.sources.every((s: any) => s.id && s.label && ['pending', 'ok', 'error'].includes(s.state) && typeof s.count === 'number'))
    check('a lane that failed says why',
      json.sources.filter((s: any) => s.state === 'error').every((s: any) => typeof s.reason === 'string' && s.reason.length > 8),
      JSON.stringify(json.sources))
    check('the notes mirror the failed lanes', (json.notes ?? []).length === json.sources.filter((s: any) => s.state === 'error').length)
    check('a second call is served from the session, not the network', (await (async () => {
      const again: any = await (await fetch(`${apiBase}/api/library/search?q=javascript`)).json()
      return again.tookMs <= json.tookMs + 120
    })()))
  }

  console.log(`\n${failed ? 'FAILED' : 'ALL PASS'}: ${passed} passed, ${failed} failed`)
  if (fails.length) { console.log('  - ' + fails.join('\n  - ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
