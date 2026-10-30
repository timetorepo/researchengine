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

Connect is `connect(app)` in `MarketplacePage.tsx`, and it is unchanged from the
previous release:

1. The browser opens a blank tab **synchronously** on the click (a window opened
   later is blocked). The sign-in link is then set on that tab.
2. On the desktop app (this machine runs the server), `POST /api/composio/open`
   starts the default browser, which already holds the person's logins.
3. If the browser refuses the tab, the link is shown as **Open sign-in**, which
   the person presses. Nothing is asked to re-enter a key.
4. A sign-in is followed each second. A closed window, a five-minute timeout and
   a new account for the app are each noticed, and the Connect button changes
   shape: Connect → Connecting → Connected, or Failed (click to retry).

### Sync, which runs on every screen

`frontend/src/lib/composio/sync.ts` owns the account read that the sidebar count
and the *connected / disconnected* notices depend on. It runs every ten seconds
on the Marketplace and every thirty seconds elsewhere, and again when the window
regains focus. Connections made on Composio's website therefore appear without a
reload. `consumeComposioReturn()` handles the sign-in window landing back in the
app: it strips the marker and opens the Marketplace.

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
