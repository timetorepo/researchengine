/**
 * The built-in sample app: a tiny static page that ships with deliberate UI
 * problems (low contrast, tiny tap targets, horizontal overflow, a missing alt,
 * an inert button, skipped heading levels). It exists so Design mode can be
 * demonstrated end to end with zero installs — no dev server, no dependencies.
 */
export const SAMPLE_PROJECT: Record<string, string> = {
  'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Northwind — sample app</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">Northwind</div>
    <nav class="nav">
      <a href="#" class="navlink">Dashboard</a>
      <a href="#" class="navlink">Reports</a>
      <a href="#" class="navlink">Settings</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h2 class="hero-title">Ship research faster</h2>
      <p class="hero-sub">This sample page has real UI problems for the AI to find and fix.</p>
      <div class="hero-actions">
        <button id="primary" class="btn btn-primary">Get started</button>
        <button id="secondary" class="btn btn-ghost">See a demo</button>
      </div>
    </section>

    <section class="cards">
      <article class="card">
        <img src="icon.svg" class="card-icon" />
        <h3>Search</h3>
        <p class="muted tiny">Gather sources from the web, local files and your own connectors.</p>
        <button class="btn btn-link">Learn more</button>
      </article>
      <article class="card">
        <img src="icon.svg" class="card-icon" alt="Chat icon" />
        <h3>Ask</h3>
        <p class="muted tiny">Answers grounded in what you actually collected.</p>
        <button class="btn btn-link">Learn more</button>
      </article>
      <article class="card wide">
        <h3>Try it</h3>
        <form id="subscribe" class="row">
          <input id="email" type="email" placeholder="you@example.com" />
          <button class="btn btn-primary" type="submit">Notify me</button>
        </form>
        <p id="status" class="muted tiny"></p>
      </article>
    </section>
  </main>

  <footer class="foot">
    <span class="muted tiny">© Northwind Analytics</span>
  </footer>
  <script src="app.js"></script>
</body>
</html>
`,
  'styles.css': `:root { --ink: #1d2330; --brand: #4c6ef5; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--ink); background: #fff; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 28px; border-bottom: 1px solid #e6e8ec; }
.brand { font-weight: 700; letter-spacing: -0.02em; }
.nav { display: flex; gap: 16px; }
.navlink { color: #9aa2b1; text-decoration: none; font-size: 13px; }
.hero { padding: 44px 28px 18px; }
.hero-title { font-size: 34px; margin: 0 0 6px; }
.hero-sub { color: #a8b0bd; font-size: 13px; margin: 0 0 16px; }
.hero-actions { display: flex; gap: 10px; }
.btn { border: 0; border-radius: 6px; padding: 4px 7px; font-size: 11px; cursor: pointer; }
.btn-primary { background: var(--brand); color: #fff; }
.btn-ghost { background: #f1f3f7; color: var(--ink); }
.btn-link { background: none; color: var(--brand); padding: 2px; text-decoration: underline; }
.cards { display: grid; grid-template-columns: repeat(3, 320px); gap: 16px; padding: 24px 28px 40px; }
.card { border: 1px solid #e6e8ec; border-radius: 12px; padding: 16px; }
.card.wide { grid-column: 1 / -1; }
.card-icon { width: 22px; height: 22px; }
.card h3 { margin: 8px 0 4px; font-size: 15px; }
.muted { color: #b4bac6; }
.tiny { font-size: 10px; }
.row { display: flex; gap: 8px; margin: 10px 0 4px; }
input { padding: 5px 7px; border: 1px solid #e6e8ec; border-radius: 6px; font-size: 11px; }
.foot { padding: 18px 28px; border-top: 1px solid #e6e8ec; }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
`,
  'app.js': `document.getElementById('primary').addEventListener('click', function () {
  console.log('primary clicked')
})
document.getElementById('secondary').addEventListener('click', function () {
  // BUG: this button does nothing visible
})
document.getElementById('subscribe').addEventListener('submit', function (e) {
  e.preventDefault()
  var email = document.getElementById('email').value
  if (!email) { console.warn('empty email'); return }
  document.getElementById('status').textContent = 'Thanks — we will email ' + email
})
`,
  'icon.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></svg>
`,
  'README.md': `# Northwind (sample app)

A tiny static page that ships with a handful of deliberate UI problems:

- low-contrast body copy and 10px text
- tap targets far below 32px
- a grid that overflows horizontally on narrow screens
- an image with no \`alt\`
- a button that does nothing
- no \`h1\` on the page

Open **Design mode** and ask the AI to audit the screen, fix the issues, and prove it
with assertions — or use the Test panel to click every control yourself.
`,
}
