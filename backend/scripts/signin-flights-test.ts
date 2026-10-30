// Sign-in tracking: the state rules, the link rule, and the routes the browser and the
// default browser use. The "open" route is not called (it would start a real browser).
import { Hono } from 'hono'
import { getSignIn, isSignInTarget, moveSignIn, signInCount, startSignIn } from '../src/services/signin'
import { signinRoutes } from '../src/routes/signin'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const ID = 'a1b2c3d4e5f60718'
const TARGET = 'https://connect.composio.dev/link/ln_test123'

// --- the link rule ----------------------------------------------------------
check('https link accepted', isSignInTarget(TARGET))
check('localhost http accepted', isSignInTarget('http://localhost:5173/api/signin/x/launch'))
check('127.0.0.1 http accepted', isSignInTarget('http://127.0.0.1:3000/x'))
check('remote http refused', !isSignInTarget('http://example.com/x'))
check('javascript refused', !isSignInTarget('javascript:alert(1)'))
check('credentials refused', !isSignInTarget('https://user:pw@connect.composio.dev/x'))
check('overlong refused', !isSignInTarget('https://a.example/' + 'x'.repeat(2000)))
check('garbage refused', !isSignInTarget('not a url'))

// --- ids and creation -------------------------------------------------------
check('short id refused', startSignIn('abc', 'composio', TARGET) === null)
check('id with symbols refused', startSignIn('abc$%^&*(xyz', 'composio', TARGET) === null)
check('bad target refused', startSignIn(ID, 'composio', 'http://example.com') === null)
const f = startSignIn(ID, 'composio', TARGET, 1000)
check('created open', f?.state === 'open', JSON.stringify(f))
check('get returns it', getSignIn(ID, 1000)?.state === 'open')

// --- state rules ------------------------------------------------------------
check('open → returned', moveSignIn(ID, 'returned', 2000)?.state === 'returned')
check('returned → closed refused', moveSignIn(ID, 'closed', 2100) === null)
check('returned → connected', moveSignIn(ID, 'connected', 2200)?.state === 'connected')
check('connected is final', moveSignIn(ID, 'failed', 2300) === null)

const ID2 = 'closedflight01'
startSignIn(ID2, 'composio', TARGET, 1000)
check('open → closed', moveSignIn(ID2, 'closed', 1100)?.state === 'closed')
check('closed → returned refused', moveSignIn(ID2, 'returned', 1200) === null)
check('closed → failed', moveSignIn(ID2, 'failed', 1300)?.state === 'failed')

// --- expiry -----------------------------------------------------------------
const ID3 = 'expiringflight3'
startSignIn(ID3, 'pipedream', TARGET, 0)
check('alive within 30 min', getSignIn(ID3, 29 * 60_000) !== undefined)
check('expired after 30 min', getSignIn(ID3, 31 * 60_000) === undefined)

// --- bounded table ----------------------------------------------------------
for (let i = 0; i < 260; i++) startSignIn(`bulkflight${String(i).padStart(4, '0')}`, 'composio', TARGET, 5000)
check('table stays bounded', signInCount() <= 200, String(signInCount()))

// --- routes -----------------------------------------------------------------
const app = new Hono()
app.route('/api', signinRoutes())
const RID = 'routeflight0001'
startSignIn(RID, 'composio', TARGET)

const get = (path: string) => app.request(path)
const post = (path: string, body: unknown) => app.request(path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

async function run() {
  const st = await get(`/api/signin/${RID}`)
  check('state endpoint open', st.status === 200 && (await st.json()).state === 'open')
  const bad = await get('/api/signin/x')
  check('state endpoint rejects bad id', bad.status === 400)
  const unknown = await get('/api/signin/unknownflight99')
  check('state endpoint unknown is 404', unknown.status === 404)

  const launch = await get(`/api/signin/${RID}/launch`)
  const html = await launch.text()
  check('launch page served', launch.status === 200 && html.includes('Open sign-in window'))
  check('launch page carries the target as JSON', html.includes(JSON.stringify(TARGET)))
  check('launch page is not cached', (launch.headers.get('cache-control') ?? '').includes('no-store'))
  check('launch page never redirects', launch.status !== 302)

  // A target that tries to break out of the script element is escaped.
  const EVIL = 'ZZZZevilflight1'
  startSignIn(EVIL, 'composio', 'https://connect.composio.dev/x?a=</script><script>alert(1)</script>')
  const evil = await (await get(`/api/signin/${EVIL}/launch`)).text()
  check('script breakout escaped', !evil.includes('</script><script>alert(1)'))

  const done = await get(`/api/signin/${RID}/done`)
  const doneHtml = await done.text()
  check('done page served', done.status === 200 && doneHtml.includes('window.close'))
  check('done page never opens ResearchEngine', !/window\.open|location\.href|location\.replace/.test(doneHtml))
  const afterDone = await (await get(`/api/signin/${RID}`)).json()
  check('done page marks the flight returned', afterDone.state === 'returned', JSON.stringify(afterDone))

  const stale = await post(`/api/signin/${RID}/state`, { state: 'closed' })
  check('late close after return refused', stale.status === 409)
  const okConnect = await post(`/api/signin/${RID}/state`, { state: 'connected' })
  check('app confirms connected', okConnect.status === 200 && (await okConnect.json()).state === 'connected')
  const returnFromClient = await post(`/api/signin/${RID}/state`, { state: 'returned' })
  check('client cannot claim returned', returnFromClient.status === 400)

  const launchAfter = await get(`/api/signin/${RID}/launch`)
  check('launch page ends once connected', launchAfter.status === 404)

  const CID = 'closeclientflt1'
  startSignIn(CID, 'composio', TARGET)
  const beacon = await post(`/api/signin/${CID}/state`, { state: 'closed' })
  check('launch page reports a closed window', beacon.status === 200 && (await beacon.json()).state === 'closed')
  const doneUnknown = await get('/api/signin/doesnotexist1/done')
  check('done page for an unknown id still closes', doneUnknown.status === 200)
}

run().then(() => {
  console.log(`signin-flights-test: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})
