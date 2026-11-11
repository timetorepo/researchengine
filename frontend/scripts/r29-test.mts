/**
 * R29 — six asks plus one gift, one suite.
 *
 *   • Kilo Code joins the providers (OpenAI-compatible gateway, key guide and
 *     all);
 *   • the Wikipedia reader stops coming back thin: sibling hosts resolve to
 *     their own API, and a thin extract is deepened with the parsed page;
 *   • the source viewer forwards the page you are reading to a new chat with
 *     your instruction attached;
 *   • the Library search field stops fighting the keyboard (no layout
 *     animation on the typed-in element, no re-focus per keystroke, memoized);
 *   • library folders take a colour of their own and fan open to their three
 *     most recent saves only;
 *   • new: citations — APA, MLA and BibTeX built from what the reader reduced.
 *
 * Run: node ../node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/r29-test.mts   (from frontend/)
 */
import { readFileSync } from 'node:fs'
import { citeAPA, citeMLA, citeBibTeX, CITATION_FORMATS } from '../src/lib/library/citations'
import { GooeyInput } from '../src/components/ui/aceternity/GooeyInput'

let passed = 0
let failed = 0
const fails: string[] = []
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`) }
  else { failed++; fails.push(name); console.log(`FAIL  ${name} ${extra}`) }
}
const src = (p: string) => readFileSync(p, 'utf8')

console.log('\n— Kilo Code is a provider —')
{
  const registry = src('src/lib/providers/registry.ts')
  check('registered under its own id', registry.includes("id: 'kilocode', name: 'Kilo Code'"))
  check('OpenAI-compatible dialect', registry.includes("id: 'kilocode', name: 'Kilo Code', kind: 'openai'"))
  check('points at the Kilo gateway', registry.includes('https://api.kilo.ai/api/gateway'))
  check('needs a key', /kilocode[\s\S]{0,200}needsKey: true/.test(registry))

  const types = src('src/types/index.ts')
  check('ProviderId union grew', types.includes("| 'kilocode'"))

  const guides = src('src/lib/providers/key-guides.ts')
  check('key guide with console steps', guides.includes('kilocode:') && guides.includes('kilocode.ai'))
  check('guide explains it is a gateway', guides.includes('gateway'))
}

console.log('\n— Wikipedia reads come back full —')
{
  const extract = src('../backend/src/services/reader/extract.ts')
  check('sibling hosts keep their own API host', extract.includes('apiBase') && extract.includes('commons.wikimedia.org'))
  check('thin extracts fall back to the parsed page', extract.includes('action=parse') && extract.includes('htmlToBlocks'))
  check('the fallback only deepens, never thins', extract.includes('if (rwords > words)'))
  check('a dropped-markup warning is honest', extract.includes('Some of the page was markup the reader drops'))
}

console.log('\n— A page you are reading can go to the AI —')
{
  const viewer = src('src/components/library/SourceViewer.tsx')
  check('Ask the AI toggle exists', viewer.includes('ask-ai-toggle') && viewer.includes('Ask the AI'))
  check('quick instructions ship with it', viewer.includes('Summarize this faithfully') && viewer.includes('Quiz me on this') && viewer.includes('Explain simply'))
  check('hands the reduced text to a new chat', viewer.includes('newChat()') && viewer.includes('runChat({ chatId, prompt })'))
  check('the pasted source is capped', viewer.includes('12000') && viewer.includes('truncated for the prompt'))
  check('answers stay grounded in the source', viewer.includes('Work only from the source below'))
}

console.log('\n— The search field stops fighting the keyboard —')
{
  const gooey = src('src/components/ui/aceternity/GooeyInput.tsx')
  check('the typed-in element is a plain input', gooey.includes('<input\n') && !gooey.includes('<motion.input'))
  check('no layout projection on the field', !gooey.includes('layoutId={inputLayoutId}\n                  ref={inputRef}'))
  check('focus effect no longer re-runs every keystroke', gooey.includes('}, [isExpanded]);') && gooey.includes('setSearchTextRef'))
  check('component is memoized', gooey.includes('memo(function GooeyInput'))
  check('memo is real at runtime', typeof (GooeyInput as any).$$typeof === 'symbol')

  const lib = src('src/components/library/LibrarySearch.tsx')
  check('stable callbacks feed the field', lib.includes('changeQuery') && lib.includes('submitSearch'))
  check('no fresh closures in the field props', lib.includes('onValueChange={changeQuery}') && lib.includes('onSubmit={submitSearch}'))
}

console.log('\n— Folders: your colour, three newest saves —')
{
  const dbs = src('../backend/src/db/index.ts')
  check('colour column in the schema', dbs.includes('created_at INTEGER, color TEXT'))
  check('old databases get the column', dbs.includes('ALTER TABLE library_folders ADD COLUMN color TEXT'))
  check('folders update in place', dbs.includes('updateLibraryFolder'))

  const routes = src('../backend/src/routes/library.ts')
  check('create accepts a colour', routes.includes("FOLDER_COLORS.includes(String(body?.color))"))
  check('a PATCH route repaints them', routes.includes("libraryRoutes.patch('/folders/:id'"))

  const lib = src('src/components/library/LibrarySearch.tsx')
  check('five swatches ship', lib.includes('FOLDER_SWATCHES') && ['Blue', 'Green', 'Manila', 'Rose', 'Slate'].every((c) => lib.includes(c)))
  check('palette on every folder', lib.includes('folder-palette-'))
  check('colour persists through PATCH', lib.includes('/api/library/folders/${id}') && lib.includes("'PATCH'"))
  check('the fan shows the three newest', lib.includes('inside.slice(-3)'))
  check('four-item fan is gone', !lib.includes('inside.slice(-4)'))
  check('creation form offers the swatches', lib.includes('newFolderColor'))
}

console.log('\n— Citations: APA, MLA, BibTeX from what the reader reduced —')
{
  const wiki = { title: 'JavaScript', url: 'https://en.wikipedia.org/?curid=9845', siteName: 'en.wikipedia.org', fetchedAt: Date.UTC(2026, 9, 4) }
  const apa = citeAPA(wiki)
  check('APA names the article and Wikipedia', apa.startsWith('JavaScript. (2026). In Wikipedia.') && apa.includes('https://en.wikipedia.org/?curid=9845'))

  const page = { title: ' Fusion energy, explained ', url: 'https://example.org/deep/fusion', siteName: 'example.org', fetchedAt: Date.UTC(2026, 9, 4) }
  const apa2 = citeAPA(page)
  check('APA falls back to n.d. with retrieval date', apa2.includes('(n.d.)') && apa2.includes('Retrieved October 4, 2026') && apa2.includes('example.org'))
  check('titles are cleaned, not invented', apa2.startsWith('Fusion energy, explained.'))

  const mla = citeMLA(page)
  check('MLA quotes the title and cites access', mla.startsWith('"Fusion energy, explained."') && mla.includes('4, 2026') && mla.endsWith('example.org/deep/fusion.'))

  const bib = citeBibTeX(wiki)
  check('BibTeX keys are deterministic', bib.startsWith('@misc{javascript2026,'))
  check('BibTeX carries title, publisher, url', bib.includes('title     = {JavaScript}') && bib.includes('publisher = {en.wikipedia.org}') && bib.includes('url       = {https://en.wikipedia.org/?curid=9845}'))

  const noTitle = citeMLA({ url: 'https://nowhere.test/x' })
  check('a missing title is admitted, not invented', noTitle.includes('Untitled page'))
  check('three formats are offered', CITATION_FORMATS.length === 3 && CITATION_FORMATS.map((f) => f.id).join(',') === 'apa,mla,bibtex')

  const viewer = src('src/components/library/SourceViewer.tsx')
  check('the viewer carries a Cite button', viewer.includes('cite-toggle') && viewer.includes('<Quote size={11} /> Cite'))
  check('every format copies', viewer.includes('cite-copy-'))
  check('it warns to verify before submitting', viewer.includes('check author and publication dates'))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('failed:', fails.join(' | ')); process.exit(1) }
