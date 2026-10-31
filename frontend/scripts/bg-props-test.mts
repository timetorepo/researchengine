import { getPropsForTheme, ANIMATED_BG_META, mixVec3 } from '../src/lib/backgrounds/themeProps'
import { THEMES } from '../src/lib/themes/meta'
import { ANIMATED_BG_KINDS } from '../src/types/index.ts'
let fail = 0
for (const t of THEMES) {
  const p = getPropsForTheme(t.id)
  const ok = [p.bg, p.surface, p.primary, p.secondary].every((v) =>
    Array.isArray(v) && v.length === 3 && v.every((n) => n >= 0 && n <= 1))
  if (!ok) { fail++; console.log('FAIL', t.id) }
}
const kinds = Object.keys(ANIMATED_BG_META)
// Every registered kind must have metadata (the count grows as kinds are added).
const missing = ANIMATED_BG_KINDS.filter((k) => !(k in ANIMATED_BG_META))
if (missing.length || kinds.length !== ANIMATED_BG_KINDS.length) { fail++; console.log('FAIL kinds', missing) }
const m = mixVec3([0,0,0],[1,1,1],0.5)
if (m[0] !== 0.5) { fail++; console.log('FAIL mix') }
console.log(fail === 0 ? `BG PROPS OK — ${THEMES.length} themes, ${kinds.length} kinds` : `${fail} failures`)
process.exit(fail ? 1 : 0)
