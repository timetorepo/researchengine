# Composio connectors

Composio gives one project key access to the apps it supports (over a thousand). Research Engine uses it for two
things: a **Connectors** section in the sidebar, where a person signs into apps, and tool access for the main chat and the bots.

## Flow

1. **Key.** The project key is pasted into the Connectors section. It is stored in `settings.composio.token`, encrypted
   with the vault passphrase like provider keys. Every request sends it to our own server in `x-re-composio-key`; the server
   uses it for that request and never stores it.
2. **Catalog.** `GET /api/v3.1/toolkits` is read page by page (up to 40 pages of 200) and cached for five minutes, keyed by
   a hash of the key.
3. **Connect.** `POST /api/v3.1/auth_configs` is used only when the project has no enabled auth config for the app
   (`GET /api/v3.1/auth_configs?toolkit_slug=…` is checked first). Then `POST /api/v3.1/connected_accounts/link` returns
   `redirect_url`, which opens in a new tab. The return address is `/?composio=connected`.
   Composio's legacy initiate endpoint is not used; its docs say it is retired for Composio-managed OAuth.
4. **Accounts.** `GET /api/v3.1/connected_accounts?user_ids=…` lists what this machine's user id has connected. The user id is
   random and made once, kept in settings.
5. **Tools.** `GET /api/v3.1/tools?toolkit_slug=…` lists an app's actions. `POST /api/v3.1/tools/execute/{slug}` runs one on
   the connected account whose app matches the name prefix (`GMAIL_…` → `gmail`).

## Who can use it

- **Main chat:** `composio_apps`, `composio_tools` and `composio_run` tools, next to the existing integration tools.
- **Bots:** tool lines `APPS:`, `TOOLS: <app>`, `RUN: <ACTION> {json}` and `FIND: <query>` (local accounts and files). These work
  whether or not web access is on. Web lines (`SEARCH`, `OPEN`) still need web access.

Actions that change things are described to the person first, and the model is told to wait for a go-ahead.

## Not verified here

The sandbox cannot reach `backend.composio.dev`, so the calls were checked against Composio's API reference, not run live.
The reference does not state the filter name for `GET /api/v3.1/tools`; `toolkit_slug` is the assumption to check first.
The route validation was tested locally (bad input and missing keys). The sign-in round trip was not.
