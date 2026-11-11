import { fanDefaults, fanLayout, fanPose, fanLayer, fanSlot } from '../src/components/ui/reactdrops/fan-layout.ts'
import { fanSpring, fanSettleTime } from '../src/components/ui/reactdrops/fan-motion.ts'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const o = { ...fanDefaults }
for (const n of [1, 2, 5, 9]) {
  const finite = Array.from({ length: n }, (_, i) => fanPose(i, n, o)).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rotation))
  ok(finite, `rest poses finite for n=${n}`)
  const layout = fanLayout(600, n, o)
  ok(layout.fit > 0 && layout.fit <= 1 && Number.isFinite(layout.stageHeight), `layout fit ${layout.fit.toFixed(3)} stage ${layout.stageHeight.toFixed(0)} n=${n}`)
  const act = fanPose(Math.floor(n / 2), n, o, Math.floor(n / 2))
  ok(act.rotation === 0, `active card straightens n=${n}`)
}
const a = fanPose(2, 5, o), b = fanPose(2, 5, o, 2), c = fanPose(4, 5, o, 2)
ok(b.y === a.y - o.lift, 'active card rises by lift')
ok(c.x > fanPose(4, 5, o).x, 'right side slides right when a card is active')
ok(fanPose(0, 5, o, 2).x < fanPose(0, 5, o).x, 'left side slides left when a card is active')
ok(fanLayer(0, 3, o) !== fanLayer(1, 3, o), 'layers are unique')
ok(fanSlot(0.999, 4) === 3 && fanSlot(-1, 4) === 0, 'fanSlot clamps')
ok(Math.abs(fanSpring(0, 1, 0)) < 1e-9 && Math.abs(fanSpring(10, 1, 0) - 1) < 1e-3, 'spring 0→1')
ok(fanSpring(fanSettleTime(0.9, 0.25) + 0.01, 0.9, 0.25) > 0.999, 'settle time honoured')
console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
