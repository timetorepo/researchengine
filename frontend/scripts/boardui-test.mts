import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoardProgress, BoardProgressCircle } from '../src/components/ui/boardui/Progress'
import { BoardQuestionnaire } from '../src/components/ui/boardui/Questionnaire'
import { BoardTaskList } from '../src/components/ui/boardui/TaskList'
import { readOptions } from '../src/components/ui/boardui/Select'
let count = 0
function check(name: string, run: () => void) { run(); count++; console.log(`ok ${name}`) }
const render = (element: React.ReactElement) => renderToStaticMarkup(element)
check('determinate progress clamps to 0..100', () => { assert.match(render(React.createElement(BoardProgress, { value: 180, label: 'Download' })), /aria-valuenow="100"/); assert.match(render(React.createElement(BoardProgress, { value: -5, label: 'Download' })), /aria-valuenow="0"/) })
check('unknown progress has no percentage', () => { const html = render(React.createElement(BoardProgress, { label: 'Extracting' })); assert.ok(!html.includes('aria-valuenow')); assert.match(html, /data-indeterminate="true"/) })
check('non-finite progress is indeterminate, not NaN', () => { const html = render(React.createElement(BoardProgress, { value: NaN, label: 'Preparing' })); assert.ok(!html.includes('NaN')); assert.ok(!html.includes('aria-valuenow')) })
check('progress exposes accessible operation name', () => assert.match(render(React.createElement(BoardProgress, { label: 'Verifying archive' })), /aria-label="Verifying archive"/))
check('unknown circle has no invented percent', () => { const html = render(React.createElement(BoardProgressCircle, { label: 'Installing' })); assert.ok(!html.includes('%')); assert.ok(!html.includes('aria-valuenow')) })
check('circle uses recorded percentage', () => assert.match(render(React.createElement(BoardProgressCircle, { label: 'Download', value: 42 })), /42%/))
check('multiple questions render actual checkboxes', () => { const html = render(React.createElement(BoardQuestionnaire, { questionnaire: { items: [{ id: 'a', question: 'Tools?', options: ['React', 'TypeScript'], multiple: true }] }, onSubmit: () => {} })); assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2) })
check('single question renders radio inputs', () => assert.match(render(React.createElement(BoardQuestionnaire, { questionnaire: { items: [{ id: 'a', question: 'Delivery?', options: ['Local'] }] }, onSubmit: () => {} })), /type="radio"/))
check('submitted questionnaire renders saved answers without a send control', () => { const html = render(React.createElement(BoardQuestionnaire, { questionnaire: { submitted: true, answers: { a: 'Local' }, items: [{ id: 'a', question: 'Delivery?' }] }, onSubmit: () => {} })); assert.match(html, /Local/); assert.ok(!html.includes('Send answers')) })
check('cancelled questions cannot be submitted', () => { const html = render(React.createElement(BoardQuestionnaire, { questionnaire: { cancelled: true, items: [] }, onSubmit: () => {} })); assert.match(html, /cancelled/); assert.ok(!html.includes('<button')) })
check('task log distinguishes failed and completed events', () => { const html = render(React.createElement(BoardTaskList, { activities: [{ id: 'a', tool: 'read_file', status: 'failed', startedAt: 100, endedAt: 300 }] })); assert.match(html, /reported a failure/); assert.match(html, /0\/1 completed/); assert.match(html, /0.2s/) })
check('option parser retains disabled grouped options', () => { const result = readOptions(React.createElement('optgroup', { label: 'Group' }, React.createElement('option', { value: 'x', disabled: true }, 'Value'))); assert.deepEqual(result, [{ value: 'x', label: 'Value', disabled: true }]) })
console.log(`PASS: ${count} BoardUI adapter checks`)
