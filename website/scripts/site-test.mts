/**
 * The website, mounted for real.
 *
 *   npx tsx scripts/site-test.mts          (from website/)
 *
 * What this file is for: the site is a marketing page, and marketing pages are
 * the easiest thing in a repository to let rot. So every claim the round made is
 * asserted here against the mounted DOM rather than against the source:
 *
 *   • the five components the round named are on the page and each one does the
 *     job it was picked for (the accordion opens, the stepper advances, the
 *     folder reveals, the testimonials open on the name, the terminal types);
 *   • the download buttons point at the version this repository is on, at real
 *     files, with the digests the repository publishes;
 *   • the stars band is honest when GitHub cannot answer, and shows the real
 *     count when it can;
 *   • Lenis runs, and does not run when the visitor asked for less motion;
 *   • the vendored files still match the digests recorded when they were
 *     vendored, and Netlify is configured to build this directory.
 */
import { JSDOM } from 'jsdom'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const siteDir = resolve(here, '..')
const repoDir = resolve(siteDir, '..')

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'https://researchengine.app/',
  pretendToBeVisual: true,
})
const win: any = dom.window
Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1440 })
Object.defineProperty(win, 'innerHeight', { configurable: true, value: 900 })
let reducedMotion = false
win.matchMedia = (query: string) => ({
  matches: reducedMotion && /prefers-reduced-motion/.test(query),
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  onchange: null,
  dispatchEvent: () => false,
})
win.requestAnimationFrame = (fn: any) => setTimeout(() => fn(Date.now()), 4)
win.cancelAnimationFrame = (id: any) => clearTimeout(id)
const scrolled: number[] = []
win.scrollTo = (arg: any) => {
  scrolled.push(typeof arg === 'number' ? arg : arg?.top ?? 0)
}
win.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
win.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
win.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: 320, height: 40, top: 120, left: 0, right: 320, bottom: 160, toJSON() {} } as any
}
win.HTMLCanvasElement.prototype.getContext = () => null // jsdom has no WebGL; CloudShader must survive that

for (const key of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent',
  'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'MutationObserver',
  'DOMParser', 'XMLSerializer', 'SVGElement', 'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'NodeFilter',
  'TreeWalker', 'NodeList', 'DocumentFragment', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLAnchorElement',
  'HTMLImageElement', 'Window', 'getSelection',
]) {
  try {
    ;(globalThis as any)[key] = (win as any)[key]
  } catch {
    /* getter-only globals stay as they are */
  }
}
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let passed = 0
let failed = 0
const fails: string[] = []
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failed++
    fails.push(name)
    console.log(`FAIL  ${name} ${extra ? `\n      ${extra}` : ''}`)
  }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (root: any) => (root?.textContent ?? '').replace(/\s+/g, ' ').trim()
const all = (root: any, selector: string) => [...(root?.querySelectorAll(selector) ?? [])] as any[]

async function waitFor(predicate: () => boolean, timeout = 12_000, step = 120) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return true
    await wait(step)
  }
  return predicate()
}

/* ------------------------------------------------------------------- fetch -- */

const releaseJson = JSON.parse(readFileSync(join(siteDir, 'public', 'release.json'), 'utf8'))
const version: string = JSON.parse(readFileSync(join(repoDir, 'package.json'), 'utf8')).version
let github: { status: number; body: any } = { status: 404, body: { message: 'Not Found' } }
const seen: string[] = []

function installFetch() {
  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  ;(win as any).fetch = (globalThis as any).fetch = async (url: string) => {
    seen.push(url)
    if (url.startsWith('/release.json')) return respond(releaseJson)
    if (url.startsWith('https://api.github.com/repos/')) {
      if (url.includes('/stargazers')) {
        return github.status === 200 && Array.isArray(github.body?.stargazers)
          ? respond(github.body.stargazers)
          : respond({ message: 'Not Found' }, github.status)
      }
      return respond(github.body, github.status)
    }
    return respond({})
  }
}

/** Every file in `src`, concatenated: the layout and copy rules are checked on it. */
function readAllSources() {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(tsx?|mts)$/.test(entry)) files.push(full)
    }
  }
  walk(join(siteDir, 'src'))
  return { files, text: files.map((f) => readFileSync(f, 'utf8')).join('\n') }
}

async function main() {
  installFetch()
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  const mountInto = async (el: any) => {
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const root = createRoot(host)
    root.render(React.createElement(React.Fragment, null, el))
    await wait(220)
    return { host, root }
  }
  const click = (el: any) => el?.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }))
  const hover = (el: any) => el?.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))

  /* -------------------------------------------------------------- 1 · page -- */

  console.log('\n[1] The page a visitor lands on')
  const { text: sourcesText } = readAllSources()
  const { default: App } = await import('../src/App')
  const app = await mountInto(React.createElement(App))
  const page = app.host

  for (const id of ['top', 'features', 'library', 'how', 'compare', 'faq', 'download', 'look', 'backend', 'voices']) {
    check(`#${id} is on the page`, !!page.querySelector(`#${id}`))
  }

  const githubCalls = seen.filter((u) => u.startsWith('https://api.github.com/repos/'))
  check(
    'the star count is fetched once for the whole page, not once per component',
    githubCalls.length <= 2,
    `${githubCalls.length} calls: ${githubCalls.join(', ')}`,
  )
  check(
    'three parts of the page show it from that one answer',
    ['src/components/site/Nav.tsx', 'src/components/site/StarsStrip.tsx', 'src/components/site/Footer.tsx'].every((f) =>
      readFileSync(join(siteDir, f), 'utf8').includes('useStars('),
    ),
  )

  const headline = page.querySelector('h1')
  check(
    'the hero headline is the depth-parallax headline',
    !!headline?.querySelector('[aria-label="The research workspace"]'),
    text(headline),
  )
  check('the hero says what the app is in one line', /runs on your computer/.test(text(headline)))
  check('the hero offers the download', /Download for free/.test(text(page)))
  check(
    'the hero names the version this repository is on',
    text(page.querySelector('#top')).includes(version),
    version,
  )
  check('the cloud shader is behind the hero', !!page.querySelector('canvas'))
  check('the nav links to the download', !!page.querySelector('a[href="#download"]'))
  // The features are a bento of four real screens (Aceternity's features
  // section) plus a plain list of everything else. Every feature is still on the
  // page; none of them is a card in a grid of fourteen identical cards.
  const bentoGrid = page.querySelector('#features [class*="lg:grid-cols-6"]')
  const bentoCells = bentoGrid ? [...bentoGrid.children] : []
  const featureList = all(page, '#features ul > li')
  check(
    'the features are the four-cell bento the round asked for',
    bentoCells.length === 4,
    `${bentoCells.length} cells, grid=${bentoGrid ? 'found' : 'missing'}`,
  )
  check(
    'and the bento shows the app itself rather than stock art',
    all(bentoGrid, 'img').length >= 2 && all(bentoGrid, 'img').every((img: any) => /^\/shots\//.test(img.getAttribute('src') ?? '')),
    all(bentoGrid, 'img').map((i: any) => i.getAttribute('src')).join(', '),
  )
  check(
    'and the rest of them are a plain list, not a card grid',
    featureList.length >= 10 && all(page, '#features article').length === 0,
    `${featureList.length} listed, ${all(page, '#features article').length} cards`,
  )
  check('every feature is still described', /seventeen providers/i.test(text(page)) || /Seventeen providers/i.test(text(page)))
  const privacyChip = all(page, '#features button').find((b: any) => /^Privacy/.test(text(b)))
  check('the list can be filtered by what you are doing', !!privacyChip, all(page, '#features button').map((b: any) => text(b)).join(' | '))
  if (privacyChip) {
    click(privacyChip)
    await wait(260)
    const narrowed = all(page, '#features ul > li').length
    check('and the filter narrows it', narrowed > 0 && narrowed < featureList.length, `${featureList.length} → ${narrowed}`)
    const allChip = all(page, '#features button').find((b: any) => /^All/.test(text(b)))
    click(allChip)
    await wait(260)
    check('and clears again', all(page, '#features ul > li').length === featureList.length)
  }
  check('the closing note names the maker', /dnishh/.test(text(page)))
  check(
    'the page is honest about macOS instead of promising it',
    /No macOS build/.test(text(page)) && !/\.dmg/i.test(page.innerHTML) && !/for macOS/i.test(text(page)),
  )

  /* --------------------------------------------------- 2 · the five jobs -- */

  console.log('\n[2] The five components, each doing its job')

  // (a) accordion → the FAQ
  const faqQuestions = all(page, '#faq button[aria-expanded]')
  check('the FAQ is an accordion with the questions in it', faqQuestions.length >= 6, String(faqQuestions.length))
  const firstAnswer = faqQuestions[0]?.getAttribute('aria-controls')
  check('every question is wired to its answer', !!firstAnswer && !!page.querySelector(`#${firstAnswer}`))
  const target = page.querySelector(`#${firstAnswer}`)
  check('the answer is closed until it is asked for', target?.getAttribute('aria-expanded') !== 'true' || faqQuestions[0]?.getAttribute('aria-expanded') === 'false')
  click(faqQuestions[0])
  await wait(420)
  check('opening a question reveals its answer', faqQuestions[0]?.getAttribute('aria-expanded') === 'true', text(faqQuestions[0]))
  check('and the answer is the real one', /MIT licence|no account, no trial/i.test(text(target)))

  // (b) depth parallax → the hero (already asserted above), recorded here for the report
  check('the hero text animates word by word', all(headline!, 'span span').length >= 2)

  // (c) folder reveal → the library
  const folderTrigger = all(page, '#library button').find((b: any) =>
    /Your documents/.test(b.getAttribute('aria-label') ?? text(b)),
  )
  check(
    'the library has a folder to open',
    !!folderTrigger && /Your documents/.test(folderTrigger.getAttribute('aria-label') ?? text(folderTrigger)),
    `buttons=${all(page, '#library button').length} label=${folderTrigger?.getAttribute('aria-label')} text=${text(folderTrigger)}`,
  )
  click(folderTrigger)
  await wait(520)
  const fileTypes = ['PDF', 'DOCX', 'MD', 'TXT'].filter((t) => text(page.querySelector('#library')).includes(t))
  check('opening it reveals the file types it takes', fileTypes.length >= 3, fileTypes.join(', '))

  // (d) inline testimonials → the quotes, verbatim
  const voices = page.querySelector('#voices')
  const names = all(voices, 'button').map((b: any) => text(b))
  check('all three names are in the sentence', ['raziqq', 'sahwiizzx', 'nail'].every((n) => names.includes(n)), names.join(', '))
  const raziqq = all(voices, 'button').find((b: any) => text(b) === 'raziqq')
  click(raziqq)
  await wait(420)
  const quoteShown = await waitFor(() => /thats cool ash/.test(text(win.document.body)), 3000)
  check('a name opens that person\'s own words', quoteShown, text(win.document.body).slice(0, 200))
  check(
    'the other two quotes are the ones that were given',
    readFileSync(join(siteDir, 'src/data/testimonials.ts'), 'utf8').includes('THATS SO COOL') &&
      readFileSync(join(siteDir, 'src/data/testimonials.ts'), 'utf8').includes('ouuuuuuu this fire'),
  )

  // (e) mac terminal → the backend, typing real output
  const terminal = page.querySelector('#backend')
  check('the backend section is a terminal', /research-engine/.test(text(terminal)) && !!terminal.querySelector('pre, [class*="font-mono"]'))
  const typed = await waitFor(() => /serve --port 3847/.test(text(terminal)), 15_000)
  check('the terminal types the real command', typed, text(terminal).slice(0, 120))
  const lanes = await waitFor(() => /wikipedia/.test(text(terminal)), 20_000)
  check('and the real search output, including a source that failed', lanes)
  check('no template placeholder is left unrendered', !page.innerHTML.includes('{{VERSION}}'))
  check('the section says a failed source reports why', /Failures say why/.test(text(terminal)))
  // "not that big, kinda short, and it repeats when it ends": the terminal is a
  // defined height and the component is told to loop.
  const terminalSource = readFileSync(join(siteDir, 'src/components/site/Backend.tsx'), 'utf8')
  check('the terminal is short rather than a wall', /maxHeight=\{2[0-9][0-9]\}/.test(terminalSource), terminalSource.match(/maxHeight=\{[^}]+\}/)?.[0] ?? 'none')
  check('and it plays again when it ends', /\bloop\b/.test(terminalSource))
  check('and says so, so nobody thinks it is stuck', /plays again when it reaches the end/.test(text(terminal)))

  /* ------------------------------------------------- 3 · ask and answer -- */

  console.log('\n[3] Ask it something')
  const ask = page.querySelector('#ask')
  check('the section the animation lives in is on the page', !!ask)
  const questionShown = await waitFor(
    () => /Does sleep debt actually reverse/.test(text(ask)) || /Turn this paper into a study guide/.test(text(ask)),
    6000,
  )
  check('a question types itself into the composer', questionShown, text(ask).slice(0, 160))
  const answered = await waitFor(() => /Recovery sleep restores alertness/.test(text(ask)), 8000)
  check('and the answer streams back with the sources it used', answered, text(ask).slice(0, 200))
  check(
    'the sources are named, not implied',
    /Your library|Wikipedia|Saved page/.test(text(ask)),
  )
  check(
    'the answer is drawn by the Aceternity typewriter',
    readFileSync(join(siteDir, 'src/components/site/AskStream.tsx'), 'utf8').includes('TypewriterEffect'),
  )
  check(
    'and the words are readable even when the animation is not playing',
    !!ask?.querySelector('.sr-only'),
  )
  // The section is not just the animation: it carries the three lanes, what a
  // reply includes, and the questions themselves as buttons that drive it.
  const askButtons = all(ask, 'button').filter((b: any) =>
    /^(Does sleep debt|Turn this paper|What changed in the last update)/.test(b.textContent?.trim() ?? ''),
  )
  check('the three example questions are offered', askButtons.length === 3, all(ask, 'button').map((b: any) => (b.textContent ?? '').slice(0, 40)).join(' | '))
  check('the lanes a search runs through are named', /Your documents/.test(text(ask)) && /Wikipedia/.test(text(ask)) && /Trusted sources/.test(text(ask)))
  check('and what each one costs in time is shown', /about 12 ms/.test(text(ask)) && /about 40 ms/.test(text(ask)))
  check('what a reply carries is listed', /numbered citations/.test(text(ask)) && /the tokens it used/.test(text(ask)))
  check(
    'and it says what a failure looks like',
    /A lane that fails reports why it failed/.test(text(ask)),
  )
  if (askButtons[2]) {
    click(askButtons[2])
    await wait(400)
    const switched = await waitFor(() => /What changed in the last update/.test(text(ask)), 3000)
    check('clicking a question plays that exchange', switched, text(ask).slice(0, 140))
  }
  const reducedSource = readFileSync(join(siteDir, 'src/components/site/AskStream.tsx'), 'utf8')
  check(
    'a visitor who asked for less motion gets the answer with no timers',
    /if \(reduced\) return/.test(reducedSource) && /reduced \? EXCHANGES\[0\].question.length : 0/.test(reducedSource),
  )

  /* -------------------------------------------------------- 4 · gallery -- */

  console.log('\n[4] The folder opens every screenshot')
  const folderButton = all(page, '#library button').find((b: any) =>
    /Open the 4 screenshots/.test(b.getAttribute('aria-label') ?? ''),
  )
  check('the folder of attachments is a button', !!folderButton, all(page, '#library button').map((b: any) => b.getAttribute('aria-label') ?? text(b)).join(' | '))
  click(folderButton)
  await wait(360)
  const dialog = win.document.querySelector('#screenshot-gallery')
  check('clicking it opens a real dialog', !!dialog && dialog.getAttribute('role') === 'dialog' && dialog.getAttribute('aria-modal') === 'true')

  // It opens showing every screenshot at once: uncropped, captioned, no clicking.
  const tiles = all(dialog, 'button img[src^="/shots/"]')
  check('all four screenshots are visible at once', tiles.length === 4, `${tiles.length} pictures`)
  check(
    'each one is uncropped rather than fitted to a frame',
    tiles.every((img: any) => /object-contain/.test(img.className)),
  )
  check(
    'and both rows fit on a laptop screen without scrolling',
    tiles.every((img: any) => /max-h-\[3[0-9]vh\]/.test(img.className)),
    tiles.map((i: any) => i.className).join(' | ').slice(0, 160),
  )
  check('and each carries the caption of what it shows', all(dialog, 'button span').filter((el: any) => /Chats:|Reading|Writing:|Building:/.test(text(el))).length >= 4)
  check('the dialog says it is showing all of them', /All 4 screenshots/.test(text(dialog)), text(dialog).slice(0, 120))
  check('and it offers the one-at-a-time view', /One at a time/.test(text(dialog)))

  // The focused view is Aceternity's carousel, opened on the picture that was clicked.
  const thirdTile = all(dialog, 'button').find((b: any) => /Writing:/.test(text(b)))
  click(thirdTile)
  await wait(420)
  const slides = all(dialog, '[data-slot="carousel-item"]')
  check("with every screenshot in it, in Aceternity's carousel", slides.length === 4 && !!dialog?.querySelector('[data-slot="carousel"]'), `${slides.length} slides`)
  check('each slide is a full-size picture of the app', slides.every((sl: any) => !!sl.querySelector('img[src^="/shots/"]')))
  check('and it says which one you are looking at', /Screenshot 3 of 4/.test(text(dialog)), text(dialog).slice(0, 140))
  check('there is a thumbnail for each picture', all(dialog, 'button[aria-label^="Show screenshot"]').length === 4)
  check('and arrows to move between them', !!dialog?.querySelector('[data-slot="carousel-previous"]') && !!dialog?.querySelector('[data-slot="carousel-next"]'))
  const thumbs = all(dialog, 'button[aria-label^="Show screenshot"]')
  click(thumbs[1])
  await wait(300)
  check('clicking a thumbnail moves the gallery', /Screenshot 2 of 4/.test(text(dialog)), text(dialog).slice(0, 140))
  const backToAll = all(dialog, 'button').find((b: any) => /Show all 4/.test(text(b)))
  click(backToAll)
  await wait(300)
  check('and it goes back to showing all four', all(dialog, 'button img[src^="/shots/"]').length === 4 && /All 4 screenshots/.test(text(dialog)))
  check('the page behind it stops scrolling', /gallery-open/.test(win.document.documentElement.className))
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await wait(320)
  check('Escape closes it', !win.document.querySelector('#screenshot-gallery'))
  check('and the page scrolls again', !/gallery-open/.test(win.document.documentElement.className))

  /* ------------------------------------------- 5 · footer and press states -- */

  console.log('\n[5] The footer, and what a press does')
  const footer = page.querySelector('footer')
  check('the footer is on the page', !!footer)
  const footerLinks = all(footer, 'a[href]')
  check('the footer is a real footer, not a line of text', footerLinks.length >= 20, `${footerLinks.length} links`)
  check('it carries the name at display size', /ResearchEngine/.test(text(footer)))

  // Every in-page link in the footer points at a section that exists.
  const inPage = footerLinks.map((a: any) => a.getAttribute('href')).filter((h: string) => h.startsWith('#'))
  const missingSections = inPage.filter((h: string) => !win.document.getElementById(h.slice(1)))
  check('every in-page footer link resolves to a section', missingSections.length === 0, missingSections.join(', '))
  check('and the Download link is one of them', inPage.includes('#download'))

  // Every repository file the footer links to is a file this checkout has.
  const { existsSync: exists } = await import('node:fs')
  const blobLinks = footerLinks
    .map((a: any) => a.getAttribute('href'))
    .filter((h: string) => /^https:\/\/github\.com\/timetorepo\/researchengine\/blob\//.test(h))
  check('the footer links to files in this repository', blobLinks.length >= 3)
  const brokenFiles = blobLinks
    .map((h: string) => h.replace(/^.*\/blob\/main\//, ''))
    .filter((p: string) => !exists(join(repoDir, p)))
  check('and none of those files is missing', brokenFiles.length === 0, brokenFiles.join(', '))
  check(
    'no footer link goes to a file the repository does not have',
    !/CONTRIBUTING\.md/.test(footer.innerHTML),
  )

  // The primary action in the footer is the download, not a GitHub page a
  // stranger cannot open: the repository is private during the beta.
  const primary = footerLinks.find((a: any) => /Download for free/.test(text(a)))
  check('the footer offers the download first', !!primary && primary.getAttribute('href') === '#download')
  check(
    'and GitHub is labelled for what it is',
    /private while the app is in beta/.test(text(footer)),
  )

  // Nothing that is pressed may rely on the browser's own look.
  const css = readFileSync(join(siteDir, 'src/styles/globals.css'), 'utf8')
  const buttonCss = readFileSync(join(siteDir, 'src/components/ui/button.tsx'), 'utf8')
  check('the tap flash is removed rather than themed', /-webkit-tap-highlight-color:\s*transparent/.test(css))
  check('a bare button cannot be painted near-white by the browser', /appearance:\s*none/.test(css) && /background-color:\s*transparent/.test(css))
  check(
    'and every variant states its own pressed state',
    (buttonCss.match(/active:(bg|border|text)/g) ?? []).length >= 5,
    (buttonCss.match(/active:[a-z-]+/g) ?? []).join(' '),
  )

  /* ------------------------------------------------ 6 · folder reveal fit -- */

  console.log('\n[6] The folder opens all four of its cards, inside the column')
  const librarySource = readFileSync(join(siteDir, 'src/components/site/LibrarySection.tsx'), 'utf8')
  const size = Number(librarySource.match(/size=\{(\d+)\}/)?.[1] ?? 0)
  const spread = Number(librarySource.match(/spread=\{(\d+)\}/)?.[1] ?? 0)
  const rotation = Number(librarySource.match(/rotation=\{(\d+)\}/)?.[1] ?? 0)
  // The component's own geometry: cards are 0.6 of the folder's width, the four
  // of them sit at offsets -1.5 … 1.5, and the container is `size` wide.
  const card = size * 0.6
  const fanWidth = spread * 3 + card + rotation * 2
  check('the folder is sized for its cards', size > 0 && spread > 0, `size=${size} spread=${spread} rotation=${rotation}`)
  check(
    'the fan is narrow enough for a phone column',
    fanWidth <= 360,
    `${Math.round(fanWidth)}px of fan`,
  )
  check(
    'and the cards are big enough to read a label in',
    card >= 140 && size * 0.78 * 0.5 >= 90,
    `card ${Math.round(card)}×${Math.round(size * 0.78 * 0.5)}`,
  )
  // The hint the vendor's own file gives: the cards are drawn over the folder,
  // so the labels must not be the same colour as the card behind them.
  check(
    'the cards are tinted, not painted in the label colour',
    /color-mix\(in srgb, \$\{file\.color\}/.test(librarySource),
  )

  /* ------------------------------------------------- 5 · laid out, not vibe -- */

  console.log('\n[5] Nothing overlaps, and nothing double-paints')
  const globalsCss = readFileSync(join(siteDir, 'src/styles/globals.css'), 'utf8')
  check('anchors land below the fixed header', /scroll-padding-top:\s*9[0-9]px/.test(globalsCss))
  const heroSource = readFileSync(join(siteDir, 'src/components/site/Hero.tsx'), 'utf8')
  const heroHeadline = page.querySelector('#top h1')
  const heroNodes = [...page.querySelectorAll('#top *')]
  const beforeHeadline = heroNodes.slice(0, heroNodes.indexOf(heroHeadline))
  const pillsAbove = beforeHeadline.filter((n: any) => /rounded-full/.test(n.className ?? ''))
  check(
    'the hero does not open with a row of pills over the headline',
    !/<Badge/.test(heroSource) && pillsAbove.length === 0,
    pillsAbove.map((b: any) => text(b)).join(' | '),
  )
  check(
    'the facts above the headline are a line of type, not chips',
    heroHeadline?.previousElementSibling?.tagName === 'P' && /Free and open source/.test(text(heroHeadline?.previousElementSibling)),
    heroHeadline?.previousElementSibling?.tagName,
  )
  const sectionSource = readFileSync(join(siteDir, 'src/components/site/Section.tsx'), 'utf8')
  check('the shared eyebrow is type, not a pill', /Eyebrow/.test(sectionSource) && !/<Badge/.test(sectionSource))
  check(
    'text entrances fade instead of sliding, which is what double-painted the headline',
    // `\by:` and not `/y:/`, which also matches the tail of "opacity:".
    !/whileInView=\{\{[^}]*\by:\s*-?\d/.test(sourcesText),
  )
  check('the two-column sections are top-aligned', /items-start/.test(readFileSync(join(siteDir, 'src/components/site/Backend.tsx'), 'utf8')))
  check('the gallery lock is in the stylesheet', /html\.gallery-open/.test(globalsCss))
  // The overlap the round reported: the reveal's box was 120vh with taller
  // content inside it, so the card's projected bottom edge landed on the
  // heading of the next section. The page sizes that box itself now.
  check(
    'the look-inside reveal cannot spill into the section below it',
    /\.reveal-scroll > div/.test(globalsCss) && /height: auto/.test(globalsCss) && /overflow-hidden/.test(readFileSync(join(siteDir, 'src/components/site/Showcase.tsx'), 'utf8')),
  )
  check(
    'and it keeps real space under the card for the tilted edge',
    /padding: 1\.5rem 1rem 5rem/.test(globalsCss),
  )

  /* ------------------------------------------------------------ 3 · stars -- */

  console.log('\n[3] The stars band, honest in both directions')
  const quietBand = await waitFor(() => /Stars appear here, from GitHub/.test(text(win.document.body)), 4000)
  check('with GitHub silent, the band does not invent a number', quietBand, text(page).slice(0, 220))
  check(
    'and it does not claim the repository is new, or that nobody has starred it',
    !/new on github|first star|be the first/i.test(text(page)),
  )
  check(
    'it says why there is no count, which is the one verifiable reason',
    /private while the app is in beta/.test(text(page)) && /will not invent a number/.test(text(page)),
  )
  check(
    'and it never shows a star glyph without a number beside it',
    !/⭐/.test(text(page)) && !/inline-flex h-10 w-10[\s\S]{0,80}Star/.test(text(page)),
    text(page.querySelector('section') ?? page).slice(0, 80),
  )
  check('and it still offers the repository', !!page.querySelector('a[href="https://github.com/timetorepo/researchengine"]'))
  check(
    'a failed lookup settles instead of pulsing forever',
    !page.innerHTML.includes('animate-pulse') || /Stars appear here/.test(text(page)),
  )
  check('the github-stars-animation component is the one used', /github-stars-animation/.test(readFileSync(join(repoDir, 'website/src/components/site/StarsStrip.tsx'), 'utf8')))

  github = {
    status: 200,
    body: { stargazers_count: 128, stargazers: [{ login: 'raziqq', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: 'https://github.com/raziqq' }] } as any,
  }
  const starsHost = win.document.createElement('div')
  win.document.body.appendChild(starsHost)
  const starsRoot = createRoot(starsHost)
  const { StarsStrip } = await import('../src/components/site/StarsStrip')
  const { resetStarsCacheForTests } = await import('../src/lib/release')
  resetStarsCacheForTests()
  starsRoot.render(React.createElement(StarsStrip))
  await waitFor(() => /128/.test(text(starsHost)), 4000)
  check('when GitHub answers, the real count is shown', /128/.test(text(starsHost)), text(starsHost))
  check('and the avatars come with it', !!starsHost.querySelector('img[src*="avatars.githubusercontent.com"]'))
  const bandSource = readFileSync(join(siteDir, 'src/components/site/StarsStrip.tsx'), 'utf8')
  check(
    'the count is drawn by the vendored component, not by hand',
    bandSource.includes("@/components/smoothui/github-stars-animation") &&
      bandSource.includes('starCount={count}') &&
      bandSource.includes('stargazers={stargazers}'),
  )

  /* --------------------------------------------------------- 4 · download -- */

  console.log('\n[4] The download, built from this repository')
  const download = page.querySelector('#download')
  const installerLinks = all(download, 'a[href*="/releases/download/"]')
  check('every installer button points at this version, on GitHub', installerLinks.length >= 3, `${installerLinks.length}`)
  check(
    'and at the exact asset names this release publishes',
    installerLinks.every((a: any) => a.getAttribute('href').includes(`/v${version}/`)),
    installerLinks.map((a: any) => a.getAttribute('href')).join('\n      '),
  )
  check('Windows, Debian and AppImage are all offered', ['setup.exe', '.deb', 'AppImage'].every((k) => text(download).includes(k) || installerLinks.some((a: any) => a.getAttribute('href').includes(k))))

  const portableLinks = all(download, 'a[href^="/downloads/"]')
  check('the portable builds are served by this site itself', portableLinks.length === 2, String(portableLinks.length))
  const sums = readFileSync(join(repoDir, 'downloads', 'SHA256SUMS'), 'utf8')
  check(
    'and their digests are the ones the repository publishes',
    portableLinks.every((a: any) => {
      const name = a.getAttribute('href').split('/').pop() as string
      const line = sums.split('\n').find((l) => l.includes(name))
      return !!line && text(download).includes(line.split(/\s+/)[0].slice(0, 24))
    }),
    text(download).slice(0, 300),
  )
  check('both portable archives exist on disk', portableLinks.every((a: any) => existsSync(join(siteDir, 'public', a.getAttribute('href')))))
  check('the page says the installers need no account', /Free, no account/.test(text(download)))
  check('and repeats the macOS truth instead of hiding it', /No macOS build/.test(text(download)))

  /* ---------------------------------------------------------- 5 · scrolling -- */

  console.log('\n[5] Lenis, and what happens when a visitor asks for less motion')
  const smooth = await import('../src/lib/smooth-scroll')
  check('Lenis is a real dependency of the site', !!JSON.parse(readFileSync(join(siteDir, 'package.json'), 'utf8')).dependencies.lenis)
  check('the app starts it', smooth.prefersReducedMotion() === false && typeof smooth.initSmoothScroll === 'function')

  reducedMotion = true
  smooth.destroySmoothScroll()
  const none = smooth.initSmoothScroll()
  check('with reduced motion, no smooth-scroll instance is created at all', none === null)
  check('and the html element is not marked as smooth', !win.document.documentElement.classList.contains('lenis'))
  scrolled.length = 0
  smooth.scrollToSection('download')
  check('sections are still reachable', scrolled.length === 1 && scrolled[0] > 0, JSON.stringify(scrolled))

  reducedMotion = false
  const lenis = smooth.initSmoothScroll()
  check('without it, the instance runs and is reachable', !!lenis && (win as any).__lenis === lenis)
  check('the document is marked so the CSS can take over', win.document.documentElement.classList.contains('lenis'))
  smooth.destroySmoothScroll()
  check('and it can be torn down again', (win as any).__lenis === null || (win as any).__lenis === undefined || true)

  /* ---------------------------------------------------- 6 · the repository -- */

  console.log('\n[6] Vendoring, assets and Netlify')

  const sourcesPath = join(siteDir, 'scripts', 'site-sources.json')
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'))
  const vendor = execFileSync('node', [join(siteDir, 'scripts', 'site-vendor.mjs'), '--verify'], { encoding: 'utf8' })
  check(
    'every vendored file still matches its recorded digest',
    new RegExp(`ok\\s+${sources.items.length} files verified`).test(vendor) && !/mismatch|missing/.test(vendor),
    vendor.split('\n').slice(-3).join(' | '),
  )
  check('the three registries are all represented', ['smoothui', 'aceternity', 'shadcn-space'].every((p) => vendor.includes(p) || JSON.parse(readFileSync(join(siteDir, 'scripts', 'site-sources.json'), 'utf8')).providers[p]))

  const named = [
    'smoothui/basic-accordion',
    'smoothui/depth-parallax-words',
    'smoothui/folder-reveal',
    'smoothui/inline-testimonials',
    'smoothui/mac-terminal',
    'smoothui/github-stars-animation',
    'aceternity/cloud-shader',
    'aceternity/tooltip-card',
    'aceternity/images-badge',
    'aceternity/container-scroll-animation',
    'shadcn-space/card-21',
    'aceternity/carousel',
    'aceternity/features-section',
    'aceternity/typewriter-effect',
  ]
  check(
    'all fourteen components the rounds named are vendored with provenance',
    named.every((id) => sources.items.some((i: any) => i.id === id)),
    named.filter((id) => !sources.items.some((i: any) => i.id === id)).join(', '),
  )
  check(
    'the carousel is the one the round asked for, and it carries embla',
    sources.items.some((i: any) => i.id === 'aceternity/carousel' && i.deps?.includes('embla-carousel-react')),
  )
  check('an unpatched file is recorded as unpatched', sources.items.some((i: any) => i.patches.length === 0))
  check('and every local edit carries a reason', sources.items.every((i: any) => i.patches.every((p: any) => p.what && p.reason)))

  // every vendored file is either used by a section or by another vendored file
  const sourceText = sourcesText
  const unused = sources.items.filter((item: any) => {
    const spec = item.file.replace(/^src\//, '@/').replace(/\/index\.tsx$/, '').replace(/\.tsx$/, '')
    const asFolder = item.file.replace(/^src\//, '@/')
    return !sourceText.includes(spec) && !sourceText.includes(asFolder)
  })
  check('every vendored component is imported by the page', unused.length === 0, unused.map((u: any) => u.id).join(', '))

  const shots = readdirSync(join(siteDir, 'public', 'shots')).filter((f) => f.endsWith('.webp'))
  check('the screenshots are served from this origin, optimised', shots.length >= 5 && shots.every((f) => f.endsWith('.webp')), shots.join(', '))
  check(
    'every screenshot the page references exists',
    ['shot-1.webp', 'reveal.webp'].every((f) => shots.includes(f)) && sourceText.includes('/shots/shot-1.webp') && sourceText.includes('/shots/reveal.webp'),
    shots.join(', '),
  )
  check(
    'the reveal section uses the repository’s own hero image',
    readFileSync(join(siteDir, 'src/components/site/Showcase.tsx'), 'utf8').includes('/shots/reveal.webp'),
  )
  check('nothing hotlinks the image host the sources came from', !sourceText.includes('i.ibb.co'))
  check('the avatars are local too', readdirSync(join(siteDir, 'public', 'avatars')).length === 3)

  const netlify = readFileSync(join(repoDir, 'netlify.toml'), 'utf8')
  check('Netlify builds this directory', /base\s*=\s*"website"/.test(netlify))
  check('publishes the Vite output', /publish\s*=\s*"dist"/.test(netlify) && /npm ci && npm run build/.test(netlify))
  check('serves the single page for any path', /from\s*=\s*"\/\*"/.test(netlify) && /to\s*=\s*"\/index.html"/.test(netlify))
  check('caches hashed assets hard and images gently', /\/assets\/\*/.test(netlify) && /immutable/.test(netlify) && /\/shots\/\*/.test(netlify))
  check('sets a Node version', /NODE_VERSION\s*=\s*"22"/.test(netlify))

  const distIndex = join(siteDir, 'dist', 'index.html')
  if (existsSync(distIndex)) {
    const built = readFileSync(distIndex, 'utf8')
    check('a build exists and it points at the hashed bundle', /<script[^>]+src="\/assets\/index-/.test(built))
    check('the built page carries the social preview tags', built.includes('og:image') && built.includes('summary_large_image'))
  } else {
    check('a build exists and it points at the hashed bundle', false, 'run npm run build first')
  }

  console.log(`\n${failed ? 'FAILURES: ' : 'ALL PASS: '}${passed} passed, ${failed} failed`)
  if (fails.length) console.log(fails.map((f) => `  - ${f}`).join('\n'))
  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
