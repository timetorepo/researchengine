/**
 * R28 — eight asks, one suite.
 *
 *   • the Wikipedia reader resolves `?curid=` hits by their page id instead of
 *     their pathname, so "javascript wiki" can never come back as
 *     "Slash (punctuation)" again;
 *   • RSS and Atom feeds are typeset into readable blocks instead of shown as
 *     XML source;
 *   • file icons wear their language's own mark, vendored into the repo with a
 *     script that fetches the real brand set when a network exists;
 *   • design-mode components can be saved to the library, and the library grows
 *     one command that installs every saved component;
 *   • the coding workspace shows installed dependencies plus the ones AI coding
 *     usually reaches for;
 *   • MCP moved out of Settings into the coding workspace, with recommended
 *     servers, one-click installs and links to the registries;
 *   • screenshot-to-code accepts images and videos and hands the result to a
 *     vision model;
 *   • the README lost its dead image and gained the new features.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/r28-test.mts   (from frontend/)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { wikiRequestFor } from '../../backend/src/services/reader/extract'
import { feedToBlocks, looksLikeFeed } from '../../backend/src/services/reader/feed'
import { langLogo } from '../src/lib/ide/fileIcons'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const src = (p: string) => readFileSync(p, 'utf8')

console.log('\n— Wikipedia: the article the URL actually points at —')
{
  // The bug: search hits link ?curid=<pageid>; the pathname of such a URL is
  // "/", and asking Wikipedia for the article "/" answers "Slash (punctuation)".
  const hit = wikiRequestFor(new URL('https://en.wikipedia.org/?curid=9845'))
  check('curid hit resolves by page id', hit?.by === 'pageids' && hit.value === '9845')

  const pid = wikiRequestFor(new URL('https://en.wikipedia.org/?pageid=123'))
  check('pageid param resolves by page id', pid?.by === 'pageids' && pid.value === '123')

  const title = wikiRequestFor(new URL('https://en.wikipedia.org/wiki/JavaScript'))
  check('/wiki/ links resolve by title', title?.by === 'titles' && title.value === 'JavaScript')

  const enc = wikiRequestFor(new URL('https://en.wikipedia.org/wiki/C%2B%2B'))
  check('percent-encoded titles decode', enc?.by === 'titles' && enc.value === 'C++')

  check('bare host url resolves to nothing', wikiRequestFor(new URL('https://en.wikipedia.org/')) === null)
  check('non-wiki path resolves to nothing', wikiRequestFor(new URL('https://en.wikipedia.org/w/index.php?title=X')) === null)
  check('curid wins over any pathname', wikiRequestFor(new URL('https://en.wikipedia.org/wiki/Other?curid=7'))?.value === '7')
  check('garbage curid falls through to nothing', wikiRequestFor(new URL('https://en.wikipedia.org/?curid=abc')) === null)
}

console.log('\n— Feeds: typeset, not source —')
{
  check('detects rss by root element', looksLikeFeed('<?xml version="1.0"?><rss version="2.0"><channel/></rss>'))
  check('detects atom by root element', looksLikeFeed('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'))
  check('plain html is not a feed', !looksLikeFeed('<html><body><p>hi</p></body></html>'))
  check('content type decides too', looksLikeFeed('<whatever>', 'application/rss+xml; charset=utf-8'))

  const rss = `<?xml version="1.0"?><rss><channel>
    <title>Example Feed</title><description>News from the example.</description>
    <item><title>First post</title><link>https://example.com/1</link>
      <pubDate>Sat, 03 Oct 2026 12:00:00 GMT</pubDate>
      <description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;.&lt;/p&gt;</description></item>
    <item><title>Second post</title><link>https://example.com/2</link>
      <content:encoded>${'<p>body</p>'.repeat(400)}</content:encoded></item>
  </channel></rss>`
  const r = feedToBlocks(rss, new URL('https://example.com/feed.xml'))
  check('channel becomes the title', r.title === 'Example Feed')
  check('h1 block carries the channel', r.blocks[0].type === 'heading' && (r.blocks[0] as any).text === 'Example Feed')
  const headings = r.blocks.filter((b) => b.type === 'heading' && (b as any).level === 2)
  check('every item becomes a heading', headings.length === 2 && (headings[0] as any).text === 'First post')
  const quote = r.blocks.find((b) => b.type === 'quote')
  check('date and link ride along as meta', !!quote && /03 Oct 2026/.test((quote as any).text) && /example\.com\/1/.test((quote as any).text))
  const para = r.blocks.find((b) => b.type === 'paragraph' && /Hello/.test((b as any).text))
  check('descriptions lose their markup', !!para && (para as any).text === 'Hello world.')
  const long = r.blocks.find((b) => b.type === 'paragraph' && /body/.test((b as any).text))
  check('long bodies are digested, not reprinted', !!long && (long as any).text.length < 1000 && (long as any).text.endsWith('…'))
  check('outline tracks the headings', r.outline.length === 3)
  check('item count is honest', r.itemCount === 2)

  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Times</title><subtitle>Daily.</subtitle>
    <entry><title>One</title><link href="https://example.com/a"/><updated>2026-10-03T10:00:00Z</updated><summary>Summed up.</summary></entry>
  </feed>`
  const a = feedToBlocks(atom, new URL('https://example.com/atom'))
  check('atom titles resolve', a.title === 'Atom Times' && a.description === 'Daily.')
  const aQuote = a.blocks.find((b) => b.type === 'quote')
  check('atom link comes from the href attribute', !!aQuote && /example\.com\/a/.test((aQuote as any).text))
}

console.log('\n— File icons: language marks —')
{
  check('tsx wears react', langLogo('src/App.tsx') === 'react')
  check('js wears javascript', langLogo('main.mjs') === 'javascript')
  check('py wears python', langLogo('tools/run.py') === 'python')
  check('cpp wears c++', langLogo('a.cpp') === 'cplusplus')
  check('vue wears vue', langLogo('comp.vue') === 'vue')
  check('unknown extensions stay generic', langLogo('notes.txt') === null && langLogo('Dockerfile') === null)

  const dir = 'public/lang-logos'
  check('the logo shelf exists', existsSync(dir))
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg'))
  check('a shelf full of marks', files.length >= 20, `found ${files.length}`)
  const allSvg = files.every((f) => src(`${dir}/${f}`).trimStart().startsWith('<svg'))
  check('every file on the shelf is an svg', allSvg)

  // Every id the icon map promises must exist on the shelf.
  const want = ['javascript', 'typescript', 'react', 'python', 'cplusplus', 'vue', 'html', 'css', 'json', 'markdown', 'shell', 'sql', 'svg', 'yaml', 'image']
  const missing = want.filter((w) => !files.includes(`${w}.svg`))
  check('every mapped id has a file', missing.length === 0, missing.join(','))

  const vendor = src('scripts/vendor-lang-logos.mjs')
  check('the refresher fetches from simple-icons', vendor.includes('simple-icons') && vendor.includes('lang-logos'))
}

console.log('\n— Components: saved in the library, installed in one go —')
{
  const hub = src('src/components/design/ComponentHub.tsx')
  check('the hub has a save button', hub.includes('saveToLibrary') && hub.includes('Bookmark'))
  check('saves carry the install command', hub.includes('command') && hub.includes("'/api/library/items'"))
  check('saves are kind component', hub.includes("kind: 'component'"))

  const lib = src('src/components/library/LibrarySearch.tsx')
  check('the library lists install commands', lib.includes("it.kind === 'component'") && lib.includes('extra?.command'))
  check('copy-all joins every command', lib.includes("cmds.join(' && ')"))
  check('the button is testable', lib.includes('copy-component-installs'))
  check('component saves open the hub preview', lib.includes('app://component') && lib.includes('/code?hub='))
}

console.log('\n— Coding: dependencies, visible —')
{
  const route = src('../backend/src/routes/ide.ts')
  check('the deps route exists', route.includes("'/ide/deps'") && route.includes('devDependencies'))
  check('it reports installs and lockfiles', route.includes('node_modules') && route.includes('package-lock.json'))

  const panel = src('src/components/ide/DepsPanel.tsx')
  check('panel reads the route', panel.includes('/api/ide/deps'))
  check('curated ai-coding staples', ['openai', '@anthropic-ai/sdk', 'ollama', 'zod', 'ai'].every((d) => panel.includes(`'${d}'`)))
  check('each staple copies its install', panel.includes('npm install'))

  const view = src('src/components/ide/CodingView.tsx')
  check('deps is a rail activity', view.includes("activity === 'deps'") && view.includes('Dependencies'))
}

console.log('\n— MCP: out of settings, into the workspace —')
{
  const tab = src('src/components/settings/CodingTab.tsx')
  check('settings no longer configure mcp', !tab.includes('mcpServers') && !tab.includes('ServerRow'))
  check('settings say where it went', tab.includes('Coding workspace'))

  const mcp = src('src/components/ide/McpPanel.tsx')
  check('recommendations with one click', mcp.includes('RECOS') && mcp.includes('Install'))
  check('env keys collected inline', mcp.includes('envKey') && mcp.includes('GITHUB_PERSONAL_ACCESS_TOKEN'))
  check('installed servers stay manageable', mcp.includes('/api/mcp/tools') && mcp.includes('Trash2'))
  check('marketplace links out', ['smithery.ai', 'glama.ai/mcp/servers', 'mcp.so', 'modelcontextprotocol/servers'].every((u) => mcp.includes(u)))

  const view = src('src/components/ide/CodingView.tsx')
  check('mcp is a rail activity', view.includes("activity === 'mcp'") && view.includes('McpPanel'))
}

console.log('\n— Screenshot to code: images and video —')
{
  const shot = src('src/components/ide/ScreenshotPanel.tsx')
  check('images are downsampled to data urls', shot.includes('framesFromImage') && shot.includes('toDataURL'))
  check('videos are sampled into frames', shot.includes('framesFromVideo') && shot.includes('seeked'))
  check('frame budget is capped', shot.includes('Math.min(6'))
  check('frames go to the model as image parts', shot.includes("type: 'image'") && shot.includes('streamToCallback'))
  check('html or react output', shot.includes("'html' | 'react'") && shot.includes('Tailwind'))
  check('the result saves into the project', shot.includes("'/api/ide/file'") && shot.includes('screenshot.tsx'))
  check('no provider key gets an honest message', shot.includes('No provider key is configured'))

  const view = src('src/components/ide/CodingView.tsx')
  check('shot is a rail activity', view.includes("activity === 'shot'") && view.includes('ScreenshotPanel'))
}

console.log('\n— README: current, and free of dead hosts —')
{
  const readme = src('../README.md')
  check('dead image is gone', !readme.includes('i.ibb.co'))
  check('badge points at the current release', readme.includes('v0.40.0--beta.1'))
  check('screenshot to code is listed', readme.toLowerCase().includes('screenshot to code'))
  check('mcp one-click is listed', readme.includes('MCP servers, one click'))
  check('feeds are listed', readme.includes('Feeds that read like feeds'))
  check('language marks are listed', readme.includes("language's own mark"))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('failed:', fails.join(' | ')); process.exit(1) }
