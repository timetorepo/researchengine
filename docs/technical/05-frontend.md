# 5. Frontend

The frontend is a React 19 single-page app built with Vite. It is served by the
backend in production and by the Vite dev server in development. Source:
`frontend/src/`.

## Entry and providers

`main.tsx` does four things, in order:

1. Imports the fonts (Inter, Bricolage Grotesque, Plus Jakarta Sans, Poppins,
   Geist, Lora, all self-hosted through `@fontsource`), KaTeX and the global CSS.
2. Calls `startPerformanceSync()`, which mirrors the active profile to
   `<html data-perf>`. The CSS reads it to cap blur on weaker machines.
3. Renders `<App />` inside `React.StrictMode`.
4. In production builds only, registers `/sw.js`, the app-shell service worker.
   It caches static assets for offline reading and never touches `/api`.

`App.tsx` wraps the router in its providers and gates the whole tree:

```text
HashRouter
 └─ MotionConfig (reduced-motion aware)
     └─ ErrorBoundary
         ├─ LockScreen / VaultUnlock       (when the startup lock is on and no session)
         ├─ Onboarding                     (when settings.onboarded is not true)
         └─ Shell
             ├─ Sidebar, TopBar, route outlet (<Routes>)
             ├─ BackgroundLayer            (global, behind everything)
             ├─ SessionSwitcher, PrivacyPanel, DynamicIsland (optional), OSDock (optional)
             └─ Lazy overlays: SettingsSheet, CommandPalette, ShortcutsOverlay,
                SkillBuilderPanel, SkillRunModal, TasksPanel, DiagnosticsOverlay…
```

Background work started from `App.tsx`: the bot scheduler (`startBotScheduler`),
view-transition installation, the agent-activity wiring, and an idle preload of
every route chunk.

## Routing

Routing uses `HashRouter`, so the app works from `file://`-like hosts and inside
the desktop shell without server rewrites. URLs look like `#/chat/<id>`.

| Path | Screen | Component |
|---|---|---|
| `/` | Home | `home/HomeScreen` (eager: the landing view) |
| `/chat/:id` | Conversation | `chat/ChatView` |
| `/chats` | All chats, filterable by kind | `chats/ChatsView` |
| `/settings/*` | Settings | `settings/SettingsView` |
| `/flood` | Agent Flood | `agents/FloodView` |
| `/quiz` | Quiz hub | `quiz/QuizHub` |
| `/articles`, `/articles/:id` | Article list, editor | `articles/*` |
| `/library` | Library | `library/LibraryView` |
| `/compare` | Model comparison | `compare/CompareView` |
| `/workflows`, `/workflows/:id` | Workflow list, editor | `workflows/*` |
| `/calendar` | Calendar | `calendar/CalendarView` |
| `/bots` | Bots | `bots/BotsView` |
| `/code` | Coding | `ide/CodingView` |
| `/alpha` | Remover | `alpha/RemoverAlpha` |
| `/feedback` | Feedback | `feedback/FeedbackView` |
| `/secrets` | A hidden screen | `easter/SecretsRoute` |
| anything else | redirect to `/` | |

Every screen except Home is a `React.lazy` chunk. `lib/routes/registry.ts` maps
each path pattern to its chunk so the chunk can be prefetched on hover or during
idle time. Two rules come from bugs that were fixed:

- **Navigation is synchronous.** A click changes the route in the same tick. It
  never waits for a chunk. Prefetching is a background hint and can never reorder
  a navigation.
- **Transitions only animate into a screen that has rendered before.** A
  view transition never starts over a skeleton.

## Shell

`components/layout/Shell.tsx` is the window frame: sidebar, top bar, and the
main area, which holds the route outlet. The frame has rounded corners and a
glass background. It renders a guest strip when the session is a guest session,
so the person knows which account's data they are using.

The Shell has two layouts. The standard layout is the default. An "OS" layout
puts the same content inside a title bar, a dock and a dynamic island. Both use
the same route outlet.

### Sidebar

`components/sidebar/` holds the navigation, the chat history grouped by date, the
privacy panel and the collapsed-state rail. The Marketplace
(`components/marketplace/MarketplacePage.tsx`, routes `/marketplace` and
`/marketplace/:slug`) and the CRM page (`components/crm/CrmPage.tsx`, route
`/crm`) are routed pages; see [chapter 15](15-search-marketplace-crm.md). When collapsed, each button keeps a full hit area and the
rail does not overlap the content.

### Top bar

`components/topbar/TopBar.tsx`: the model picker, the context-window meter, the
resource meter, the update badge and the session-switch button (opens the
CardSwap deck of recent sessions). The fullscreen toggle shows only where the
platform supports the API.

## State

Four Zustand stores hold state. Each has one job.

| Store | File | Holds | Persisted |
|---|---|---|---|
| `useStore` | `stores/useStore.ts` | Chats, messages, skills, settings, providers, models, library, workflows, articles, tasks, personas, connectors | Yes, under `research-engine-v1`, namespaced per user. Written at most every 400 ms (`deferredJson`). |
| `useUI` | `stores/useUI.ts` | Transient UI: sidebar state, open overlays, the active flow stage, the focus timer, toasts, the queue of prompts | No |
| `useDesign` | `stores/useDesign.ts` | The Design-mode hub: research, boards, briefs, prototypes | Yes, `re.design.hub` |
| `useExam` | `stores/useExam.ts` | The exam gate state | Yes, `re.exam.v1` |
| `useNotices` | `stores/useNotices.ts` | In-app notices | No |

### Persistence rules

`lib/storage/deferredJson.ts` wraps zustand's persist storage. Zustand rewrites the
whole persisted state after every change. During a streamed answer that is dozens
of writes a second, and each one serialises every chat. The wrapper batches the
writes: it coalesces them into one write per 400 ms, and flushes when the page is
hidden (`visibilitychange`), when it is hiding (`pagehide`) and before unload
(`beforeunload`), so a closing tab does not lose the last change.

The merge function in `useStore` deep-merges the persisted state over fresh
defaults. This means a settings field added in a later version gets its default
rather than becoming `undefined`. Built-in skills are not persisted; they are
re-derived from code, so an update reaches everyone.

### Stores and components

Components read stores with selectors (`useStore((s) => s.settings.theme)`), so a
change to one field does not re-render unrelated components. Do not subscribe to
the whole store.

## Theming

Themes are data. `lib/themes/meta.ts` lists the 15 themes, each with an id, a
name, a kind (`light` or `dark`), four swatches (background, surface, primary,
secondary) and code colours. `applyTheme()` sets CSS custom properties on the
root element. Components should use the variables, not hex values:

```text
--bg  --surface  --elevated  --glass  --surface-border
--text-1  --text-2  --text-3  --primary  --secondary  --success  …
```

The tokens and base styles live in `styles/globals.css`. Tailwind 4 is used for
layout, and the variables carry the colour, so a theme change needs no rebuild.

The theme list covers the default light and dark themes, the Catppuccin set,
Nord, Solarized, High Contrast, ResearchEngineOS, and brand themes for Perplexity,
Claude, ChatGPT and Gemini.

### Backgrounds

`BackgroundLayer` renders behind all the chrome. The kind is chosen in
Settings → Appearance. There are 19 kinds: the built-in shape grid, dark veil,
dither, animated gradient, etched accretion, and the 14 ReactBits components
(floating lines, gradient ASCII, ghost fibers, topography, prism, light pillar,
antigravity, silk, pixel blast, colour bends, plasma, prismatic burst, galaxy,
liquid chrome). Each is lazy-loaded. `BackgroundManager.tsx` mounts the active
one and unmounts it when the tab is hidden. In eco mode or with reduced motion,
it renders a static CSS gradient instead. The ReactBits adapter is
`components/backgrounds/reactBitsBackgrounds.tsx`, which maps the theme's colours
onto each component's props.

## Motion

Motion uses `motion/react`. The rules are in `lib/ui/`:

- `handoff.ts` holds one set of motion numbers for home-to-chat handover. The
  pieces must move at the same speed, or the transition reads as broken.
- `settingsExit.ts` treats leaving Settings as a motion rather than a cut.
- `hooks/useViewTransitions.ts` installs the navigation hook once. The actual
  animated navigation goes through `lib/routes/vt.ts`, which animates only when
  `canAnimateNow()` says the browser supports it and the target screen has already
  rendered once.
- `MotionConfig` makes motion respect the OS "reduce motion" setting.

Toggles and switches animate their thumb with a transform (see
`components/ui/heroui/Switch.tsx`). Reduced motion removes the travel.

## Streaming text in the UI

A streamed answer is split into two parts by `lib/chat/streamSplit.ts`: the
*settled* part, which is safe to render as Markdown, and the *live tail*, which is
still arriving. Settled text only grows at paragraph breaks, so the settled part
does not need re-rendering on every token. `components/chat/StreamingText.tsx`
renders the settled part with the Markdown pipeline and reveals the tail word by
word with SpaceUI's `BlurRevealText`. Reduced motion shows the text at once.

## Markdown

`react-markdown` with `remark-gfm`, `remark-math`, and `rehype-katex`. Before
rendering, `lib/chat/markdownDialects.ts` normalises the dialects of the big
providers: ChatGPT's `\[ … \]` and `\( … \)` maths, the `【3†source】` and
`:contentReference[…]` citation markers, and Claude's and Gemini's own forms. The
output is the form the chat already renders: `$…$`, `$$…$$` and `[n]`.

## Components that matter most

These are the entry points a new developer will touch first. The full list is in
[reference/components.md](reference/components.md).

| Component | Folder | Role |
|---|---|---|
| `ChatView` | `chat/` | The conversation: messages, streaming, sources, tool cards, the composer |
| `ArtifactPanel` | `chat/` | The Artifacts-style panel: code from a chat, shown as a live preview |
| `InputBar`, `ModeStrip` | `input/` | The composer, the modes (Flow, Search, Quality, Math, Replicate), attachments, the `@` and `/` popups |
| `HomeScreen` | `home/` | The landing composer, quick actions, recent items |
| `SettingsSheet`, `SettingsView` | `settings/` | Settings as a sheet or a full page; one file per tab |
| `CommandPalette` | `shared/` | Keyboard navigation to anything |
| `LibraryView` | `library/` | Documents, saved items, folders, the source viewer, the video timeline |
| `CodingView` | `ide/` | Project tree, editor, terminal, live preview, agent panel, test runner |
| `BotsView` | `bots/` | Bot threads, group rooms, projects, the web and tools settings |
| `SessionSwitcher` | `sessions/` | CardSwap deck of recent sessions, opened from the top bar or the shortcut |
| `UpdateModal` | `updates/` | Update prompt, progress, and the rollback notice |

## Adding a screen

1. Create the component under the right feature folder.
2. Add a lazy import and a `<Route>` in `App.tsx`.
3. Add its path pattern and chunk loader to `lib/routes/registry.ts`, so it
   prefetches.
4. Add a sidebar entry in `components/sidebar/` if it should be reachable from the
   navigation.
5. If the screen is an overlay rather than a route, follow `SettingsSheet`: a
   lazy import in `App.tsx`, with the open flag in `useUI`.
