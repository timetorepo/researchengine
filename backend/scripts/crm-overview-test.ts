/**
 * Offline check of the CRM overview: totals, the newest rows, the 14-day counts
 * and the coverage counts, against a stubbed Twenty. Run with:
 *   node ../node_modules/tsx/dist/cli.mjs scripts/crm-overview-test.ts
 */
import { crmOverview } from '../src/services/serviceClients'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name} ${detail}`) }
}

const day = 86_400_000
const ago = (d: number) => new Date(Date.now() - d * day - 1000).toISOString()

const people = [
  { id: 'p1', name: { firstName: 'Ada', lastName: 'Lovelace' }, jobTitle: 'Engineer', emails: { primaryEmail: 'ada@x.io' }, companyId: 'c1', createdAt: ago(0) },
  { id: 'p2', name: { firstName: 'Alan', lastName: '' }, jobTitle: '', emails: { primaryEmail: '' }, createdAt: ago(3) },
  { id: 'p3', name: { firstName: 'Grace', lastName: 'Hopper' }, jobTitle: 'Admiral', company: { name: 'Navy' }, createdAt: ago(20) },
  { id: 'p4', name: { firstName: 'Linus', lastName: '' }, jobTitle: '', company: { name: 'Navy' }, createdAt: ago(5) },
]
const companies = [
  { id: 'c1', name: 'Acme', domainName: { primaryLinkUrl: 'https://acme.test' }, createdAt: ago(1) },
  { id: 'c2', name: 'Initech', domainName: { primaryLinkUrl: '' }, createdAt: ago(13) },
]

const fake = (async (input: string | URL) => {
  const url = String(input)
  const body = url.includes('/rest/people') ? { data: { people }, totalCount: 42 } : { data: { companies } }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}) as unknown as typeof fetch

console.log('crm-overview-test')
const realFetch = globalThis.fetch
globalThis.fetch = fake
try {
  const res = await crmOverview(fake as any, { base: 'https://crm.test', key: 'k' })
  check('returns data', res.ok)
  if (res.ok) {
    const p = res.data.people
    const c = res.data.companies
    check('people total from totalCount', p.total === 42, String(p.total))
    check('companies total falls back to rows', c.total === 2, String(c.total))
    check('recent people newest first', p.recent[0]?.id === 'p1' && p.recent.length === 4)
    check('person detail prefers job title', p.recent[0]?.detail === 'Engineer')
    check('person without a job title shows the company', p.recent.find((r) => r.id === 'p4')?.detail === 'Navy')
    check('14-day counts: today, 3 days ago and 5 days ago', p.last14[13] === 1 && p.last14[10] === 1 && p.last14[8] === 1, JSON.stringify(p.last14))
    check('20-day-old record is outside the window', p.last14.reduce((a, b) => a + b, 0) === 3)
    check('coverage email counts filled values only', p.coverage.email === 1 && p.coverage.sample === 4, JSON.stringify(p.coverage))
    check('coverage job title', p.coverage.jobTitle === 2)
    check('coverage company (companyId or company)', p.coverage.company === 3)
    check('company domain coverage', c.coverage.domain === 1, JSON.stringify(c.coverage))
  }
  globalThis.fetch = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
  const denied = await crmOverview(globalThis.fetch as any, { base: 'https://crm.test', key: 'bad' })
  check('401 from Twenty is reported as 401', !denied.ok && denied.status === 401)
} finally {
  globalThis.fetch = realFetch
}
console.log(`\ncrm-overview-test: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
