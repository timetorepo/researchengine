// Sign-in links open in the default browser. Only https links are accepted, and the
// link is handed to the OS opener as one argument, never through a shell.
import { Hono } from 'hono'
import { browserCommand } from '../src/services/browser'
import { composioRoutes } from '../src/routes/composio'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const link = 'https://connect.example.com/oauth?state=abc&x=1'
check('Windows uses rundll32 with the link as one argument',
  JSON.stringify(browserCommand(link, 'win32')) === JSON.stringify(['rundll32', ['url.dll,FileProtocolHandler', link]]))
check('macOS uses open', JSON.stringify(browserCommand(link, 'darwin')) === JSON.stringify(['open', [link]]))
check('Linux uses xdg-open', JSON.stringify(browserCommand(link, 'linux')) === JSON.stringify(['xdg-open', [link]]))

const app = new Hono().route('/api', composioRoutes({} as any))
const post = (body: unknown) => app.request('/api/composio/open', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

for (const bad of [
  'http://connect.example.com/oauth',
  'javascript:alert(1)',
  'file:///etc/passwd',
  'https://ok.example.com/ a b',
  'https://x.example.com/' + 'a'.repeat(2100),
  '',
]) {
  const r = await post({ url: bad })
  check(`refused: ${bad.slice(0, 40)}`, r.status === 400, `status ${r.status}`)
}
const missing = await app.request('/api/composio/open', { method: 'POST' })
check('no body is refused', missing.status === 400, `status ${missing.status}`)

// A good link reaches the opener. Whether this sandbox has a browser opener is not the point:
// the answer must be a clear success or a clear failure, never a crash.
const good = await post({ url: link })
const body: any = await good.json().catch(() => ({}))
check('a good link gets a clear answer', (good.status === 200 && body.opened === true) || (good.status === 500 && typeof body.error === 'string'), `${good.status} ${JSON.stringify(body)}`)

console.log(`composio-open-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
