import { getPropsForTheme, ANIMATED_BG_META, mixVec3 } from '../src/lib/backgrounds/themeProps'
import { THEMES } from '../src/lib/themes/meta'
let fail = 0
for (const t of THEMES) {
  const p = getPropsForTheme(t.id)
  const ok = [p.bg, p.surface, p.primary, p.secondary].every((v) =>
    Array.isArray(v) && v.length === 3 && v.every((n) => n >= 0 && n <= 1))
  if (!ok) { fail++; console.log('FAIL', t.id) }
}
const kinds = Object.keys(ANIMATED_BG_META)
if (kinds.length !== 4) { fail++; console.log('FAIL kinds', kinds) }
const m = mixVec3([0,0,0],[1,1,1],0.5)
if (m[0] !== 0.5) { fail++; console.log('FAIL mix') }
console.log(fail === 0 ? `BG PROPS OK — ${THEMES.length} themes, ${kinds.length} kinds` : `${fail} failures`)
process.exit(fail ? 1 : 0)
