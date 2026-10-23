// Composio identity: each person saves their own Composio user id. Until one is
// saved nothing is listed or connected, and bad ids are refused. Runs in Node with
// a stand-in for localStorage and window (the store persists to them).
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
;(globalThis as any).window = { addEventListener() {}, dispatchEvent() { return true }, location: { origin: 'http://x', search: '', href: 'http://x/' } }
const { composioUserId, setComposioIdentity, composioIdentity, hasComposioUserId, COMPOSIO_USER_RE } = await import('/home/user/researchengine/frontend/src/lib/composio/client.ts')
let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`) }

check('email-style ids are accepted', COMPOSIO_USER_RE.test('you@example.com'))
check('ids with spaces are refused', !COMPOSIO_USER_RE.test('bad id'))
check('empty id is refused', !COMPOSIO_USER_RE.test(''))
check('no id saved yet', !hasComposioUserId() && composioIdentity().accountUserId === '')
let threw = false
try { composioUserId() } catch { threw = true }
check('connecting without an id throws a plain message', threw)
check('a bad id is refused with a message', !!setComposioIdentity('bad id'))
check('a refused id is not saved', !hasComposioUserId())
check('a good id is saved', setComposioIdentity('  you@example.com ') === null && composioUserId() === 'you@example.com')
check('the saved id is what the composio routes use', composioIdentity().accountUserId === 'you@example.com')
check('changing the id replaces it', setComposioIdentity('team_42') === null && composioUserId() === 'team_42')
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
