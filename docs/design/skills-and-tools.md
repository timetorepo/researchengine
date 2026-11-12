# Design skills and tools

Installed 2026-11-12. Development guidance only: none of these files are imported into the product or exposed as Research Engine runtime skills.

## Installed skills (13)

| Skill | Use |
|---|---|
| unslop | Product-specific direction, spacing, copy, typography, and generic-AI-pattern review |
| apple-design | Apple-inspired interaction, hierarchy, materials, typography, accessibility |
| impeccable | Project-authored, text-only adaptation: accessibility, hierarchy, responsive layout, copy, state coverage |
| emil-design-eng | Control details, polish, design engineering |
| pick-ui-library | Choosing components without unnecessary dependency migration |
| animation-performance | Frame budgets, blur cost, React render overhead |
| animation-vocabulary | Translating ambiguous motion descriptions into precise terms |
| animate | Purposeful transitions and immediate feedback |
| gestures | Interruptible drag/swipe/sheet behaviour |
| find-animation-opportunities | Read-only proposals for useful feedback; not decoration |
| remove-animations | Removing latency and unnecessary effects, respecting approved choices |
| prototype | Isolated, explicitly requested interactive alternatives |
| ask-sonner | Notification/toast API and behaviour reference; no automatic Sonner migration |

Unslop is by Damir Sokolovsky / @heydamir, CC BY 4.0. Emil Kowalski's skills retain their MIT licence. The Impeccable adaptation retains the upstream Apache-2.0 licence and attribution. It is not the upstream Impeccable CLI or full skill. See per-skill LICENSE files and `skills.lock.json` for exact sources, commits, file hashes, and omissions.

## Installation profile

Project-local `.agents/skills/<name>/SKILL.md` discovery. Twelve upstream instruction-only skill copies plus one clearly marked adaptation. No skill scripts, binary helpers, automatic downloads, hooks, or image assets were installed. Upstream instructions can still mention omitted scripts/images; those steps are unavailable, not permission to fetch or run them. Instructions and supported text references are preserved; omission lists are in the lockfile.

Skills are loaded by compatible coding clients, not registered into Arena's native tool list or the app's skill database. This session can read and apply them directly. Root AGENTS.md records task routing and conflict rules.

## Suggested task routing

- Shell proposal: unslop + emil-design-eng + Impeccable adaptation.
- Glass/navigation: apple-design + animation-performance + gestures if needed.
- Settings reliability: Impeccable state/accessibility checks + emil-design-eng.
- Copy/layout: unslop + Impeccable adaptation.
- Library decision: explicitly invoke pick-ui-library; reuse HeroUI/Glisse first.
- Notifications: ask-sonner only if relevant; existing library decisions remain intact.
- Motion: choose animate or remove-animations, not both indiscriminately.
- Prototypes: only when explicitly requested; never replace the agreed proposal-first workflow.

## UI libraries

Already declared in frontend/package.json: HeroUI v3, HeroUI v2 modal sheets, Glisse, lucide-react, Motion/Framer Motion. No frontend dependency was added or migrated in this installation.

## Browser MCP

`.mcp.json` configures Microsoft's `@playwright/mcp` at **0.0.85**, with exact transitive dependencies and integrity digests in `tools/design/package-lock.json`.

```sh
npm ci --prefix tools/design --ignore-scripts --no-audit --no-fund
python3 tools/design/check-mcp.py
```

A compatible MCP client must load/approve this config. The server uses stdio, headless mode, an isolated browser context, blocked service workers, disabled page-provided WebMCP tools, and explicitly requested Chromium sandboxing. No personal browser profile, unrestricted file access, browser extension, or HTTP listener is enabled. Browser isolation is not a network/filesystem sandbox. Use only local test data and public reference pages; do not open private accounts or secrets. Browser download and runtime verification are separate from npm installation.

Measured here: MCP initialization and tools/list work; browser_close returned a missing Chrome-distribution error. No browser interaction or rendered UI was verified. Install a supported browser in an environment permitting the official browser download, then rerun the test. Do not weaken sandboxing to bypass runtime restrictions.

This server is installed/configured but not automatically injected into Arena's tool namespace. Arena's Vercel connector was discovered as enabled; no deployment was created. Mobbin connector discovery returned unsupported. No Pro subscription is required for our process: use accessible public pages, user-provided screenshots, and original app previews. Do not scrape gated material.

## Security and verification

Read `../security/design-skills-review.md`. All three raw SkillSpector reports are retained; initial critical findings were not erased or suppressed. Verify the installed file hashes with:

```sh
python3 tools/design/verify-skills.py
```

The scanner runtime was installed under ignored `.cache/design-skill-review/`, not in application dependencies. To reproduce on Python 3.12+:

```sh
# Obtain SCANNER_SHA from docs/design/skills.lock.json, then:
uv tool install "git+https://github.com/NVIDIA/SkillSpector.git@$SCANNER_SHA"
skillspector scan .agents/skills --recursive --no-llm --fail-on-incomplete --format json --output scan.json
```

Review both exit status and findings. CLI exit zero alone does not mean zero findings. No LLM-provider scan or live OSV advisory lookup was verified here. Do not send private app source to a semantic scan provider without separate approval.
