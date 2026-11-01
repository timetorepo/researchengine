// Smoke test: work-mode prompts and the prompt-bar effort slider.
// Run: npm run work-modes-test   (exits 1 on the first failed check)
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { inferWorkMode, workModePrompt, WORK_MODES } from '@/lib/prompts/workModes'
import { shapeSystemPrompt } from '@/lib/flow/classifier'
import { EffortSlider, indexFromX, stepIndex } from '@/components/input/EffortSlider'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
  if (!ok) failed++
}

// 1. Mode inference: explicit wins, then design, math, project (coding), research.
check('explicit mode wins', inferWorkMode({ design: true, explicit: 'math' }) === 'math')
check('design flag → design', inferWorkMode({ design: true }) === 'design')
check('math toggle → math', inferWorkMode({ math: true }) === 'math')
check('project → coding', inferWorkMode({ project: 'app' }) === 'coding')
check('plain chat → research', inferWorkMode({}) === 'research')

// 2. Prompts: research adds nothing; each other mode adds its own brief.
check('research prompt is empty', workModePrompt('research') === '')
check('four modes listed', WORK_MODES.length === 4)
check('design brief names design', /Design mode/.test(workModePrompt('design')))
check('coding brief names project files', /project/.test(workModePrompt('coding')))
check('math brief asks for LaTeX', /LaTeX/.test(workModePrompt('math')))

// 3. The composed system prompt carries the brief, and research stays unchanged.
const base = shapeSystemPrompt('factual', {})
const design = shapeSystemPrompt('factual', { workMode: 'design' })
const research = shapeSystemPrompt('factual', { workMode: 'research' })
check('design prompt includes design brief', design.includes(workModePrompt('design')))
check('research prompt equals base', research === base)
check('design prompt is longer than base', design.length > base.length)

// 4. Slider index math is clamped and rounds to the nearest step.
check('x=0 → first step', indexFromX(0, 200, 5) === 0)
check('x=width → last step', indexFromX(200, 200, 5) === 4)
check('x past the end clamps', indexFromX(999, 200, 5) === 4)
check('x negative clamps', indexFromX(-40, 200, 5) === 0)
check('middle rounds to step 2', indexFromX(100, 200, 5) === 2)
check('zero width is safe', indexFromX(50, 0, 5) === 0)
check('keyboard step clamps low', stepIndex(0, -1, 5) === 0)
check('keyboard step clamps high', stepIndex(4, 1, 5) === 4)
check('keyboard step moves', stepIndex(2, 1, 5) === 3)

// 5. Markup: a slider role with the current value and every label present.
const steps = [
  { id: 'medium', label: 'Medium', hint: 'the default' },
  { id: 'high', label: 'High', hint: 'reasons more' },
  { id: 'max', label: 'Max', hint: 'the most' },
]
const html = renderToStaticMarkup(React.createElement(EffortSlider, { steps, value: 'high', onChange: () => {} }))
check('renders role=slider', html.includes('role="slider"'))
check('aria-valuenow is the current step', html.includes('aria-valuenow="1"'))
check('shows Medium, High and Max', ['Medium', 'High', 'Max'].every((l) => html.includes(l)))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall work-mode and effort-slider checks passed')
