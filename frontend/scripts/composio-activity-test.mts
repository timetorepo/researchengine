// Connected-services activity: changes between two readings of the accounts become
// "connected" / "disconnected" events. Runs in Node with a stand-in for localStorage
// (the store persists to it).
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
;(globalThis as any).window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, location: { origin: 'http://x', search: '', href: 'http://x/' } }
const { diffSnapshots, snapshotOf, useComposioActivity, MAX_EVENTS } = await import('/home/user/researchengine/frontend/src/lib/composio/activity.ts')
let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`) }

const A = { id: 'ca_1', toolkit: 'gmail' }, B = { id: 'ca_2', toolkit: 'github' }, C = { id: 'ca_3', toolkit: 'slack' }

const d1 = diffSnapshots([A], [A, B], 'u1', 100)
check('a new account is reported as connected', d1.length === 1 && d1[0].kind === 'connected' && d1[0].toolkit === 'github')
const d2 = diffSnapshots([A, B], [A], 'u1', 200)
check('a missing account is reported as disconnected', d2.length === 1 && d2[0].kind === 'disconnected' && d2[0].accountId === 'ca_2')
check('no change, no events', diffSnapshots([A], [A], 'u1', 300).length === 0)
const d3 = diffSnapshots([A], [B, C], 'u1', 400)
check('a swap yields both kinds', d3.filter((e) => e.kind === 'connected').length === 2 && d3.filter((e) => e.kind === 'disconnected').length === 1)
check('events are newest first', diffSnapshots([], [A], 'u', 1).length === 1 && d3.every((e, i, arr) => i === 0 || arr[i - 1].at >= e.at))

const inactive = [{ id: 'ca_9', toolkit: 'Notion', status: 'INITIATED' }, { id: 'ca_8', toolkit: 'Notion', status: 'ACTIVE' }] as any
const snaps = snapshotOf(inactive, (a: any) => a.status === 'ACTIVE')
check('only active accounts are snapshotted, lower-cased', snaps.length === 1 && snaps[0].id === 'ca_8' && snaps[0].toolkit === 'notion')

const st = useComposioActivity.getState()
const first = st.observe('user-a', [{ id: 'x', toolkit: 'gmail' }], 1000)
check('the first reading only sets a baseline', first.length === 0 && useComposioActivity.getState().events.length === 0)
const second = useComposioActivity.getState().observe('user-a', [], 2000)
check('a later reading reports the change', second.length === 1 && second[0].kind === 'disconnected')
const other = useComposioActivity.getState().observe('user-b', [{ id: 'y', toolkit: 'slack' }], 2500)
check('another user starts from their own baseline (no events)', other.length === 0)
const back = useComposioActivity.getState().observe('user-b', [], 3000)
check('user-b changes are tagged with user-b', back.length === 1 && back[0].userId === 'user-b')
check('events from both users are kept in one list', useComposioActivity.getState().events.some((e) => e.userId === 'user-a') && useComposioActivity.getState().events.some((e) => e.userId === 'user-b'))

useComposioActivity.getState().clear()
for (let i = 0; i < 40; i++) {
  useComposioActivity.getState().observe('cap', [{ id: `s${i}`, toolkit: 'x' }], 10_000 + i * 2)
  useComposioActivity.getState().observe('cap', [], 10_001 + i * 2)
}
const ev = useComposioActivity.getState().events
check(`the list is capped at ${MAX_EVENTS}`, MAX_EVENTS === 30 && ev.length === 30, `len ${ev.length}`)
check('the capped list keeps the newest', ev[0].at >= ev[ev.length - 1].at)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
