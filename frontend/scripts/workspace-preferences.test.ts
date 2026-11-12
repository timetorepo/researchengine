import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sidebarWidth, workspaceLayout, studioPanelVisible, PINNABLE_TOOLS } from '../src/lib/shell/preferences'
test('sidebar widths are finite, bounded, and backward compatible', () => {
  for (const value of [undefined, null, NaN, Infinity, '300']) assert.equal(sidebarWidth(value), 248)
  assert.equal(sidebarWidth(20), 216)
  assert.equal(sidebarWidth(500), 360)
  assert.equal(sidebarWidth(280.3), 280)
})
test('layout fallback is focused without rewriting saved preferences', () => {
  for (const value of [undefined, 'unknown', null]) assert.equal(workspaceLayout(value), 'focused')
  assert.equal(workspaceLayout('overview'), 'overview')
  assert.equal(workspaceLayout('studio'), 'studio')
})
test('supporting work stays outside editors, settings and nested workflows', () => {
  for (const path of ['/chat/one', '/code/codersa', '/settings', '/workflows/run']) assert.equal(studioPanelVisible(path, 'studio', false), false)
  assert.equal(studioPanelVisible('/code', 'studio', true), false)
  for (const path of ['/', '/code', '/chats', '/library', '/workflows']) assert.equal(studioPanelVisible(path, 'studio', false), true)
  assert.equal(studioPanelVisible('/', 'focused', false), false)
})
test('pinnable routes are unique secondary tools', () => {
  assert.equal(new Set(PINNABLE_TOOLS.map((t) => t.to)).size, PINNABLE_TOOLS.length)
})
