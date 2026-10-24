/**
 * The Developer bench, from the terminal.
 *
 * Settings → Developer has two buttons that run the create path for real and
 * print what happened. This script runs *the same function those buttons call*
 * (`runCreateBench`, from the same file) against a server you point it at, and
 * writes the same report the "Copy report" button produces:
 *
 *   npx tsx scripts/bench-report.mts [--api http://127.0.0.1:8787] [--out <file>]
 *
 * Why: "it works on my machine" is not a fact until something that is not a
 * browser has done it. This is the proof that a build can create a project and
 * create the sample app, with the status codes and timings attached.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { benchDeps, buildReport, platformLabel, runCreateBench } from '../src/components/settings/DeveloperTab'

const args = process.argv.slice(2)
const argValue = (flag: string): string | null => {
  const i = args.indexOf(flag)
  return i >= 0 ? (args[i + 1] ?? null) : null
}
const API = (argValue('--api') ?? process.env.RE_API ?? 'http://127.0.0.1:8787').replace(/\/$/, '')
const OUT = argValue('--out')

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

let passed = 0
let failed = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; console.log(`FAIL  ${name} ${extra}`) }
}

console.log(`Developer bench — ${API}`)
console.log(`this machine: ${platformLabel()}`)

// 1. The server must be reachable and must say what it is running.
let health: any = null
try {
  const res = await fetch(`${API}/api/health`)
  health = await res.json()
  check('the server answers /api/health', res.ok, `status ${res.status}`)
} catch (e: any) {
  check('the server answers /api/health', false, String(e?.message ?? e))
  console.log('\nFAILURES: the server is not running — start it with `npm run dev` and try again.')
  process.exit(1)
}

check('it reports the version it is serving', typeof health?.web?.served?.version === 'string',
  JSON.stringify(health?.web ?? {}))
check('and it is the version this source tree is', health?.web?.served?.version === pkg.version,
  `served ${health?.web?.served?.version}, source ${pkg.version}`)

// 2. Both create flows, through the bench core the buttons use.
const deps = await benchDeps(API)
const project = await runCreateBench('project', { ...deps, health, stamp: 'bench' })
console.log('\n' + buildReport(project, health, pkg.version))
check('the bench can create a project', project.ok, project.steps.map((s) => s.value).join(' | '))
check('and it did it in one request', project.steps.some((s) => s.label === 'Attempts' && s.value === '1'))
check('and it left nothing behind', project.steps.some((s) => s.label === 'Cleanup' && s.tone === 'dim'))

const sample = await runCreateBench('sample', { ...deps, health, stamp: 'bench' })
console.log('\n' + buildReport(sample, health, pkg.version))
check('the bench can create the sample app', sample.ok, sample.steps.map((s) => s.value).join(' | '))

// 3. Nothing survived either run.
const after = await (await fetch(`${API}/api/ide/projects`)).json()
const leftovers = (after.projects ?? []).map((p: any) => p.name).filter((n: string) => /^dev-test-bench/.test(n))
check('neither test project is left on disk', leftovers.length === 0, leftovers.join(', '))

const report = [
  buildReport(project, health, pkg.version),
  '',
  '— and the sample app —',
  '',
  buildReport(sample, health, pkg.version),
  '',
  `result: ${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`,
].join('\n')

if (OUT) {
  writeFileSync(OUT, report + '\n')
  console.log(`\nreport written to ${OUT}`)
}
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
