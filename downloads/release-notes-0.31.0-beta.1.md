# Research Engine 0.31.0-beta.1

The five things you pointed at in the composer and in Agent Flood, plus the one
that was not a visual bug at all: integrations that are supposed to *connect*.

## 1 · The mode popover

Picking a mode used to leave the menu sitting there until you dismissed it. It is
rebuilt as an actual popover:

- it anchors **above the button** and clamps itself to the window, so it can
  never be clipped by the composer's own box;
- the pick lands on **pointer-down and the menu closes in the same handler** — the
  action happens either way, so no re-render can resurrect it;
- Escape, the backdrop, a scroll and a resize close it too, and there is **no exit
  animation** in the close path (a menu that waits for an animation is a menu that
  can be left on screen — which is exactly what was happening);
- every row now says what it does in one line, and Math keeps its amber, because
  it changes how the answer is written rather than what is searched.

## 2 · The dictation pill

Two separate faults, both fixed at the source:

- **Cancel appeared without dictation.** The pill's `--vp-slide` and `--vp-cancel`
  variables were only ever written *while a pointer was dragging*, so at rest the
  Cancel label was reading an undefined variable. They are now pinned at rest:
  Cancel can only appear once there is a recording to cancel, and it goes the
  moment the recording does.
- **The pill did not belong to the composer.** It is a 30 px pill in this app's
  own colours — text-coloured icon, elevated body, your accent only while it is
  listening — and it follows your Voice settings for push-to-talk vs toggle.

## 3 · Integrations that actually work

The plug menu is no longer decorative, and the service behind it is real.

**In the menu:** your accounts as chips with their state · an inline **Connect**
form that stores the credential in the same local vault your provider keys use
and then **tests it against the live service** — it reports the account it is
signed in as, or the service's own refusal, verbatim · a search box that fans out
across everything connected, with every hit attachable to the message as context ·
rows that explain a failure and offer Connect instead of showing an empty list ·
and **Manage** to the full page.

**On the server:** a gateway (`/api/integrations`, `/search`, `/read`, `/probe`)
with genuine adapters —

| Service | What works |
| --- | --- |
| Google Drive | file search; Google Docs exported to text |
| Gmail | message search; full MIME body decoded |
| Google Calendar | event search with times and guests |
| GitHub | issue **and** code search; the token's real scopes read back |
| Notion | page search with the API version header it requires |
| Slack | message search the way a user token allows, with a clear message when a bot token is used instead |
| Local files | your own workspace, no account needed |

A refresh-token credential is exchanged for an access token **on the server, for
that one request**. Nothing is written, logged or echoed: credentials travel in a
header (`x-re-integrations`), are used, and are gone. A refusal is reported as
*connect this account*, never as *no results*.

**For the agent:** two new tools — `integration_search` and `integration_read` —
and attached account items become real references on the message (`int:gmail:…`)
that are read through the gateway when it is sent. "Not connected" is an answer
the model can act on, so it asks you to connect the account instead of inventing
what is in it.

**Settings → Integrations** stops pretending: no simulated OAuth toggle, no
Zotero entry that was never wired. Each service shows its real state, **Save &
test** only says *connected* after the service agreed, Disconnect removes what was
stored, and your local workspace sits underneath.

## 4 · Agent Flood, and one thing that was genuinely white

The `Theme-matched gradients` switch derived card gradients by mixing brand
colours into **the page** — which is right for dark palettes and wrong for every
light one: on Catppuccin Latte, Solarized Light and high-contrast, the cards and
the Deploy pill became pastel washes **with white type on them**. That is the
"it is just white". The gradients are now mixed into a base the palette itself
chooses: page colour on dark palettes, theme ink on light ones — the same
theme-matched gradient, deep enough to read.

## 5 · Everything else in this build

- **Bundle:** entry 1,024.80 kB / **321.50 kB gzip**; backend `dist/index.js`
  237.8 kb.
- **Tests:** render-check **798/0**, models 96/0, update 81/0 (+2 skipped, no
  network in the build sandbox), navigation 20/0, share 18/0, UI 60/0, smoke
  65/0, sample 33/0, design 32/0, render-probe 35/0, background props 12 themes ×
  4 kinds, and a **new integration suite (51/0)** that stubs the network and
  asserts the exact request each service receives — URL, auth header, API-version
  header, method, body — plus the "connect this account" semantics. Backend and
  frontend typecheck clean.
- **Create-path bench on the packaged portable build: 8/8 PASS**
  (`bench-report-0.31.0-beta.1.txt`).
- The composer's chip icons now know about every account type (`int:github`,
  `int:notion`, `int:slack` included), the plug button says what it opens
  (`aria-label="Connected data"`), and picking a result closes the menu.

## Updating

Already on 0.29.0 or newer? **Settings → Updates** finds this release, checks the
archive against the `SHA256SUMS` published with this tag, swaps the code, and
rolls itself back if the new version cannot start. Your library in
`~/.research-engine` is never part of the swap. A source checkout is told to
`git pull && npm run build`; the desktop app is handed its installer.

Portable archives are also in `downloads/` in the repository, with hashes in
`SHA256SUMS`:

- `research-engine-0.31.0-beta.1-linux-x64.tar.gz`
- `research-engine-0.31.0-beta.1-win-x64.zip`

Both are pure-JS portable builds: the only requirement is Node.js 20+.
