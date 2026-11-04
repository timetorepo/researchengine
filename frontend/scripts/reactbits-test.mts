/**
 * ReactBits backgrounds and components, checked without a browser:
 *
 *  1. Every ReactBits kind is registered in ANIMATED_BG_KINDS and has metadata.
 *  2. Every non-built-in kind has a lazy ReactBits mapping, and the built-in kinds do not.
 *  3. Each vendored component is on disk as .jsx + .css, and exports a default component.
 *  4. The user-specified prop overrides are in the adapter: Silk clickRipple, Galaxy
 *     mouseRepulsion, LiquidChrome interactive, all false.
 *  5. The licence notice travels with the vendored code, and the old R3F FloatingLines is gone.
 *  6. GooeyNav and CardSwap are wired in (kind switch, session switcher).
 *
 * Run: npm run reactbits-test --workspace frontend
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (p: string) => path.join(root, 'src', p)
const read = (p: string) => readFileSync(src(p), 'utf8')

let passed = 0
const check = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const { ANIMATED_BG_KINDS } = await import('../src/types/index.ts')
const { ANIMATED_BG_META } = await import('../src/lib/backgrounds/themeProps.ts')

const BUILT_IN = ['shape-grid', 'dark-veil', 'dither', 'animated-gradient', 'etched-accretion']
const REACTBITS = [
  'gradient-ascii', 'ghost-fibers', 'topography', 'prism', 'light-pillar', 'antigravity', 'silk',
  'pixel-blast', 'color-bends', 'plasma', 'prismatic-burst', 'galaxy', 'liquid-chrome',
  'floating-lines',
]
// Component folder names, as vendored under src/components/reactbits/.
const VENDORED = [
  'GooeyNav', 'CardSwap', 'GradientASCII', 'GhostFibers', 'Topography', 'Prism', 'LightPillar',
  'Antigravity', 'Silk', 'FloatingLines', 'PixelBlast', 'ColorBends', 'Plasma', 'PrismaticBurst',
  'Galaxy', 'LiquidChrome',
]

console.log('ReactBits')

check('all ReactBits kinds are registered', () => {
  for (const k of [...REACTBITS, ...BUILT_IN]) assert.ok((ANIMATED_BG_KINDS as readonly string[]).includes(k), `missing kind ${k}`)
})

check('every animated kind has label, description and default intensity', () => {
  for (const k of ANIMATED_BG_KINDS) {
    const m = ANIMATED_BG_META[k]
    assert.ok(m, `no meta for ${k}`)
    assert.ok(m.label && m.desc, `empty label/desc for ${k}`)
    assert.ok(m.defaultIntensity > 0 && m.defaultIntensity <= 1, `bad intensity for ${k}`)
  }
})

check('the ReactBits mapping covers exactly the ReactBits kinds', () => {
  const adapter = read('components/backgrounds/reactBitsBackgrounds.tsx')
  for (const k of REACTBITS) assert.ok(adapter.includes(`'${k}'`) || adapter.includes(`${k}:`), `no mapping for ${k}`)
  for (const k of BUILT_IN) assert.ok(!new RegExp(`['"]?${k}['"]?:\\s*rb\\(`).test(adapter), `built-in ${k} must not be mapped to ReactBits`)
})

check('each vendored component has .jsx and .css, and a default export', () => {
  for (const name of VENDORED) {
    const jsx = `components/reactbits/${name}/${name}.jsx`
    const css = `components/reactbits/${name}/${name}.css`
    assert.ok(existsSync(src(jsx)), `missing ${jsx}`)
    assert.ok(existsSync(src(css)), `missing ${css}`)
    assert.match(read(jsx), /export default /, `${name} has no default export`)
  }
})

check('the user-specified prop overrides are set to false', () => {
  const adapter = read('components/backgrounds/reactBitsBackgrounds.tsx')
  assert.match(adapter, /clickRipple: false/)
  assert.match(adapter, /mouseRepulsion: false/)
  assert.match(adapter, /interactive: false/)
})

check('licence notice is shipped; the old R3F FloatingLines is removed', () => {
  assert.ok(existsSync(src('components/reactbits/LICENSE-REACTBITS.md')), 'licence notice missing')
  assert.match(read('components/reactbits/LICENSE-REACTBITS.md'), /Commons Clause/)
  assert.ok(!existsSync(src('components/backgrounds/FloatingLines.tsx')), 'old FloatingLines should be removed')
  assert.ok(!/from '\.\/FloatingLines'/.test(read('components/backgrounds/BackgroundManager.tsx')), 'BackgroundManager still imports old FloatingLines')
})

check('GooeyNav is the Chats kind switch; CardSwap is the session switcher', () => {
  assert.match(read('components/chats/ChatsView.tsx'), /GooeyNav/)
  assert.ok(!/from '@heroui\/tabs'/.test(read('components/chats/ChatsView.tsx')), 'HeroUI Tabs should be replaced')
  assert.match(read('components/sessions/SessionSwitcher.tsx'), /CardSwap/)
  assert.match(read('components/sessions/SessionSwitcher.tsx'), /autoplay=\{false\}/)
  assert.match(read('components/sessions/SessionSwitcher.tsx'), /onCardClick=/)
  assert.match(read('components/topbar/TopBar.tsx'), /SESSION_SWITCHER_EVENT/)
})

console.log(`\nreactbits-test: ${passed} passed, 0 failed`)
