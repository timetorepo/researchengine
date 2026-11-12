// Isolated browser regression checks against the Vite dev server.
import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright-core/index.mjs'
const base = process.env.SHELL_PREVIEW_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, chromiumSandbox: true, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(`${base}/#/settings`)
  await page.evaluate(async () => {
    const { useStore } = await import('/src/stores/useStore.ts')
    const { useUI } = await import('/src/stores/useUI.ts')
    useStore.setState({ settings: { ...useStore.getState().settings, onboarded: true, compact: false, reduceMotion: true, updates: { autoCheck: false } } })
    useUI.setState({ settingsTab: 'appearance' })
  })
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  if (await skip.isVisible()) await skip.click()
  const control = page.getByRole('switch', { name: 'Compact mode', exact: true })
  await control.waitFor()
  const value = () => page.evaluate(async () => (await import('/src/stores/useStore.ts')).useStore.getState().settings.compact)
  const bounds = async () => {
    await page.waitForTimeout(350)
    const contained = await control.evaluate((element) => {
      const root = element.closest('[data-slot="switch"]')
      const track = root.querySelector('[data-slot="switch-control"]').getBoundingClientRect()
      const thumb = root.querySelector('[data-slot="switch-thumb"]').getBoundingClientRect()
      return thumb.left >= track.left && thumb.right <= track.right && thumb.top >= track.top && thumb.bottom <= track.bottom
    })
    assert.ok(contained, 'Thumb remains inside its track')
  }
  await bounds()
  await page.getByText('Compact mode', { exact: true }).click()
  assert.equal(await value(), true, 'Label click toggles once')
  await bounds()
  await control.focus()
  await page.keyboard.press('Space')
  assert.equal(await value(), false, 'Space toggles once')
  await bounds()
  await page.getByText('Compact mode', { exact: true }).click()
  await page.waitForTimeout(600)
  await page.reload()
  await page.evaluate(async () => (await import('/src/stores/useUI.ts')).useUI.setState({ settingsTab: 'appearance' }))
  await control.waitFor()
  assert.equal(await value(), true, 'Selection survives reload')
  await bounds()
  console.log('PASS: shared switch on/off geometry, label click, keyboard Space, compact setting persistence')
} finally { await browser.close() }
