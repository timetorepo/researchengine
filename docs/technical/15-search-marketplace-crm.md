# 15. Search crawlers, Marketplace and CRM

This chapter covers three things added together: two browser crawlers for
search (Firecrawl and Crawl4AI), the **Marketplace** that replaced the Connectors
dialog, and the **CRM** dashboard over Twenty. Each part says what it does, where
the code is, and what to check when it breaks.

---

## 1. Search: Firecrawl and Crawl4AI

Search is a ladder. The chat's Search toggle and the bots call the same
`/api/search` route, which tries engines in order and reports which one answered
(`backend/src/routes/search.ts`). Two crawlers were added to that ladder.

| Engine | What it does | Where it runs | Needs |
|---|---|---|---|
| **Firecrawl** | `POST /v2/search`, returns results with clean page text | Hosted (`api.firecrawl.dev`) or the open-source core on your machine | A hosted key, or a self-hosted address |
| **Crawl4AI** | Takes the top three results from another search, then reads each page with `POST /crawl` | Your own Crawl4AI server (Docker, port 11235) | A server address (optional bearer token) |

### How the ladder chooses

- **Automatic** (the default): a configured Firecrawl runs first, then a
  configured Crawl4AI, then SearXNG, then the public instances, then DuckDuckGo.
  "Configured" means a key or address was supplied, so nothing is called when
  nothing is set up.
- **Firecrawl selected**: only Firecrawl. A saved hosted key is used before the
  self-hosted address. If you have both, the hosted key wins; the address is
  kept for when the key is removed.
- **Crawl4AI selected**: Crawl4AI reads the top results from SearXNG or
  DuckDuckGo. It returns text snippets, not a list of links.

### Addresses and keys

Addresses are checked by `crawlerBase()` in
`backend/src/services/search/adapters.ts`. Only `http://` and `https://` are
accepted, which stops a value like `file:` from reaching `fetch`.

| Setting | Where it lives | Sent as |
|---|---|---|
| Firecrawl key | `settings.searchKeys.firecrawl` (on this device) | header `x-re-search-keys` |
| Self-hosted Firecrawl address | `settings.firecrawlUrl` | query `firecrawl=` |
| Crawl4AI address | `settings.crawl4aiUrl` | query `crawl4ai=` |
| Crawl4AI bearer token | server environment `CRAWL4AI_API_TOKEN` | header `Authorization` |

`FIRECRAWL_URL` and `CRAWL4AI_URL` are read as fallbacks, so a server started
with them needs no client setting. The key and the addresses are sent with each
request and never stored on the server.

### Status

`GET /api/search/status` now also returns `crawlers`:

```json
{ "crawlers": {
    "firecrawl": { "hosted": true, "selfHosted": false },
    "crawl4ai":  { "configured": true, "reachable": true } } }
```

`reachable` comes from a three-second `GET <crawl4ai>/health`. The Search tab
shows these as "answering", "configured, not answering" or "not set up yet".

### The Search settings tab

`frontend/src/components/settings/SearchTab.tsx`:

- **Firecrawl tip.** An accent alert (`InlineAlert`, HeroUI `Alert` underneath)
  says that the hosted API with a key is usually a little better than the
  open-source core, and links to the Marketplace entry `#/marketplace/firecrawl`,
  where Firecrawl is connected through Composio.
- **Self-hosted Firecrawl.** The address field and the three commands to run the
  open-source core (`git clone`, `cp .env.example .env`, `docker compose up -d`).
  The API listens on `3002` and is **unauthenticated by default**, so keep it on
  a trusted network. Its guide is the Firecrawl self-hosting page.
- **Crawl4AI.** The address field and
  `docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest`.
- **Keys.** A Firecrawl key sits with the Brave, Serper and Tavily keys.

### Tests

```
cd backend && node ../node_modules/tsx/dist/cli.mjs scripts/search-crawlers-test.ts
```

`scripts/search-crawlers-test.ts` stubs `fetch` and checks the request shapes,
the hosted and self-hosted choice, the `http(s)` guard, the top-three limit, and
the status fields. It runs offline (13 checks at the time of writing).

---

## 2. Marketplace

The Marketplace replaced the Connectors modal. It is a set of routes, not a
dialog, so an app has its own address and the browser's back button works.

| Route | Page |
|---|---|
| `#/marketplace` | The list: **Ready for coding**, search, categories, all apps |
| `#/marketplace/:slug` | One app: what the assistant can do, its tools, Connect |
| `#/marketplace` → **Connected** | Connected services, with disconnect |
| `#/marketplace` → **Pipedream** | Pipedream Connect: save your OAuth client once, then connect apps from its catalogue |
| `#/marketplace` → **Built in** | Built-in services and integrations (OpenSEO, VoiceStudio, Twenty, Postiz) |

Code: `frontend/src/components/marketplace/MarketplacePage.tsx`. Both routes
render the same component, so the state (for example a sign-in in progress)
survives moving between the list and an app. The routes are registered in
`App.tsx` and prefetched from `lib/routes/registry.ts`.

### The list

- **Ready for coding** shows the coding and productivity apps first, in a fixed
  order (`FEATURED`: GitHub, Vercel, Supabase, Netlify, Cloudflare, Sentry,
  Linear, Notion, Slack, Google Drive). An app that is not in the catalogue is
  skipped.
- Apps are then grouped by search and category. Connected apps float up within
  each group.
- The Connect button sits on the card. It stops the click from opening the app
  page, so Connect and the card do not fight each other.

### One app

- **Header.** Logo, name, categories, description (with *Read more*), tool count,
  sign-in method, and the single Connect action. Once connected, the header shows
  *Connected* and a two-press *Disconnect*.
- **Browse.** A HeroUI `ButtonGroup` with previous and next buttons moves through
  the catalogue one app at a time.
- **What the assistant can do.** One paragraph, written for the person. It says
  the chat, the coding mode and the bots can use the tools, and that results
  show as cards.
- **Tools.** Each tool is a row in a HeroUI `Accordion` (`allowsMultipleExpanded`).
  The row shows the readable name, a one-line description and a kind chip. The
  kind comes from the verb in the slug (`GMAIL_SEND_EMAIL` → Create):
  Read, Create, Update, Delete or Other. A `ButtonGroup` filters by kind, and a
  search box filters by name and description.

The tool list comes from `GET /api/composio/tools?toolkit=…`, which returns the
slug, name and description. The Composio API does not give parameter schemas to
this endpoint, so the page shows what a tool does, not its fields.

### Connect, and why it works from both the browser and the desktop app

Connect is `connect(app)` in `MarketplacePage.tsx`. Every attempt has an id
(a *flight*), and the server keeps one small record per flight in
`backend/src/services/signin.ts`. The record holds the sign-in link and a state:
`open`, `returned`, `closed`, `connected` or `failed`. It holds no key, and it
expires after 30 minutes.

1. The client makes the flight id and sends it with the connect request. The
   server stores the sign-in link under that id.
2. **Desktop app** (this machine runs the server): `POST /api/signin/:id/open`
   starts the default browser on a *launch page* (`/api/signin/:id/launch`). The
   launch page opens the sign-in in its own window when the person presses the
   button, and watches that window. When the window closes before the sign-in
   finished, the launch page reports `closed`.
3. **Browser**: the blank tab is pointed at the sign-in link directly. The app
   watches the tab itself as well.
4. Composio (and Pipedream, which is given the same return address) sends the
   person to `/api/signin/:id/done`. That page records `returned`, closes its own
   window and never opens a second copy of ResearchEngine. The window was opened
   by the app or by the launch page, so the browser allows the close.
5. Each second the app reads the flight state. A closed window fails the attempt
   after a two-second grace, with a **Sign-in window closed** toast and a
   *Start again* action. A sign-in that came back but shows no account within 30
   seconds fails with its own message. A five-minute timeout does the same. The
   app reads the accounts every 2.5 seconds; a new account ends the attempt as
   **Connected**, and the app tells the server `connected`, which closes the
   launch page's window.
6. If the browser refuses the blank tab, the link is shown as **Open sign-in**,
   which the person presses. Nothing is asked to re-enter a key.

Why a server record and not only the window handle: in the default browser the
app has no handle on the window at all. The launch page is the only thing that
can see it close, so it reports that to the server.

Limits: the done page closes its window only if the browser allows it (it
always does for windows the app or the launch page opened). If the person
opens the sign-in link by hand in another browser, the flight still ends on the
account check or the timeout.

### How Connect picks a path (and why some apps never opened a window)

Before this change, every app took the OAuth path. The page opened a blank window
first, then asked Composio for a sign-in link. An app that signs in with a key
(PostHog, for example) has no OAuth link, so Composio refused, the window closed,
and the person saw nothing open. That is why apps outside the featured list failed.

`startConnect` now reads each app's sign-in schemes from `GET /api/v3.1/toolkits/{slug}`
(`auth_config_details[].mode`) and chooses:

- **OAuth offered** (the default, even when a key is also offered): the redirect
  path described above. A window opens.
- **API key, bearer or basic only**: no window. The page (`KeyPanel`) asks for the
  fields Composio lists under `auth_config_details[].fields.connected_account_initiation.required`
  (for example `generic_api_key` and `region`). The server creates an `API_KEY`
  auth config with empty credentials, then `POST /api/v3.1/connected_accounts` with
  `connection.state = {authScheme, val: {…, status: "ACTIVE"}}`. The response is the
  connection, active at once. Values are sent to Composio and are not saved on the
  device. A key that is not accepted comes back as an error on the page.
- **No sign-in**: the connection is created without credentials.

The routes are `POST /api/composio/connect` (accepts `fields`) and
`GET /api/composio/toolkit-auth?toolkit=` (the scheme and the fields to ask for).

Test: `backend/scripts/composio-key-connect-test.ts` (14 checks against a stand-in
fetch: missing values are asked for, values reach Composio trimmed, an existing
config is reused, a non-active result is an error, an app with OAuth keeps the
redirect path, a no-auth app connects without state). Not run against live Composio:
that needs a real key for an API-key app.

### Apps that need the person's own developer app (Spotify)

Some OAuth apps have no managed sign-in at Composio. Spotify is the case that broke
Connect: an app with no managed sign-in fails with "Composio does not manage
auth". The flow now handles it:

- `startConnect` (`backend/src/services/composio.ts`) tries, in order: the person's
  own app when it is sent with the request; an enabled sign-in config already in the
  project (managed or custom, so a custom config is no longer ignored); a new
  managed config. If all three fail, the answer is `409` with
  `code: "needs_app_credentials"`.
- With an own app, the server creates one auth config named
  `Research Engine · <toolkit>` (`use_custom_auth`, `OAUTH2`, the credentials, and
  `oauth_redirect_uri` set to `https://backend.composio.dev/api/v3/toolkits/auth/callback`).
  On the next connect it PATCHes that same config, so a rotated secret takes effect
  and no duplicates pile up.
- The client (`frontend/src/lib/composio/client.ts`) throws `NeedsAppCredentialsError`
  on that code. The app page then opens `OwnAppPanel`: client ID, client secret
  (password field), optional comma-separated scopes, and the redirect URI to paste
  into the provider's developer app. "Save and connect" retries.
- The secret is stored under `settings.composio.apps[slug]`, encrypted with the vault
  passphrase when the vault is in use (the same rule as the Composio key). It is sent
  only with the connect request. The server keeps nothing.

Assumptions: the auth-config body follows Composio's v3 reference
(`toolkit` plus `auth_config`), and `PATCH` takes `{type, credentials}`. Both are
covered by `backend/scripts/composio-app-credentials-test.ts` against a stand-in
fetch. They have not been run against a live Composio project, which would need the
person's Spotify app.

Tests: `composio-app-credentials-test.ts` (14 checks), `composio-connect-test.ts`
(6), `connectors-test.mts` (32).

### Pipedream: a second connector provider

Pipedream Connect is a provider next to Composio, in the **Pipedream** tab of the
Marketplace. The person saves their own Pipedream OAuth client once: client ID,
client secret, project ID (`proj_…`) and environment (development or production).
The client secret is encrypted with the vault passphrase when the vault is on,
like the Composio key.

- **Credentials** travel base64-encoded in one header, `x-re-pipedream`, on each
  request. The server uses them for that request. It keeps only Pipedream's
  short-lived access token, in memory, for about an hour.
- **Catalogue**: `GET /api/pipedream/apps`, searchable. **Accounts**:
  `GET /api/pipedream/accounts`, one user's connected accounts. **Disconnect**:
  `DELETE /api/pipedream/accounts/:id` (press twice).
- **Connect**: `POST /api/pipedream/connect` asks Pipedream for a Connect token
  for the person's user id, sets the success and error addresses to the done
  page, and returns the Connect Link with `app=<slug>` added. From there the same
  flight tracker runs as for Composio.
- Code: `backend/src/services/pipedream.ts`, `backend/src/routes/pipedream.ts`,
  `frontend/src/lib/pipedream/client.ts`, `frontend/src/components/marketplace/PipedreamPanel.tsx`.

The endpoints are the documented ones (`api.pipedream.com/v1`). The account list
shape (`data[].app.name_slug`) and the client-credentials body were written from
the docs and are covered by a stubbed test only; a live Pipedream project has not
been tested from the sandbox.

### MCP servers, and where Composio requests go

Marketplace has four segments: Apps, Connected, Built in and **MCP servers**. The MCP
segment is the panel that used to live in Settings (`McpSection.tsx`); it needs no
Composio key. Composio requests can go to a self-hosted gateway instead of the hosted
API, from **Settings → Integrations → Advanced**. The hosted API is the recommendation.
See [16 — AI council, local models, generated media and Advanced settings](16-council-local-models-media.md).

### Sync, which runs on every screen

`frontend/src/lib/composio/sync.ts` owns the account read that the sidebar count
and the *connected / disconnected* notices depend on. It runs every ten seconds
on the Marketplace and every thirty seconds elsewhere, and again when the window
regains focus. Connections made on Composio's website therefore appear without a
reload. Sign-ins no longer land on the app root. `consumeComposioReturn()` only
clears the old `?composio=connected` marker from links made before this change.

### Changes from Connectors

- The sidebar row is **Marketplace** (store icon), and `openMarketplace(slug?)`
  is the one function that navigates to it. The command palette, the
  integrations menu and the `@`/`/` popups use it too.
- `useUI.connectorsOpen` is gone. `useUI.connectorsTab` remains and selects the
  tab.
- User-facing text now says "Marketplace → Built in" wherever it said
  "Connectors → Built in".

---

## 3. CRM

A dashboard over Twenty. Code: `frontend/src/components/crm/CrmPage.tsx`, route
`#/crm`, nav entry **CRM** in the sidebar (briefcase icon). The data comes from
`POST /api/services/crm/overview` (`backend/src/services/serviceClients.ts`,
`crmOverview`).

### Tests

```
cd backend && node ../node_modules/tsx/dist/cli.mjs scripts/crm-overview-test.ts
```

`scripts/crm-overview-test.ts` stubs Twenty and checks the totals, the newest
records, the 14-day window (a record 20 days old is left out), the coverage
counts and the 401 path (13 checks).

### What is on the page

- **Overview.** Four KPI cards (people and companies in total, new people and
  new companies in the last 14 days). A 14-day chart of new records (SVG, drawn
  in on open). A *How complete* panel of coverage bars. Newest people and newest
  companies. An *Add a person* form.
- **People** and **Companies** tabs: search by name (two letters are needed by
  Twenty), or the newest records when the search box is empty.
- **Not connected.** An accent alert with a button to the Marketplace's Built-in
  tab. The Twenty key is added there once.

### What the numbers mean

Twenty is read live, with no copy kept on the server. Two things are sampled:

- The **totals** come from Twenty's `totalCount` (or the rows fetched when that is
  missing).
- The **14-day chart**, the **new-records** KPIs and the **coverage** bars are
  counted from the latest 60 records of each kind. The page says so under each
  heading. A library with thousands of records is described by its newest 60, not
  by a full scan.

### Not included

The reference design has a sales funnel and a team panel. Neither has a source
in the data this page reads (Twenty opportunities and workspace members are not
fetched), so they are not shown rather than invented.

---

## Assumptions and limits

- **Firecrawl self-host port and command** are taken from Firecrawl's own
  self-hosting file (`SELF_HOST.md`): the API is published on `3002`, and the
  stack is started with Docker Compose from a checkout.
- **Crawl4AI** is taken from its Docker deployment README (`POST /crawl`, port
  `11235`, optional bearer token).
- **Twenty `totalCount`** is read from the response body if present; it is not
  confirmed against every Twenty version. The fallback is the number of rows
  fetched.
- **Coding apps.** The Marketplace lists GitHub, Vercel, Supabase and the other
  featured apps and makes them one click to connect, so they are available to the
  chat, the coding mode and the bots through the same connection. Whether every
  coding-mode action is wired to a specific Composio tool is a separate question,
  not covered here.
- **Not visually checked in a browser in this release.** The build, the type
  check, `connectors-test` (32 checks) and `cards-test` (8 checks) pass. The
  pages were not screenshotted, because no browser is installed in the build
  environment. Look at the Marketplace list, one app page and the CRM page in a
  real browser before relying on the layout.

See also: [Feature areas](07-feature-areas.md#connectors) ·
[Frontend](05-frontend.md) · [Backend](04-backend.md#search-ladder) ·
[Known issues](14-known-issues.md)
