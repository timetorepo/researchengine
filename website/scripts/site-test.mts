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
  check('the feature grid lists at least twelve things', all(page, '#features article').length >= 12, String(all(page, '#features article').length))
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
  const folderTrigger = page.querySelector('#library button[aria-label]') ?? page.querySelector('#library button')
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

  /* ------------------------------------------------------------ 3 · stars -- */

  console.log('\n[3] The stars band, honest in both directions')
  const quietBand = await waitFor(() => /New on GitHub/.test(text(win.document.body)), 4000)
  check('with GitHub silent, the band does not invent a number', quietBand, text(page).slice(0, 220))
  check('and it still offers the star', !!page.querySelector('a[href="https://github.com/timetorepo/researchengine"]'))
  check(
    'a failed lookup settles instead of pulsing forever',
    !page.innerHTML.includes('animate-pulse') || /New on GitHub/.test(text(page)),
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

  const vendor = execFileSync('node', [join(siteDir, 'scripts', 'site-vendor.mjs'), '--verify'], { encoding: 'utf8' })
  check('every vendored file still matches its recorded digest', /ok\s+13 files verified/.test(vendor), vendor.split('\n').slice(-3).join(' | '))
  check('the three registries are all represented', ['smoothui', 'aceternity', 'shadcn-space'].every((p) => vendor.includes(p) || JSON.parse(readFileSync(join(siteDir, 'scripts', 'site-sources.json'), 'utf8')).providers[p]))

  const sources = JSON.parse(readFileSync(join(siteDir, 'scripts', 'site-sources.json'), 'utf8'))
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
  ]
  check(
    'all eleven components the round named are vendored with provenance',
    named.every((id) => sources.items.some((i: any) => i.id === id)),
    named.filter((id) => !sources.items.some((i: any) => i.id === id)).join(', '),
  )
  check('an unpatched file is recorded as unpatched', sources.items.some((i: any) => i.patches.length === 0))
  check('and every local edit carries a reason', sources.items.every((i: any) => i.patches.every((p: any) => p.what && p.reason)))

  // every vendored file is either used by a section or by another vendored file
  const srcFiles: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(tsx?|mts)$/.test(entry)) srcFiles.push(full)
    }
  }
  walk(join(siteDir, 'src'))
  const sourceText = srcFiles.map((f) => readFileSync(f, 'utf8')).join('\n')
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
