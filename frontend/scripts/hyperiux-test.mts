// Wiring checks for the Hyperiux / badtzx0 components and the Glisse switch.
// Static reads only: each component is placed where it should be, and carries
// its credit line.
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const dir = 'src/components/ui/hyperiux'
const files = readdirSync(new URL(`../${dir}`, import.meta.url)).filter((f) => f.endsWith('.tsx'))
ok(files.length === 9, `nine components present (found ${files.length})`)
for (const f of files) {
  const src = read(`${dir}/${f}`)
  ok(/https:\/\/21st\.dev\/@(hyperiux|badtzx0)/.test(src), `${f} credits its 21st.dev listing`)
  ok(/not a copy of the upstream source/.test(src), `${f} says it is rebuilt, not copied`)
}

const onboarding = read('src/components/onboarding/Onboarding.tsx')
for (const [name, file] of [['CardFlip', 'card-flip'], ['PortalCarousel', 'portal-carousel'], ['AnimatedCardChart', 'animated-card-chart'],
  ['AnimatedCardDiagram', 'animated-card-diagram'], ['StackLoader', 'stack-loader'], ['PixelTextFill', 'pixel-text-fill'], ['BlockTransition', 'block-transition']] as const) {
  ok(onboarding.includes(`<${name}`) && onboarding.includes(`hyperiux/${file}'`), `onboarding mounts ${name}`)
}
ok(onboarding.includes('<BlockTransition transitionKey={step} />'), 'block transition keys on the step')

const thinking = read('src/components/chat/ThinkingIndicator.tsx')
ok(thinking.includes("style === 'typing'") && thinking.includes('<TypingText'), 'typing loader is a thinking style')
ok(read('src/components/settings/FlowTab.tsx').includes("{ id: 'typing', name: 'Typing' }"), 'typing style is offered in Settings → Flow')
ok(read('src/types/index.ts').includes("'verbose' | 'typing'"), 'thinkingStyle type accepts typing')

const tabs = read('src/components/codersa/CodingTabs.tsx')
ok(tabs.includes("from 'glisse'") && tabs.includes("import 'glisse/styles.css'") && tabs.includes('<SegmentedControl'), 'Codersa tabs use Glisse')

ok(read('src/components/settings/AboutTab.tsx').includes('ScrambleLinkButton'), 'About page uses the scramble link')
ok(read('../THIRD-PARTY-NOTICES.md').includes('Glisse (MIT)') && read('../THIRD-PARTY-NOTICES.md').includes('Hyperiux Vault'), 'notices credit Glisse and Hyperiux')

console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
