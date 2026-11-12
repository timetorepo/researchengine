// Development-server smoke test; requires npm ci --prefix tools/design and a
// supported Chromium browser. Optional: BROWSER_EXECUTABLE=/path/to/chromium.
// Run from the repo root. All seeded preferences stay in an isolated context.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'

const base = process.env.SHELL_PREVIEW_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  chromiumSandbox: true,
  headless: true,
})
const artifacts = '.cache/shell-review'
await mkdir(artifacts, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/#/chats`)
  await page.evaluate(async () => {
    const { useStore } = await import('/src/stores/useStore.ts')
    const { useUI } = await import('/src/stores/useUI.ts')
    useStore.setState({ settings: { ...useStore.getState().settings,
      onboarded: true, experimentalTabBar: true, showMusicControl: false,
      updates: { autoCheck: false } } })
    useUI.setState({ sidebarCollapsed: false })
  })
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true })
  await nav.waitFor()
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  if (await skip.isVisible()) await skip.click()
  for (const name of ['Home', 'Chats', 'Coding', 'Library', 'Workflows']) {
    assert.equal(await nav.getByRole('link', { name, exact: true }).count(), 1)
  }
  await page.getByTestId('floating-navigation').waitFor()
  await page.waitForTimeout(400) // screenshot after the existing route entrance
  await page.screenshot({ path: `${artifacts}/chats-desktop.png` })
  const main = await page.locator('main').boundingBox()
  const bar = await page.getByTestId('floating-navigation').boundingBox()
  assert.ok(Math.abs(bar.x + bar.width / 2 - (main.x + main.width / 2)) < 1)
  const content = await page.locator('main > div').first().boundingBox()
  assert.ok(content.y + content.height <= bar.y, 'Bar must have reserved content clearance')

  const trigger = page.getByRole('button', { name: 'Workspace tools', exact: true })
  await trigger.click()
  const panel = page.getByRole('dialog', { name: 'Workspace tools', exact: true })
  await panel.waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${artifacts}/tools-desktop.png` })
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  assert.ok(await trigger.evaluate((element) => element === document.activeElement), 'Focus returns to trigger')
  await page.getByRole('button', { name: 'More tools', exact: true }).click()
  assert.equal(await nav.getByRole('link', { name: 'Learn', exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem('re.sidebar.collapsed')), 'true')
  await page.reload()
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor()
  await page.goto(`${base}/#/code`)
  await page.getByTestId('floating-navigation').waitFor()
  // Exercise embedded-workbench policy without opening/mutating a real project.
  await page.evaluate(async () => {
    const { useUI } = await import('/src/stores/useUI.ts')
    useUI.setState({ codingWorkbenchOpen: true })
  })
  await page.getByTestId('floating-navigation').waitFor({ state: 'hidden' })
  await page.goto(`${base}/#/code/codersa`)
  await page.waitForTimeout(400)
  assert.equal(await page.getByTestId('floating-navigation').count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/#/chats`)
  await page.getByTestId('floating-navigation').waitFor()
  await page.screenshot({ path: `${artifacts}/chats-mobile.png` })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await drawer.waitFor()
  assert.equal(await drawer.getByRole('link', { name: 'Chats', exact: true }).count(), 1)
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'hidden' })
  await page.setViewportSize({ width: 320, height: 720 })
  const smallBar = await page.getByTestId('floating-navigation').boundingBox()
  assert.ok(smallBar.x >= 0 && smallBar.x + smallBar.width <= 320)
  assert.deepEqual(errors, [])
  console.log('PASS: navigation, floating clearance/centering, tools Escape/focus restoration, sidebar persistence, coding policy, 390/320px layouts; no page errors')
} finally {
  await browser.close()
}
