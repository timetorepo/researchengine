# How Rakazo's integrations work, and what we can use

Source: https://github.com/elie222/rakazo, read at its default branch in October
2026. Rakazo is Apache-2.0. These notes describe its design in our own words. We
have not copied its code. Paths below are relative to the repository root.

Rakazo describes itself as an open-source, self-hosted alternative to Grok Bot
(`README.md`). Its vision statement (`VISION.md`) sets the rules these notes
rely on: provider-neutral contracts, deterministic offline tests, bot state that
is exportable and recoverable, and consequential actions that respect an explicit
approval policy.

## The shape of an integration

Rakazo separates three things that often get mixed up.

1. **A provider** is a company or protocol that owns the connection to an app.
   Rakazo has Composio, Pipedream, MCP servers, GraphQL endpoints, and user-installed
   tool sources. Each one implements the same interface.
2. **A connection** is one person's authorised link to one app, through one
   provider. Connections are created by OAuth and revoked the same way.
3. **A tool** is one operation an app offers, such as "create calendar event". Tools
   are what the model sees, after routing.

The interfaces are in `packages/adapter-kit/src/interfaces.ts`:

- `ConnectorProvider`: `describe()`, `discoverTools()`, `resolveCall()` (optional),
  and `execute(call)`, which returns an async stream of events.
- `ConnectionAuthProvider`: `begin()`, `complete()` and `revoke()`, for OAuth.
- `ManagedConnectorProvider`: adds `catalog()`, `listConnectedExternalIds()` and
  `connectionReady()`, for providers that own an app catalog such as Composio and
  Pipedream.

The model-facing type `ConnectorTool` (`packages/adapter-kit/src/types.ts`) carries
`name`, `description`, `inputSchema` (JSON Schema), `readOnly`, and a `route`.
The `route` is internal routing data and is never sent to the model. The `readOnly`
flag declares whether a tool changes anything. `false` forces approval, and `true`
never relaxes the name-based check.

Provider configuration is validated by a discriminated union in
`packages/contracts/src/integration-settings.ts`: Composio takes one API key;
Pipedream takes client id, client secret, project id and environment.

## Keeping a large tool list usable

An app like Google Workspace has hundreds of tools. Putting them all in the
prompt wastes context and confuses the model. Rakazo's answer is in
`packages/adapters/src/lazy-tool-catalog.ts`:

- Up to `DIRECT_TOOL_LIMIT = 20` tools are offered directly.
- Above that, three wrapper tools are offered instead: `<prefix>_search_tools`,
  `<prefix>_load_tool` and `<prefix>_execute_tool`. The model searches by name,
  loads the schema for one tool, then calls it.
- The name index sent with the search tool is capped (`NAME_INDEX_MAX_NAMES = 200`,
  `NAME_INDEX_MAX_BYTES = 2048`), and a schema returned by `load` is capped at
  100 KB.
- Wrapper names must not start with `mcp_`. Their file notes that one prefix
  breaks requests to one model provider, and they say why in a comment.

This pattern is the one to copy when we add a second or third integration.

## Approval is bound to the exact action

`packages/adapters/src/approval-effect.ts` is the part we most want to learn from.

- Each proposed external action is stored with its route (provider, tool,
  resource) and its arguments. When the person approves, the approval is checked
  against the live route (`approvalRoutesMatch`, `approvalReplayPathError`), so an
  approval for one recipient cannot be replayed for another.
- Effects move through a state machine: `intended` (waiting for approval), then
  `approved`, then `executing`, then `completed`, `denied` or `uncertain`.
- `resolveDuplicateEffectGate` decides what happens when the same action is
  attempted again. A completed action returns its stored result. A denied action
  returns "do not retry". **An action found in `executing` is not re-run.** It is
  marked uncertain and the model is told so (`uncertainEffectResult`). That is the
  right behaviour when a send may or may not have happened.
- `claimApprovedEffect` claims the effect atomically, so two workers cannot both
  run it.

For us, the first version needs only the simplest part: a confirmation before any
write to an external app, and a record of what was sent.

## Secrets and errors

- Credentials are stored encrypted. `connector-http.ts` refuses a sensitive header
  (such as `Authorization`) in the public header list; it must go through the
  encrypted credential field instead. It also refuses transport headers such as
  `Host` and `Content-Length`.
- `connector-safety.ts` sanitises errors before the model sees them: it redacts
  `Bearer …` tokens, redacts known secrets from strings, object keys and values,
  and truncates to 2000 characters.
- `packages/adapters/src/private-endpoint.ts` blocks requests to private network
  addresses for user-supplied endpoints. Our calendar proxy does a narrower version
  of this: it only fetches Google's own host (`backend/src/routes/calendar.ts`).

## Tests that do not need the internet

Every provider has an emulator used by its conformance tests: `composio-emulator.ts`,
`pipedream-connector.test.ts`, `mcp-emulator.ts`, `third-party-connector-emulator.ts`,
`email-emulator.ts`, and others. Their test suite runs offline by default. That
is the right model for our own integrations: test against a recorded or fake
provider, not the real one.

## Which integration path fits us

| Path | What it is | Fit for Research Engine |
| --- | --- | --- |
| Remote MCP server | A standard protocol for tools; Rakazo supports it with OAuth (`mcp-connector.ts`, `mcp-oauth.ts`) | **Best next step.** We already have an MCP form and a Composio preset that goes through `mcp-remote`. |
| Composio | Managed OAuth and a large catalog; Rakazo uses its API key and tool routing | Good, but needs the user's own Composio key. We already support it through MCP. |
| Pipedream Connect | Managed OAuth; needs a Pipedream project with client id and secret | Heavier setup; not needed yet. |
| Google Calendar secret address | A read-only iCal link (what we built) | Done for calendars. Not a tool, so no approval is needed. |
| Google OAuth directly | Needs a Google Cloud OAuth client and a redirect URL | Blocked until the user registers an OAuth client. Not built. |

## What to build next, in order

1. **A connector registry in the backend**, with the `ConnectorProvider` shape above,
   so the calendar, mail and file connectors and any MCP server are listed in one
   place with one `readOnly` flag each.
2. **The lazy-catalog pattern** for any provider with more than 20 tools.
3. **A pending-action record** for writes: intended, approved, executing, completed,
   denied, uncertain. Show the person exactly what will be sent before it is sent.
4. **Connection health** (`connectionReady`) in Settings, so a revoked token is
   reported rather than failing silently in a chat.
5. **Export of bot state** (VISION.md asks for it): memories, routines and threads
   as one file the person can keep.

Open question for the team: Rakazo's Apache-2.0 licence allows us to copy its
code with attribution. We chose not to, so the notes above stay design notes.
