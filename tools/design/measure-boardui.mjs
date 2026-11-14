import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'
const base = process.env.SHELL_PREVIEW_URL ?? 'http://127.0.0.1:4173'
const artifacts = '.cache/boardui-performance'; await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, headless: true, chromiumSandbox: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
 await page.addInitScript(() => {
   if (!localStorage.getItem('re.data.main:research-engine-v1')) localStorage.setItem('re.data.main:research-engine-v1', JSON.stringify({ state: { settings: { onboarded: true, reduceMotion: false, homeWidgets: false, updates: { autoCheck: false }, composio: { token: 'isolated-test', userId: 'local' } } }, version: 0 }))
 })
 await page.route('**/api/**', async (route) => {
   const path = new URL(route.request().url()).pathname
   let body = {}
   if (path.endsWith('/status')) body = { ok: true, apps: 2 }
   if (path.endsWith('/apps')) body = { apps: [{ slug: 'github', name: 'GitHub', description: 'Source control', categories: ['Developer'], authSchemes: ['OAUTH2'], noAuth: false, toolsCount: 1 }] }
   if (path.endsWith('/accounts')) body = { accounts: [] }
   if (path.endsWith('/projects')) body = { projects: [{ name: 'perf-fixture' }] }
   if (path.endsWith('/tree')) body = { tree: [{ path: 'src', name: 'src', dir: true, children: Array.from({ length: 1000 }, (_, i) => ({ path: `src/file-${i}.ts`, name: `file-${i}.ts`, dir: false })) }] }
   await route.fulfill({ json: body })
 })
 await page.goto(`${base}/#/chats`)
 await page.getByRole('button', { name: 'Settings', exact: true }).waitFor()
 await page.getByText('No conversations yet.', { exact: true }).waitFor()
 await browser.startTracing(page, { path: `${artifacts}/browser-trace.json`, screenshots: false })
 const results = []
 const sample = async (name, action) => {
   await page.evaluate(() => {
     window.__perf = { frames: [], longTasks: [], active: true, last: performance.now() }
     window.__perf.observer = new PerformanceObserver((list) => window.__perf.longTasks.push(...list.getEntries().map((e) => e.duration)))
     window.__perf.observer.observe({ type: 'longtask', buffered: false })
     const frame = (now) => { if (!window.__perf.active) return; window.__perf.frames.push(now - window.__perf.last); window.__perf.last = now; requestAnimationFrame(frame) }; requestAnimationFrame(frame)
   })
   await action(); await page.waitForTimeout(350)
   const data = await page.evaluate(() => { const s = window.__perf; s.active = false; s.observer.disconnect(); const frames = s.frames.slice(1).sort((a,b) => a-b); return { frames: frames.length, p95FrameMs: frames[Math.floor(frames.length * .95)] ?? 0, maxFrameMs: frames.at(-1) ?? 0, over25ms: frames.filter((n) => n > 25).length, longTaskCount: s.longTasks.length, maxLongTaskMs: Math.max(0,...s.longTasks) } })
   results.push({ name, ...data })
 }
 await sample('settings-first-open', async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor() })
 await sample('settings-profile-tab', async () => { await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click(); await page.getByRole('region', { name: 'Profile signature' }).waitFor() })
 await page.getByRole('button', { name: 'Close settings', exact: true }).click()
 await sample('settings-warm-open-close', async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor(); await page.getByRole('button', { name: 'Close settings', exact: true }).click() })
 await page.goto(`${base}/#/marketplace`); await page.getByRole('button', { name: 'Filters', exact: true }).waitFor()
 await sample('marketplace-filter-drawer', async () => { await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.getByRole('dialog', { name: 'Marketplace filters' }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click() })
 await page.goto(`${base}/#/code?project=perf-fixture`); const tree = page.getByRole('tree', { name: 'Project files', exact: true }); await tree.waitFor()
 await sample('1000-file-tree-keyboard-scroll', async () => { await tree.getByRole('treeitem').first().focus(); await page.keyboard.press('End'); await page.keyboard.press('Home'); await page.keyboard.press('End') })
 await browser.stopTracing()
 const report = { environment: { browser: await browser.version(), viewport: '1440x1000', headless: true, productionBuild: true, cpuThrottle: 'none', services: 'explicitly mocked', physicalDevice: false, motion: 'enabled', caveat: 'Sandbox rAF intervals are not physical-device FPS certification. Samples include first-use chunk work and idle tail.' }, results }
 await writeFile(`${artifacts}/summary.json`, JSON.stringify(report, null, 2)+'\n'); console.log(JSON.stringify(report,null,2))
} finally { await browser.close() }
