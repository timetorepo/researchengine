import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'
const base = process.env.SHELL_PREVIEW_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, headless: true, chromiumSandbox: true })
await mkdir('.cache/boardui-review-results', { recursive: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message))
 await page.route('**/api/composio/**', async (route) => {
   const url = new URL(route.request().url()); let body = {}
   if (url.pathname.endsWith('/status')) body = { ok: true, apps: 2 }
   if (url.pathname.endsWith('/apps')) body = { apps: [{ slug: 'github', name: 'GitHub', description: 'Source control', categories: ['Developer'], authSchemes: ['OAUTH2'], noAuth: false, toolsCount: 1 }, { slug: 'gmail', name: 'Gmail', description: 'Email', categories: ['Communication'], authSchemes: ['OAUTH2'], noAuth: false, toolsCount: 1 }] }
   if (url.pathname.endsWith('/accounts')) body = { accounts: [] }
   if (url.pathname.endsWith('/tools')) body = { tools: [{ slug: 'GITHUB_LIST_REPOS', name: 'List repositories', description: 'Read repositories available to the connected account.' }] }
   await route.fulfill({ json: body })
 })
 await page.route('**/api/ide/**', async (route) => {
   const url = new URL(route.request().url()); let body = {}
   if (url.pathname.endsWith('/projects')) body = { projects: [{ name: 'board-fixture' }] }
   if (url.pathname.endsWith('/tree')) body = { tree: [{ path: 'src', name: 'src', dir: true, children: Array.from({ length: 1000 }, (_, i) => ({ path: `src/file-${String(i).padStart(4,'0')}.ts`, name: `file-${String(i).padStart(4,'0')}.ts`, dir: false })) }] }
   if (url.pathname.endsWith('/file')) body = { content: '// seeded local fixture', language: 'typescript' }
   if (url.pathname.endsWith('/status')) body = { branch: 'test', files: [] }
   await route.fulfill({ json: body })
 })
 await page.goto(`${base}/#/chats`)
 await page.evaluate(async () => {
   const { useStore } = await import('/src/stores/useStore.ts'); const { useUI } = await import('/src/stores/useUI.ts')
   useStore.setState({ settings: { ...useStore.getState().settings, onboarded: true, reduceMotion: true, updates: { autoCheck: false }, composio: { token: 'isolated-test-placeholder', userId: 'local-test' } } })
   useUI.setState({ connectorsTab: 'apps' })
 })
 const skip = page.getByRole('button', { name: 'Skip', exact: true }); if (await skip.isVisible()) await skip.click()
 await page.goto(`${base}/#/marketplace`)
 await page.getByRole('button', { name: 'Filters', exact: true }).click()
 const drawer = page.getByRole('dialog', { name: 'Marketplace filters', exact: true })
 const select = drawer.getByRole('combobox', { name: 'Marketplace category' }); await select.click()
 await page.getByRole('option', { name: 'Developer', exact: true }).click()
 await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
 await page.getByRole('button', { name: 'Filters', exact: true }).waitFor()
 await page.getByRole('button', { name: 'Filters', exact: true }).click()
 await select.click(); await page.getByRole('option', { name: 'Developer', exact: true }).click()
 await drawer.getByRole('button', { name: 'Apply filters', exact: true }).click()
 await page.getByRole('button', { name: 'Filters (1)', exact: true }).waitFor()
 await page.screenshot({ path: '.cache/boardui-review-results/marketplace.png' })
 await page.goto(`${base}/#/marketplace/github`)
 await page.getByRole('button', { name: /List repositories/ }).click()
 await page.getByText('GITHUB_LIST_REPOS', { exact: true }).waitFor()
 await page.goto(`${base}/#/code?project=board-fixture`)
 const tree = page.getByRole('tree', { name: 'Project files', exact: true }); await tree.waitFor()
 const root = tree.getByRole('treeitem', { name: /^src/ }).first(); await root.waitFor()
 assert.ok(await tree.getByRole('treeitem').count() <= 42, '1,001 visible logical nodes use bounded rendered rows')
 await root.focus(); await page.keyboard.press('End')
 await tree.getByRole('treeitem', { name: /file-0999.ts/ }).waitFor()
 assert.ok(await tree.getByRole('treeitem').count() <= 42)
 await page.keyboard.press('Home'); await page.keyboard.press('ArrowLeft')
 assert.equal(await tree.getByRole('treeitem').count(), 1)
 await page.waitForTimeout(300); await page.reload(); await tree.waitFor()
 assert.equal(await tree.getByRole('treeitem').count(), 1, 'Closed folder state survives reload')
 await tree.getByRole('treeitem').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter')
 await page.screenshot({ path: '.cache/boardui-review-results/tree.png' })
 assert.deepEqual(errors, [])
 console.log('PASS: real route/mock-service Marketplace filters cancel/apply/select and tool accordion; 1,000-file tree bounded DOM, keyboard End/Home/expand/open and expansion persistence; no page errors')
} finally { await browser.close() }
