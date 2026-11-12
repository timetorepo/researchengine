# Focused shell — first implementation

2026-11-12. Implements the shell/navigation portion of design proposal 02, not the complete app redesign.

## Changes

- Compact 248px sidebar with five primary destinations, expandable specialist tools, global search, and an anchored settings/profile footer. All former destinations remain reachable; the collapsed rail exposes More tools by expanding the sidebar.
- A restrained New chat action replaces the bright New research block. Primary navigation uses a single selected surface; ordinary navigation no longer shows chevrons or bouncing labels. The rail no longer magnifies neighbours on hover.
- Collapse preference survives reload; mobile navigation opens expanded independently of that preference. The mobile drawer now uses the existing HeroUI v2 Modal primitive for focus containment, Escape dismissal, and restoration, with an explicit Close menu control.
- Contextual toolbar: section label on browsing screens, model selector on Home/active chat. Model access, session switching, fullscreen, version/build, and session token savings live in a HeroUI v3 Workspace tools popover. Tasks, privacy, update notices, timer/music controls, and explicitly enabled resource readings remain available. Timer/music stay mounted so hiding tools cannot interrupt their state.
- Sidebar/toolbar subscribe to the UI state they need instead of every countdown/overlay update.
- Glisse navigation is anchored to the content region, with 88px plus safe-area clearance reserved below the page. It adapts to 320px windows. It stays opt-in and appears on the coding project list, not active chat, Codersa, embedded coding/design workbenches, settings, or a workflow editor. The re-os theme keeps its existing OS Dock rather than adding duplicate navigation.
- Shared route policy avoids substring collisions such as /chat vs /chats. The coding screen explicitly reports its embedded-workbench state because it shares /code with the list.
- Reuses theme tokens, HeroUI, Glisse, Motion, and lucide-react. No production dependency, persisted data migration, default opt-in, or user-created content change.

## Skill application

Applied Unslop's quiet-chrome/spacing/copy guidance, Emil Design Engineering's fast frequent interactions, Apple Design's wayfinding/accessibility principles, and the Impeccable adaptation's task-oriented grouping. Product-specific decisions override blanket glass/animation bans. No skill helper scripts were executed.

## Verification

- TypeScript: `cd frontend && ../node_modules/.bin/tsc --noEmit -p .` — passed.
- Route policy: `node --import tsx --test frontend/scripts/shell-navigation.test.ts` — 17 passing tests.
- Frontend production build — passed; warnings remain for liveDemos dynamic-import patterns, modules with mixed static/dynamic imports, and oversized chunks. Those files were not modified in this task.
- Backend production build — passed (no backend source change).
- Sandboxed Chromium browser smoke test: `tools/design/check-shell.mjs` — passed. Checked primary destinations, tool popover Escape dismissal and trigger focus restoration, sidebar collapse persistence across reload, content-centred bar with actual reserved clearance, coding-list visibility, embedded-workbench state policy, Codersa exclusion, 390px page overflow, 320px bar fit, and mobile drawer opening/Escape. No pageerror events observed.
- Reviewed actual desktop and 390px screenshots after dismissing the existing intro and waiting for transitions. Test data was an empty account, not the populated user's database. The embedded-workbench browser check exercises its store flag without opening or changing a real project; route-policy unit tests cover the matching logic.
- Actual Playwright MCP JSON-RPC initialize/tools/list/browser_navigate against the local dev app succeeded using an isolated sandboxed browser. The committed wrapper supports BROWSER_EXECUTABLE; no sandbox-specific executable or library path is committed. Default Chrome remains absent, so the original MCP config needs a browser supplied by the environment.

For a compatible browser installation:

```sh
npm ci --prefix tools/design --ignore-scripts --no-audit --no-fund
BROWSER_EXECUTABLE=/path/to/chromium node tools/design/check-shell.mjs
BROWSER_EXECUTABLE=/path/to/chromium python3 tools/design/check-mcp.py
```

The smoke test expects a Vite development server (it uses its source-module imports to set test preferences). Override SHELL_PREVIEW_URL if needed. Screenshots go to ignored .cache/shell-review. Here a development-only @sparticuz/chromium 153.0.0 package in ignored storage supplied Chromium and its runtime libraries; sandboxing stayed enabled. Browser rendering uses Chromium, not Lightpanda. Lightpanda was not installed.

## Not yet implemented / not verified

- Alternate layout presets, sidebar resizing/pin-and-reorder, full density settings, new palette/font selection, material/refraction sliders, and motion settings remain later tasks. Existing user themes and settings were preserved.
- Chat-list/Home content redesign and settings-toggle diagnosis are separate proposals/tasks. This pass does not fix or claim to fix the reported settings bugs.
- No before/after performance benchmark, large-history scrolling test, screen-reader audit, physical touch-device check, 200% browser zoom audit, Windows/Tauri build, or release installer test. An emulated narrow window is not physical-device testing.
- No new release, deployment, or change to opt-in defaults.
