import assert from 'node:assert/strict'
import { test } from 'node:test'
import { floatingNavigationVisible, matchesSection, PRIMARY_ROUTES, shellSectionLabel } from '../src/lib/shell/navigation'

for (const path of ['/', '/chats', '/code', '/library', '/workflows', '/quiz']) {
  test(`opt-in bar available on ${path}`, () => {
    assert.equal(floatingNavigationVisible(path, true), true)
    assert.equal(floatingNavigationVisible(path, false), false)
  })
}
for (const path of ['/chat', '/chat/one', '/code/codersa', '/code/codersa/session', '/settings', '/settings/appearance', '/workflows/run-1']) {
  test(`bar does not cover task surface ${path}`, () => assert.equal(floatingNavigationVisible(path, true), false))
}
test('embedded workbench hides bar without changing /code route', () => {
  assert.equal(floatingNavigationVisible('/code', true, true), false)
  assert.equal(floatingNavigationVisible('/code', true, false), true)
  assert.equal(floatingNavigationVisible('/library', true, true), true)
})
test('section matching respects path boundaries', () => {
  assert.equal(matchesSection('/code/codersa', '/code'), true)
  assert.equal(matchesSection('/coders', '/code'), false)
  assert.equal(matchesSection('/chats', '/chat'), false)
  assert.equal(matchesSection('/library', '/'), false)
})
test('context title resolves nested routes before parents', () => {
  assert.equal(shellSectionLabel('/code/codersa'), 'Codersa')
  assert.equal(shellSectionLabel('/code'), 'Coding')
  assert.equal(shellSectionLabel('/chat/one'), 'Research')
  assert.equal(shellSectionLabel('/chats'), 'Chats')
  assert.equal(shellSectionLabel('/settings/appearance'), 'Settings')
  assert.equal(shellSectionLabel('/'), 'Home')
})
test('primary destinations are ordered and unique', () => {
  assert.deepEqual(PRIMARY_ROUTES, ['/', '/chats', '/code', '/library', '/workflows'])
  assert.equal(new Set(PRIMARY_ROUTES).size, PRIMARY_ROUTES.length)
})
