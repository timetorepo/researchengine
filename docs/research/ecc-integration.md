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
| 71 agent roles (`agents/*.md`), grouped under eight plain names: Researcher, Workflow, Builder, Reviewer, Guardian, Writer, Analyst, Maintainer | A person picks a plain role. For each request, the best one or two ECC members of that role are chosen against the request and the custom instructions (a bot's job, or the default chat role), and their method is added to the system prompt. Each member's text is capped, and the total is capped at 9,000 characters. | `frontend/src/content/ecc/agents.ts` (generated), `frontend/src/lib/ecc/roles.ts` (families and selection), `lib/bots/logic.ts`, `lib/chat/runChat.ts` |
| Slash commands, hooks, MCP configs | Not taken. They target a different runtime (a terminal agent with hooks), and vendoring them without that runtime would only add text. | — |

We chose files that do not depend on ECC's tools. The skills and roles are plain instructions, so they work in
a chat with any model you configure.

## How it is kept current

- Skills: `node scripts/vendor-skills.mjs --only seo,tdd-workflow` (fetches from GitHub at the pinned ref), or
  `--from <checkout>/skills` for an offline copy. Other packs are left as they are.
- Roles: `node scripts/vendor-ecc-agents.mjs` (or `--from <checkout>`). It discovers every `agents/*.md` at the pinned ref, so a new role is picked up on the next run. The roles file is generated; do not edit it. Each role must sit in one family in `frontend/src/lib/ecc/roles.ts`; `npm run ecc-roles-test` fails if one does not.
- To move to a newer ECC, change `ECC_REF` in both scripts, re-run them, and run the tests.

The licence and credit travel with the work: `THIRD-PARTY-NOTICES.md`, each pack's `origin` file, and the
`license` and `credit` fields in the catalog.

## Plain role names

The person never sees ECC's 71 names. `ROLE_FAMILIES` groups them under eight plain names. Selection is deterministic
and runs without a model: a member scores higher when its name (`python-reviewer` → *python*) appears in the request, and
lower when it appears in the custom instructions or in its description. The best two are used, and the lead member of the
family is used alone when nothing matches.

## Not verified

- The vendored text was read from a local checkout at the pinned commit. The network path (GitHub API) was
  not run in this sandbox; the offline path was.
- ECC's own tests were not run here; only the Markdown was used.
