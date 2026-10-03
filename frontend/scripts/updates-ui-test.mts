/**
 * The update popup and the chats tab strip, mounted for real.
 *
 * tsc proves the HeroUI props exist; it cannot prove the components *render*.
 * These are the two pieces of R14 built on packages this app did not use before
 * (HeroUI's Modal and Tabs), and both sit in the first thing a user sees — so
 * they go through jsdom here: the popup is opened with a stubbed update check
 * and asserted to show the version, the notes and a download button; the chats
 * page is rendered with two conversations and asserted to put All / Research /
 * Coding into HeroUI's real `tablist`.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/updates-ui-test.mts   (from frontend/)
 */
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/chats',
  pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1500 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 950 })
const storage = new Map<string, string>()
Object.defineProperty(win, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size },
  },
})
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 0)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
win.scrollTo = () => {}
win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
win.HTMLElement.prototype.scrollIntoView = function () {}
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent',
  'MouseEvent', 'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage',
  'MutationObserver', 'DOMParser', 'SVGElement', 'ResizeObserver', 'matchMedia',
  // react-aria's focus trap walks the document with a TreeWalker (NodeFilter
  // lives on the jsdom window, not on this process's globals).
  'NodeFilter', 'TreeWalker', 'NodeList', 'HTMLInputElement', 'HTMLButtonElement']) {
  try { ;(globalThis as any)[k] = (win as any)[k] } catch { /* getter-only in this Node build */ }
}
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const notes = "### What's new\n\n- the updater downloads again\n- notes are shown inline\n"
const checkPayload = {
  current: '0.31.1-beta.1',
  latest: '0.32.0',
  available: true,
  notes,
  url: 'https://github.com/timetorepo/researchengine/releases/tag/v0.32.0',
  publishedAt: '2026-09-20T10:00:00Z',
  asset: { name: 'research-engine-0.32.0-linux-x64.tar.gz', urls: ['https://example.test/a.tgz'], size: 2_400_000 },
  hashUrls: [],
  kind: 'portable' as const,
  canSelfUpdate: true,
}

const statusPayload = {
  kind: 'portable' as const,
  appRoot: '/opt/research-engine',
  dataDir: '/home/user/.research-engine',
  current: '0.31.1-beta.1',
  platform: 'linux-x64',
  canSelfUpdate: true,
  pending: null,
  backupVersions: [],
  outcome: null,
  progress: { phase: 'idle', pct: 0, received: 0, total: 0, message: '' },
}

let installCalls = 0
const realFetch = globalThis.fetch
;(globalThis as any).fetch = async (url: any, init?: any) => {
  const u = String(url)
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })
  if (u.includes('/api/update/status')) return json(statusPayload)
  if (u.includes('/api/update/check')) return json(checkPayload)
  if (u.includes('/api/update/install')) {
    installCalls++
    return json({ ok: true, restartRequired: true, pending: { from: '0.31.1-beta.1', to: '0.32.0' } })
  }
  if (u.includes('/api/health')) return json({ ok: true, web: { served: { version: '0.31.1-beta.1', buildId: 'x', builtAt: '' }, source: '0.31.1-beta.1', mode: 'portable' } })
  if (typeof url === 'string' && url.startsWith('/')) return json({})
  return realFetch(url, init)
}

async function main() {
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { useUI } = await import('../src/stores/useUI')
  const { useStore } = await import('../src/stores/useStore')

  console.log('\n[1] the new-release popup (HeroUI Modal)')
  const { UpdateModal } = await import('../src/components/updates/UpdateModal')
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host)
  root.render(React.createElement(UpdateModal as any))
  await wait(400)
  check('closed by default — no modal in the DOM', !win.document.querySelector('[data-update-modal]'))

  useUI.setState({ updatePopup: '0.32.0' })
  await wait(1200)
  const modal = win.document.querySelector('[data-update-modal]')
  check('opens when the store asks for it', !!modal)
  const text = win.document.body.textContent ?? ''
  check('names the version that is out', /Research Engine 0\.32\.0 is available/.test(text), text.slice(0, 120))
  check('says which version is running', /You are running/.test(text) && /0\.31\.1-beta\.1/.test(text))
  check('renders the release notes inline instead of a link', /the updater downloads again/.test(text))
  check('offers the download', /Download & install/.test(text))
  check('skips this version without installing', /Skip this version/.test(text))

  // The notes go through the chat markdown renderer, lazily.
  await wait(600)
  check('notes become real markup (headings + list)', !!win.document.querySelector('[data-release-notes] h3, [data-release-notes] li'))

  const download = [...win.document.querySelectorAll('button')].find((b) => /Download & install/.test(b.textContent ?? '')) as any
  check('the download button is a real button', !!download)
  if (download) {
    download.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(600)
    check('pressing it asks the server to install', installCalls === 1, `calls=${installCalls}`)
    check('and then says a restart is what is left', /Restart now/.test(win.document.body.textContent ?? ''))
  }

  const skipBtn = [...win.document.querySelectorAll('button')].find((b) => /Skip this version/.test(b.textContent ?? '')) as any
  if (skipBtn) {
    skipBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    await wait(400)
    check('skipping records the version so it is not announced again',
      useStore.getState().settings.updates?.dismissed === '0.32.0')
    check('and closes the popup', useUI.getState().updatePopup === null)
  }
  root.unmount()

  console.log('\n[2] the chats tab strip (HeroUI Tabs)')
  const now = Date.now()
  useStore.setState({
    chats: [
      { id: 'a', title: 'Quantum notes', kind: 'research', messages: [], createdAt: now, updatedAt: now },
      { id: 'b', title: 'Refactor parser', kind: 'coding', messages: [], createdAt: now - 1000, updatedAt: now - 1000 },
    ],
  } as any)
  const { ChatsView } = await import('../src/components/chats/ChatsView')
  const { MemoryRouter } = await import('react-router-dom')
  const host2 = win.document.createElement('div')
  win.document.body.appendChild(host2)
  const root2 = createRoot(host2)
  root2.render(React.createElement(MemoryRouter as any, null, React.createElement(ChatsView as any)))
  await wait(500)
  const tablist = host2.querySelector('[role="tablist"]')
  check('the tab row is a real tablist', !!tablist)
  const tabsInDom = [...host2.querySelectorAll('[role="tab"]')].map((t) => (t.textContent ?? '').replace(/\d+/g, '').trim())
  check('with All / Research / Coding in it', tabsInDom.join(',') === 'All,Research,Coding', tabsInDom.join(','))
  check('and the list marks one as selected',
    host2.querySelectorAll('[role="tab"][aria-selected="true"]').length === 1)
  const codingTab = [...host2.querySelectorAll('[role="tab"]')].find((t) => /Coding/.test(t.textContent ?? '')) as any
  codingTab?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await wait(400)
  check('picking Coding filters the list to coding chats',
    (host2.textContent ?? '').includes('Refactor parser') && !(host2.textContent ?? '').includes('Quantum notes'))
  root2.unmount()

  /* ==================== [R24] the changelog screen ==================== */

  console.log('\n[R24] Every version is in the record, and it is selectable')
  const { CHANGELOG, findRelease } = await import('../src/lib/updates/changelog')

  const shippedVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string
  const shippedBase = shippedVersion.replace(/-.*$/, '')
  check('the whole record is here, from the first pre-release to now', CHANGELOG.length >= 29, String(CHANGELOG.length))
  check('the newest entry is the version this build ships', CHANGELOG[0].version === shippedBase, `${CHANGELOG[0].version} vs ${shippedBase}`)
  check('the oldest is the first pre-release', CHANGELOG[CHANGELOG.length - 1].version === '0.10.0')
  check('every version carries a date, a summary and at least one section',
    CHANGELOG.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.summary.length > 20 && r.sections.length > 0))
  check('every version has real notes in it, not empty sections',
    CHANGELOG.every((r) => r.sections.every((sec) => sec.items.length > 0)) && CHANGELOG.reduce((n, r) => n + r.counts.items, 0) > 500)
  check('no version number appears twice', new Set(CHANGELOG.map((r) => r.version)).size === CHANGELOG.length)
  check('the versions are ordered newest first',
    CHANGELOG.every((r, i) => i === 0 || r.date <= CHANGELOG[i - 1].date))
  check('the running build can be found in the record', !!findRelease('0.37.0-beta.1') && findRelease('0.37.0-beta.1')!.version === '0.37.0')
  check('a version from another branch is not claimed', findRelease('9.9.9') === undefined)
  check('nothing in the record was left as structural markdown',
    !CHANGELOG.some((r) => /\*\*[^*]+\*\*|\]\(http|^#{1,4}\s/.test(r.summary)
      || r.sections.some((sec) => sec.items.some((i) => /\*\*[^*]+\*\*|\]\(http|^[-*]\s/.test(`${i.label ?? ''} ${i.text}`)))))

  const { ChangelogPanel } = await import('../src/components/settings/ChangelogPanel')
  const clHost = win.document.createElement('div')
  win.document.body.appendChild(clHost)
  const clRoot = (await import('react-dom/client')).createRoot(clHost)
  const React2 = await import('react')
  clRoot.render(React2.createElement(ChangelogPanel as any, { runningVersion: '0.37.0-beta.1' }))
  await new Promise((r) => setTimeout(r, 220))
  const clHtml = clHost.innerHTML
  check('the rail lists every version', (clHtml.match(/data-version="/g) ?? []).length === CHANGELOG.length)
  check('the running build is marked as such', clHtml.includes('running'))
  check('the selected version is rendered as a page, with its sections',
    clHtml.includes('data-ui="changelog"') && clHtml.includes('Everything that has shipped'))
  check('a version is selectable from the rail — the newest is selected first',
    clHtml.includes(`data-version="${CHANGELOG[0].version}"`) && clHtml.includes('What changed'))
  check('the version card says how many notes it has', /notes/.test(clHtml) && /sections/.test(clHtml))
  check('the previous release is one press away instead of a scroll',
    !!clHost.querySelector('button[title="Older (↓)"]') && !!clHost.querySelector('button[title="Newer (↑)"]'))

  const older = clHost.querySelector('button[title="Older (↓)"]') as any
  older?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 260))
  check('moving to an older version swaps the page', /data-version="0.36\.0"/.test(clHost.innerHTML))
  clRoot.unmount()

  console.log(`\n${failed ? 'FAILURES' : 'ALL PASS'}: ${passed} passed, ${failed} failed`)
  if (fails.length) console.log('failed: ' + fails.join(' | '))
  process.exit(failed ? 1 : 0)
}

void main()
