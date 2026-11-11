/**
 * Bot web routes, checked without the network: refusal of non-web addresses,
 * the search needing a query, and the HTML reader keeping only visible text.
 *
 * Run: npx tsx scripts/botweb-test.ts   (from backend/)
 */
import { Hono } from 'hono'
import { botWebRoutes, htmlToText } from '../src/routes/botweb.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

const app = new Hono()
app.route('/api/bots/web', botWebRoutes)
const post = (body: unknown) => app.request('/api/bots/web/open', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

console.log('1. Refusals')
let r = await app.request('/api/bots/web/search')
check('search without a query is refused', r.status === 400)
r = await app.request('/api/bots/web/search?q=test&searxng=' + encodeURIComponent('file:///tmp'))
check('a SearXNG address that is not http(s) is refused', r.status === 400)
r = await post({ url: 'file:///etc/passwd' })
check('open refuses a file: address', r.status === 400)
r = await post({ url: 'javascript:alert(1)' })
check('open refuses a javascript: address', r.status === 400)
r = await post({ url: 'https://example.com', browser: 'ftp://x' })
check('a browser address that is not http(s) is refused', r.status === 400)

console.log('2. Reader')
const html = `<!doctype html><html><head><title>Solar &amp; wind</title><style>p{color:red}</style></head>
<body><script>var x = "<p>hidden</p>"</script><h1>Prices</h1><p>Panels cost <b>less</b> now.</p><ul><li>One</li><li>Two</li></ul></body></html>`
const t = htmlToText(html)
check('the title is decoded', t.title === 'Solar & wind', t.title)
check('scripts and styles are dropped', !t.text.includes('hidden') && !t.text.includes('color'))
check('visible text is kept, with tags removed', t.text.includes('Panels cost less now.') && t.text.includes('Prices'))
check('list items keep their order', t.text.indexOf('One') < t.text.indexOf('Two'))

console.log(failed === 0 ? `\nALL PASS: ${passed} passed, 0 failed` : `\n${failed} FAILED, ${passed} passed`)
process.exit(failed === 0 ? 0 : 1)
