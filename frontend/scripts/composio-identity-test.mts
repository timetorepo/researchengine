// Composio identity: Automatic makes one id per device; My Composio account uses
// the person's own id, and bad ids are refused. Runs in Node with a stand-in for
// localStorage and window (the store persists to them).
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
;(globalThis as any).window = { addEventListener() {}, dispatchEvent() { return true }, location: { origin: 'http://x', search: '', href: 'http://x/' } }
const { composioUserId, setComposioIdentity, composioIdentity, COMPOSIO_USER_RE } = await import('/home/user/researchengine/frontend/src/lib/composio/client.ts')
let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`) }

check('email-style ids are accepted', COMPOSIO_USER_RE.test('you@example.com'))
check('ids with spaces are refused', !COMPOSIO_USER_RE.test('bad id'))
check('empty id is refused', !COMPOSIO_USER_RE.test(''))
const auto = composioUserId()
check('automatic id is made once and starts with re-', auto.startsWith('re-') && composioUserId() === auto)
check('a bad account id is refused with a message', !!setComposioIdentity('account', 'bad id'))
check('account mode refuses a bad id and stays automatic', composioIdentity().mode === 'automatic')
check('a good account id is used', setComposioIdentity('account', 'you@example.com') === null && composioUserId() === 'you@example.com')
setComposioIdentity('automatic')
check('switching back restores the automatic id', composioUserId() === auto && composioIdentity().mode === 'automatic')
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
