// Checks for the release README read used by the update card's "Read more".
// Run with: npm run readme-test (from backend/)
import {
  absolutiseReadme, fetchReadme, preloadReadme, README_TTL_MS, type UpdateDeps,
} from '../src/update/service.ts'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

// 1. Relative links and images are pointed at GitHub; absolute and anchor links are kept.
const md = [
  '# Title',
  '![logo](docs/logo.png)',
  '[guide](./docs/guide.md)',
  '[site](https://example.com)',
  '[top](#top)',
  '[mail](mailto:a@b.c)',
].join('\n')
const out = absolutiseReadme(md, 'org/repo', 'v1.2.3')
check('image path goes to raw.githubusercontent', out.includes('![logo](https://raw.githubusercontent.com/org/repo/v1.2.3/docs/logo.png)'))
check('relative link goes to the blob page', out.includes('[guide](https://github.com/org/repo/blob/v1.2.3/docs/guide.md)'))
check('absolute link is unchanged', out.includes('[site](https://example.com)'))
check('anchor and mail links are unchanged', out.includes('[top](#top)') && out.includes('[mail](mailto:a@b.c)'))

// 2. Fake GitHub: v-prefixed tag exists, so it is used; the result is cached.
const calls: string[] = []
const ok = async (url: string) => {
  calls.push(url)
  if (url.includes('/v1.2.3/README.md')) return new Response('# Hello\n[a](docs/a.md)', { status: 200 })
  return new Response('nope', { status: 404 })
}
const deps = (fetchImpl: any): UpdateDeps => ({
  appRoot: '/tmp/none', dataDir: '/tmp/none', currentVersion: '1.0.0', platform: 'linux-x64', kind: 'portable', fetchImpl,
} as any)

const first = await fetchReadme(deps(ok), '1.2.3')
check('reads the v-prefixed tag first', first.tag === 'v1.2.3' && first.markdown.includes('# Hello'), first.tag)
check('result names its source page', first.url === 'https://github.com/timetorepo/researchengine/blob/v1.2.3/README.md')
check('links are absolutised in the result', first.markdown.includes('https://github.com/timetorepo/researchengine/blob/v1.2.3/docs/a.md'))
const before = calls.length
const second = await fetchReadme(deps(ok), '1.2.3')
check('second read is served from cache', calls.length === before && second.fetchedAt === first.fetchedAt)

// 3. Falls back to the bare version tag when the v-prefixed one is missing.
const bare = async (url: string) => (url.includes('/2.0.0/README.md')
  ? new Response('bare tag', { status: 200 })
  : new Response('nope', { status: 404 }))
const fb = await fetchReadme(deps(bare), '2.0.0')
check('falls back to the bare tag', fb.tag === '2.0.0' && fb.markdown === 'bare tag', fb.tag)

// 4. Nothing readable: a clear error, not a crash, and nothing cached.
const none = async () => new Response('nope', { status: 404 })
let msg = ''
try { await fetchReadme(deps(none), '9.9.9') } catch (e: any) { msg = String(e?.message ?? e) }
check('missing README throws a plain error', /no README could be read for 9\.9\.9/.test(msg), msg.slice(0, 80))

// 5. Concurrent reads of one version share one request.
let hits = 0
const slow = async () => { hits++; await new Promise((r) => setTimeout(r, 30)); return new Response('shared', { status: 200 }) }
const d5 = deps(slow)
const [a, b] = await Promise.all([fetchReadme(d5, '3.0.0'), fetchReadme(d5, '3.0.0')])
check('concurrent reads make one request', hits === 1 && a.markdown === 'shared' && b.markdown === 'shared', `requests ${hits}`)

// 6. Preload never throws, even when GitHub is down.
let preloadOk = true
try { preloadReadme(deps(async () => { throw new Error('offline') }), '4.0.0') } catch { preloadOk = false }
check('preload never throws', preloadOk)

check('cache window is 30 minutes', README_TTL_MS === 30 * 60_000)

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
