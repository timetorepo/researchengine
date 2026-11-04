// BoundedMap keeps the newest `max` entries and never grows past it.
import { BoundedMap } from '../src/services/boundedMap'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const m = new BoundedMap<string, number>(3)
for (let i = 0; i < 10; i++) m.set(`k${i}`, i)
check('size never exceeds the bound', m.size === 3, `size=${m.size}`)
check('the newest entries are kept', [...m.keys()].join(',') === 'k7,k8,k9')

m.set('k8', 80)
check('re-setting a key refreshes its position', [...m.keys()].join(',') === 'k7,k9,k8')
check('re-setting keeps the new value', m.get('k8') === 80)
check('set returns the map for chaining', m.set('z', 1) === m)

const unbounded = new BoundedMap<number, number>(1000)
for (let i = 0; i < 5000; i++) unbounded.set(i, i)
check('a long run stays at the bound', unbounded.size === 1000, `size=${unbounded.size}`)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
