# ECC in Research Engine

Source: [affaan-m/ecc](https://github.com/affaan-m/ecc), "Everything Claude Code", MIT licence,
pinned at `76aaa77df6adc5b889e689007bf99b9a4f74af34` (package `ecc-universal` 2.2.3 at that commit).

## What ECC is

A harness-level collection for coding agents: about 311 skills, 71 agent roles, 97 slash commands, hook
configurations and rule sets, written as Markdown for Claude Code, Codex, Cursor and similar tools. Its
slash commands, hooks and MCP wiring are written for those tools' own runtimes. Research Engine does not
run them.

## What we took, and why

| ECC part | What Research Engine does with it | Where |
| --- | --- | --- |
| 16 skills (`SKILL.md`): research, writing, SEO, API design, TDD, verification, security review, git, ADRs, prompt tuning | Vendored as skill packs, the same way as the other packs. Chats can attach them and the skill rides along in the system context. | `frontend/src/content/skills/upstream/<id>/`, catalogued in `catalog.ts` |
| 8 agent roles: planner, architect, tdd-guide, code-reviewer, security-reviewer, seo-specialist, docs-lookup, doc-updater | A bot can start from one (*Start from an ECC role*). Its working method is added to the bot's system prompt, capped at 6,000 characters. | `frontend/src/content/ecc/agents.ts`, `lib/bots/logic.ts` |
| Slash commands, hooks, MCP configs, the 71 other roles | Not taken. They target a different runtime (a terminal agent with hooks), and vendoring them without that runtime would only add text. | — |

We chose files that do not depend on ECC's tools. The skills and roles are plain instructions, so they work in
a chat with any model you configure.

## How it is kept current

- Skills: `node scripts/vendor-skills.mjs --only seo,tdd-workflow` (fetches from GitHub at the pinned ref), or
  `--from <checkout>/skills` for an offline copy. Other packs are left as they are.
- Roles: `node scripts/vendor-ecc-agents.mjs` (or `--from <checkout>`). The roles file is generated; do not edit it.
- To move to a newer ECC, change `ECC_REF` in both scripts, re-run them, and run the tests.

The licence and credit travel with the work: `THIRD-PARTY-NOTICES.md`, each pack's `origin` file, and the
`license` and `credit` fields in the catalog.

## Not verified

- The vendored text was read from a local checkout at the pinned commit. The network path (GitHub API) was
  not run in this sandbox; the offline path was.
- ECC's own tests were not run here; only the Markdown was used.
