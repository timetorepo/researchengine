// Sign-in tracking for connectors (Composio and Pipedream).
//
//   GET  /api/signin/:id          the state of one attempt: open, returned, closed, connected, failed
//   POST /api/signin/:id/open     desktop app: open the launch page in the default browser
//   GET  /api/signin/:id/launch   launch page: opens the sign-in in its own window and watches it
//   GET  /api/signin/:id/done     where the provider sends the person back; closes itself
//   GET  /api/signin/:id/error    where the provider sends the person when it could not sign them in
//   POST /api/signin/:id/state    the app or launch page reports 'closed', 'connected' or 'failed'
//
// The done page never opens ResearchEngine. It only records the return and closes
// the sign-in window. The app confirms the connection itself with the account list.
import { Hono } from 'hono'
import { openInDefaultBrowser } from '../services/browser'
import { getSignIn, moveSignIn, SIGNIN_ID, type SignInState } from '../services/signin'

const CLIENT_STATES: SignInState[] = ['closed', 'connected', 'failed']

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
}

/** A JSON value safe to place inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function page(title: string, body: string, script = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: #f6f6f7; color: #17171a; }
  @media (prefers-color-scheme: dark) { body { background: #111114; color: #f2f2f4; } .card { background: #1b1b20 !important; border-color: #2a2a31 !important; } .muted { color: #9a9aa5 !important; } }
  .card { max-width: 440px; width: 100%; background: #fff; border: 1px solid #e3e3e8; border-radius: 16px; padding: 28px; box-sizing: border-box; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { margin: 0 0 12px; }
  .muted { color: #6b6b75; font-size: 13px; }
  button, a.btn { display: inline-block; border: 0; border-radius: 999px; padding: 9px 18px; font: inherit; font-weight: 600; cursor: pointer;
    background: #6d5efc; color: #fff; text-decoration: none; }
  button[disabled] { opacity: .5; cursor: default; }
  a { color: #6d5efc; }
</style></head>
<body><main class="card">${body}</main>${script ? `<script>${script}</script>` : ''}</body></html>`
}

function launchPage(id: string, target: string): string {
  const body = `
    <h1>Sign in to continue</h1>
    <p id="msg">Press the button. Your sign-in opens in its own window. Finish there, and that window closes by itself.</p>
    <p><button id="go" type="button">Open sign-in window</button></p>
    <p id="fallback" class="muted" hidden>Your browser blocked the window. Open this link yourself: <a id="link" target="_blank" rel="noopener noreferrer">sign-in link</a></p>
    <p class="muted">Closing the sign-in window before it finishes tells ResearchEngine the connection did not complete.</p>`
  const script = `
(function () {
  var id = ${scriptJson(id)};
  var target = ${scriptJson(target)};
  var win = null, clicked = false, finished = false, started = Date.now();
  var msg = document.getElementById('msg'), go = document.getElementById('go');
  document.getElementById('link').href = target;
  function say(t) { msg.textContent = t; }
  function post(state) {
    return fetch('/api/signin/' + id + '/state', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: state }), keepalive: true }).catch(function () {});
  }
  function finish(text) {
    if (finished) return; finished = true;
    say(text);
    go.disabled = true;
    setTimeout(function () { try { window.close() } catch (e) {} }, 800);
  }
  go.addEventListener('click', function () {
    clicked = true;
    win = window.open(target, '_blank');
    if (!win) { document.getElementById('fallback').hidden = false; go.disabled = true; say('Waiting for the sign-in window.'); }
    else { go.disabled = true; say('Finish signing in in the window that opened.'); }
    watch();
  });
  function watch() {
    var timer = setInterval(function () {
      if (finished) { clearInterval(timer); return }
      if (Date.now() - started > 30 * 60 * 1000) { clearInterval(timer); finish('This sign-in has expired. Start again from ResearchEngine.'); return }
      fetch('/api/signin/' + id).then(function (r) { return r.ok ? r.json() : null }).then(function (j) {
        var st = j && j.state;
        if (st === 'connected') { clearInterval(timer); if (win && !win.closed) try { win.close() } catch (e) {} finish('Connected. You can close this tab; ResearchEngine has the new connection.'); return }
        if (st === 'failed') { clearInterval(timer); if (win && !win.closed) try { win.close() } catch (e) {} finish('The connection did not finish. Return to ResearchEngine to try again.'); return }
        if (st === 'returned') { say('Signed in. Finishing up…'); }
        if (win && win.closed) {
          clearInterval(timer);
          // Read the state again: the window may have just come back from the provider.
          fetch('/api/signin/' + id).then(function (r) { return r.ok ? r.json() : null }).then(function (j2) {
            var last = j2 && j2.state;
            if (last === 'returned' || last === 'connected') { finish('Signed in. You can close this tab.'); return }
            post('closed');
            finish('The sign-in window was closed before it finished. ResearchEngine will show that the connection did not complete.');
          }).catch(function () {
            post('closed');
            finish('The sign-in window was closed before it finished. ResearchEngine will show that the connection did not complete.');
          });
        }
      }).catch(function () {});
    }, 500);
  }
  window.addEventListener('pagehide', function () { if (!clicked && !finished) post('closed') });
})();`
  return page('Sign in · ResearchEngine', body, script)
}

function donePage(): string {
  const body = `
    <h1 id="title">Signed in</h1>
    <p id="msg">This window closes by itself. ResearchEngine picks up the new connection on its own.</p>
    <p class="muted" id="hint" hidden>You can close this tab now. Your sign-in is complete.</p>`
  const script = `
(function () {
  setTimeout(function () { try { window.close() } catch (e) {} }, 300);
  setTimeout(function () { document.getElementById('hint').hidden = false; }, 1500);
})();`
  return page('Signed in · ResearchEngine', body, script)
}

export function signinRoutes() {
  const r = new Hono()

  r.get('/signin/:id', (c) => {
    const id = c.req.param('id')
    if (!SIGNIN_ID.test(id)) return c.json({ error: 'That sign-in id is not valid.' }, 400)
    const f = getSignIn(id)
    if (!f) return c.json({ state: 'unknown' }, 404)
    return c.json({ state: f.state, provider: f.provider, ...(f.reason ? { reason: f.reason } : {}) })
  })

  r.post('/signin/:id/open', async (c) => {
    const id = c.req.param('id')
    if (!SIGNIN_ID.test(id)) return c.json({ error: 'That sign-in id is not valid.' }, 400)
    const f = getSignIn(id)
    if (!f || f.state !== 'open') return c.json({ error: 'This sign-in is no longer open. Start it again.' }, 409)
    const launch = `${new URL(c.req.url).origin}/api/signin/${id}/launch`
    const res = await openInDefaultBrowser(launch)
    if (!res.ok) return c.json({ error: res.error }, 500)
    return c.json({ opened: true })
  })

  r.get('/signin/:id/launch', (c) => {
    const id = c.req.param('id')
    const f = SIGNIN_ID.test(id) ? getSignIn(id) : undefined
    if (!f || f.state === 'connected' || f.state === 'failed') {
      return c.html(page('Sign in · ResearchEngine', '<h1>This sign-in has ended</h1><p>Return to ResearchEngine to start a new one.</p>'), 404)
    }
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'no-referrer')
    return c.html(launchPage(id, f.target))
  })

  r.get('/signin/:id/done', (c) => {
    const id = c.req.param('id')
    if (SIGNIN_ID.test(id)) moveSignIn(id, 'returned')
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'no-referrer')
    return c.html(donePage())
  })

  // The provider's error address. It only ever means the attempt failed, so the flight
  // moves to 'failed' with a reason the app can explain. A late error after success is refused.
  r.get('/signin/:id/error', (c) => {
    const id = c.req.param('id')
    if (SIGNIN_ID.test(id)) moveSignIn(id, 'failed', Date.now(), 'provider_error')
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'no-referrer')
    return c.html(page('Sign-in did not finish · ResearchEngine',
      '<h1>The sign-in did not finish</h1><p>The provider could not connect this account. Return to ResearchEngine for what to try next.</p><p class="muted">This window can be closed.</p>'))
  })

  r.post('/signin/:id/state', async (c) => {
    const id = c.req.param('id')
    if (!SIGNIN_ID.test(id)) return c.json({ error: 'That sign-in id is not valid.' }, 400)
    const body = await c.req.json().catch(() => null) as any
    const state = body?.state
    if (!CLIENT_STATES.includes(state)) return c.json({ error: 'That sign-in state is not allowed here.' }, 400)
    const f = moveSignIn(id, state)
    if (!f) return c.json({ error: 'That sign-in cannot move to that state.' }, 409)
    return c.json({ state: f.state })
  })

  return r
}
