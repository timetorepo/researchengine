// Batched persistence: one write per window, the latest value wins, flushes are
// immediate, and a change is written to the namespace it was made in.
import { createDeferredJsonStorage, freezePendingWrites } from '../src/lib/storage/deferredJson'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function harness() {
  const store = new Map<string, string>()
  const writes: { ns: string; name: string; json: string }[] = []
  let ns = 'main'
  const io = {
    namespace: () => ns,
    read: (name: string) => store.get(`${ns}:${name}`) ?? null,
    write: (n: string, name: string, json: string) => {
      writes.push({ ns: n, name, json })
      store.set(`${n}:${name}`, json)
    },
    remove: (n: string, name: string) => { store.delete(`${n}:${name}`) },
  }
  return { store, writes, io, setNs: (v: string) => { ns = v } }
}

// 1. Many changes inside one window produce one write, holding the latest value.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 30)
  for (let i = 0; i < 50; i++) s.setItem('state', { n: i })
  check('no write before the window closes', h.writes.length === 0)
  await sleep(60)
  check('one write after the window', h.writes.length === 1, `writes=${h.writes.length}`)
  check('the latest value is what lands', h.writes[0]?.json === JSON.stringify({ n: 49 }))
}

// 2. flush() writes at once and does not wait for the timer.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 10_000)
  s.setItem('state', { a: 1 })
  s.flush()
  check('flush writes immediately', h.writes.length === 1 && h.writes[0].json === '{"a":1}')
  s.flush()
  check('a second flush with nothing pending writes nothing', h.writes.length === 1)
}

// 3. A change made in one namespace flushes into that namespace, even if the
//    active namespace has changed by the time the window closes.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 10_000)
  s.setItem('state', { who: 'main' })
  h.setNs('guest')
  s.flush()
  check('pending write lands in the namespace it was made in', h.writes[0]?.ns === 'main', `ns=${h.writes[0]?.ns}`)
}

// 4. getItem parses what was stored; corrupt JSON reads as empty, not a throw.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 10)
  h.store.set('main:state', '{"ok":true}')
  check('getItem parses stored JSON', JSON.stringify(s.getItem('state')) === '{"ok":true}')
  h.store.set('main:state', '{broken')
  check('corrupt JSON reads as null', s.getItem('state') === null)
  check('missing key reads as null', s.getItem('nothing') === null)
}

// 5. removeItem drops a pending write so it cannot resurrect the key.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 20)
  s.setItem('state', { x: 1 })
  s.removeItem('state')
  await sleep(50)
  check('a removed key is not written back', h.writes.length === 0)
}

// 6. A wipe freezes every store: a write that was pending does not come back,
//    and nothing written after the freeze lands either.
{
  const h = harness()
  const s = createDeferredJsonStorage(h.io, 20)
  s.setItem('state', { chats: ['old'] })
  freezePendingWrites()
  await sleep(50)
  s.setItem('state', { chats: ['old', 'later'] })
  s.flush()
  await sleep(50)
  check('a pending write is dropped by the freeze', h.writes.length === 0, `writes=${h.writes.length}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
