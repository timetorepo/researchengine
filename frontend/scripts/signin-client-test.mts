// Sign-in client: fresh attempt ids, the done address, and the Pipedream form rules.
// Runs in Node with stand-ins for the browser globals the store needs.
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
;(globalThis as any).window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, location: { origin: 'http://localhost:5173', search: '', href: 'http://localhost:5173/' } }
const { newSignInId, signInDoneUrl } = await import('../src/lib/signin/client.ts')
const { pipedreamProblem } = await import('../src/lib/pipedream/client.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`) }

const a = newSignInId(), b = newSignInId()
check('attempt id is 32 hex characters', /^[0-9a-f]{32}$/.test(a), a)
check('attempt ids differ', a !== b)
check('done address points at the done page of this origin', signInDoneUrl(a) === `http://localhost:5173/api/signin/${a}/done`)

const good = { clientId: 'cid', clientSecret: 'sec', projectId: 'proj_abcd1234', environment: 'development' as const }
check('complete form has no problem', pipedreamProblem(good) === null)
check('missing client ID explained', /client ID/.test(pipedreamProblem({ ...good, clientId: ' ' }) ?? ''))
check('missing secret explained', /client secret/.test(pipedreamProblem({ ...good, clientSecret: '' }) ?? ''))
check('project without proj_ explained', /proj_/.test(pipedreamProblem({ ...good, projectId: 'abcd' }) ?? ''))
check('bad environment explained', /development or production/.test(pipedreamProblem({ ...good, environment: 'staging' as any }) ?? ''))

console.log(`signin-client-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
