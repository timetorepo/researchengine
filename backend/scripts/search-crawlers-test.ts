// Firecrawl and Crawl4AI as search engines, checked with a stubbed fetch:
//  - only http(s) crawler addresses are accepted
//  - a Firecrawl key goes to the hosted API with a Bearer header
//  - a self-hosted Firecrawl needs no key and sends no auth header
//  - Firecrawl with neither key nor address fails clearly
//  - Crawl4AI reads the top pages of a search seed and uses their text
import {
  crawlerBase, searchFirecrawl, searchCrawl4ai, FIRECRAWL_HOSTED,
} from '../src/services/search/adapters'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

type Call = { url: string; init?: RequestInit }
const calls: Call[] = []
let handler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response('nope', { status: 500 })
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input)
  calls.push({ url, init })
  return handler(url, init)
}) as typeof fetch

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

check('crawler address: http(s) only', crawlerBase('http://localhost:3002/') === 'http://localhost:3002' && crawlerBase('file:///etc/passwd') === null && crawlerBase('javascript:alert(1)') === null && crawlerBase('') === null)

// Firecrawl hosted
calls.length = 0
handler = () => json({ success: true, data: { web: [{ url: 'https://a.example.com/x', title: 'A', description: 'About A' }, { url: 'ftp://no', title: 'bad' }] } })
const hosted = await searchFirecrawl('breakcore', { key: 'fc-key' })
check('hosted Firecrawl goes to the hosted API', calls[0].url === `${FIRECRAWL_HOSTED}/v2/search`, calls[0].url)
check('hosted Firecrawl sends the key as Bearer', (calls[0].init?.headers as any).authorization === 'Bearer fc-key')
check('hosted Firecrawl parses data.web and drops non-http', hosted.length === 1 && hosted[0].snippet === 'About A' && hosted[0].domain === 'a.example.com', JSON.stringify(hosted))

// Firecrawl self-hosted, no key
calls.length = 0
handler = () => json({ success: true, data: [{ url: 'https://b.example.org/', title: 'B' }] })
const self = await searchFirecrawl('breakcore', { base: 'http://localhost:3002' })
check('self-hosted Firecrawl uses its own address', calls[0].url === 'http://localhost:3002/v2/search', calls[0].url)
check('self-hosted Firecrawl sends no auth header', !((calls[0].init?.headers as any).authorization))
check('self-hosted Firecrawl reads v1-style data array', self.length === 1 && self[0].title === 'B')

// Firecrawl with nothing configured
let thrown = ''
try { await searchFirecrawl('x', {}) } catch (e: any) { thrown = e.message }
check('Firecrawl without key or address fails clearly', /needs an API key/.test(thrown), thrown)

// Crawl4AI: seeds from DuckDuckGo (SearXNG instances fail), then crawl
calls.length = 0
handler = (url, init) => {
  if (url.includes('duckduckgo')) {
    return new Response('<a class="result__a" href="https://x.example.com/one">One</a><a class="result__a" href="https://y.example.com/two">Two</a>', { status: 200 })
  }
  if (url.endsWith('/crawl')) {
    const body = JSON.parse(String(init?.body))
    check('Crawl4AI is asked for the seed pages', Array.isArray(body.urls) && body.urls.length === 2, JSON.stringify(body))
    return json({ success: true, results: [
      { url: 'https://x.example.com/one', success: true, markdown: { raw_markdown: '# One\n\nBreakcore   is a  genre.' }, metadata: { title: 'Breakcore page' } },
      { url: 'https://y.example.com/two', success: false, markdown: '' },
    ] })
  }
  return new Response('x', { status: 500 })
}
const c4 = await searchCrawl4ai('breakcore', { base: 'http://localhost:11235' })
check('Crawl4AI returns the readable pages only', c4.length === 1, JSON.stringify(c4))
check('Crawl4AI snippet is the page text, whitespace collapsed', c4[0]?.snippet.startsWith('# One Breakcore is a genre.'), c4[0]?.snippet)
check('Crawl4AI uses the page metadata title', c4[0]?.title === 'Breakcore page')
check('Crawl4AI posts to /crawl on its address', calls.some((c) => c.url === 'http://localhost:11235/crawl'))

globalThis.fetch = realFetch
console.log(`search-crawlers-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
