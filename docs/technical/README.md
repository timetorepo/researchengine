# Research Engine — Technical Documentation

This folder is the developer handbook for Research Engine. It explains how the
project is put together, why it is put together that way, and where to find
everything. It is written for a developer who has just cloned the repository
and needs to be productive without asking the original author.

Version documented: **1.1.0** (`package.json`, `backend`, `frontend`, `desktop`).

## Reading order

| # | Document | Read it when you want to… |
|---|---|---|
| 1 | [Overview](01-overview.md) | Learn what the product is, its principles, and the stack |
| 2 | [Repository layout](02-repository-layout.md) | Find where code lives and what each package owns |
| 3 | [Architecture](03-architecture.md) | Understand processes, request flow, and startup order |
| 4 | [Backend](04-backend.md) | Work on the Node server, routes, runtime, and persistence engines |
| 5 | [Frontend](05-frontend.md) | Work on the React app: routing, shell, state, theming, motion |
| 6 | [Chat engine](06-chat-engine.md) | Understand a message from keypress to saved answer |
| 7 | [Feature areas](07-feature-areas.md) | Find the code behind each product feature |
| 8 | [Data and persistence](08-data-and-persistence.md) | Know what is stored, where, and how it is keyed |
| 9 | [Security and privacy](09-security-and-privacy.md) | Understand keys, the vault, the lock, and the trust boundaries |
| 10 | [Desktop, website and release](10-desktop-website-release.md) | Build the desktop app, the site, or cut a release |
| 11 | [UI component system](11-ui-component-system.md) | Know which UI libraries are used and how they are vendored |
| 12 | [Testing](12-testing.md) | Run and extend the test suite |
| 13 | [Contributing](13-contributing.md) | Add a route, a provider, a background, a tool, or a component |
| 14 | [Known issues](14-known-issues.md) | Check the open gaps and the places where docs and code disagree |
| 15 | [Search crawlers, Marketplace and CRM](15-search-marketplace-crm.md) | Work on Firecrawl and Crawl4AI search, the Marketplace pages, or the CRM dashboard |

## Generated references

These pages are generated from the source by
[`tools/generate-reference.mjs`](tools/generate-reference.mjs). Regenerate them
after adding routes, components, modules, or scripts:

```bash
node docs/technical/tools/generate-reference.mjs
```

| Page | Contents |
|---|---|
| [reference/api-routes.md](reference/api-routes.md) | Every `/api` endpoint, with its method and the module that serves it |
| [reference/components.md](reference/components.md) | Every React component file, with its exports and header notes |
| [reference/modules.md](reference/modules.md) | Every lib, store, hook, service, and update module, with its purpose |
| [reference/scripts.md](reference/scripts.md) | Every npm script in the workspaces |

## Glossary

| Term | Meaning |
|---|---|
| **BYOK** | Bring your own key. Provider API keys are supplied by the user and never shipped with the app. |
| **Vault** | The browser-side encryption of stored keys (AES-GCM, key derived with PBKDF2). See [security](09-security-and-privacy.md). |
| **Sidecar** | The backend binary that the desktop shell launches. It is compiled with Bun. |
| **Single-process mode** | One Node process serves both the `/api` routes and the built frontend. This is the default way to run. |
| **Flow engine** | `AIFlowEngine`. Classifies a query, prunes old context into a capsule, caches answers, and paces streaming output. |
| **Capsule** | A compact summary of older messages that replaces them in the prompt. The full history stays local. |
| **Profile** | A resource preset (`eco`, `balanced`, `performance`) that caps concurrency and background work. |
| **Room / Bot / Project** | Bots feature: a *Bot* is a named teammate with its own thread and memory. A *room* is a group chat between bots. A *project* is handed from one bot to another. |
| **ECC role** | An agent role from the ECC library (affaan-m/ecc). Users pick a plain family name (Researcher, Builder…), and members are chosen per request. |
| **Connector** | A linked account (Drive, Mail, Calendar, Files, or a Composio app) the AI can read through tool calls. |
| **Artifact** | A piece of code from a chat, rendered as a live page on the local machine. |
| **Worktree** | A private copy of a coding project, so parallel agents never edit the same bytes. |

## Conventions used in these docs

- File paths are relative to the repository root unless stated otherwise.
- `backend/src/...` and `frontend/src/...` are the two source trees.
- Mermaid diagrams render on GitHub. In other viewers they show as code.
- Where the code and an older document disagree, the code wins, and the
  disagreement is listed in [known issues](14-known-issues.md).
