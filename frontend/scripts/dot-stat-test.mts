// Checks the dot-stat card's maths and markup. Renders it to HTML and counts the dots.
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { DotStatCard, dotsFilled, formatPercent } from '../src/components/ui/dotstat/DotStatCard'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failed++
}

check('42 of 100 dots are lit', dotsFilled(42, 100) === 42)
check('values are clamped to 0–100', dotsFilled(150, 100) === 100 && dotsFilled(-5, 100) === 0)
check('a NaN value lights nothing', dotsFilled(Number.NaN, 100) === 0)
check('rounding goes to the nearest dot', dotsFilled(42.4, 90) === 38)
check('whole numbers show no decimals', formatPercent(42) === '42%')
check('fractions show one decimal', formatPercent(42.25) === '42.3%')

const html = renderToStaticMarkup(React.createElement(DotStatCard, { value: 42, previous: 50, label: 'Customer Acquisition', total: 100, columns: 15 }))
const dots = (html.match(/aspect-square/g) ?? []).length
check('the grid has 100 dots', dots === 100, String(dots))
check('the big number is shown', html.includes('42%'))
check('the comparison is shown', html.includes('vs 50% previous'))
check('the label is shown', html.includes('Customer Acquisition'))
const note = renderToStaticMarkup(React.createElement(DotStatCard, { value: 10, label: 'Signups', note: 'vs last month' }))
check('a note replaces the comparison when there is no previous value', note.includes('vs last month') && !note.includes('previous'))

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`)
process.exit(failed === 0 ? 0 : 1)
