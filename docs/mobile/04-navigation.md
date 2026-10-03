# 04 — Navigation

## 1. Topology

Three destinations + one primary action (brief §7.1; anti-pattern #1 bans more):

| Tab | Route | Owns |
|---|---|---|
| Home | `/` | composer entry, recent work (the `recentChats.slice(0,3)` pattern from `home/HomeScreen.tsx`), offline-demo entry, pull-down Commands (desktop's palette → mobile sheet, `shared/CommandPalette.tsx` is the feature source) |
| Library | `/library` | search-first (field at top, lanes visible while typing), citations, knowledge cards, notebooks/spaces — the three tabs of `library/LibraryView.tsx` (`citations|knowledge|spaces`) become sections, not a segmented control, because 200% text |
| You | `/you` | profile name (existing `profileName` default "Researcher"), all 12 themes, appearance, Privacy Shield, providers/keys, companion, models, notifications, advanced, About |
| **Ask** (raised, mid tab bar) | sheet | mode chips (Search/Quality/Math/Replicate + Flow state readout), attachments (images ≤ 3 today, `input/InputBar.tsx`), model picker (the `TopBar` picker logic moves into the sheet), voice stub state per `09-states.md` until R7 |

Depth rule **[gate]:** ≤ 2 pushes + 1 sheet; a sheet may open only a *confirmation*
sheet. Long-press → action sheet on every card/row/message (replaces right-click).

## 2. Sheet detents

25 % / 50 % / 90 % **[gate]** with a grabber row; snap on release velocity
(spring, not curve); drag-to-dismiss below 25 %; Ask sheet opens at 50 % →
90 % when an attachment or mode row expands. Keyboard pushes the sheet, never
re-detents it. `radius-modal` 24 px top corners, top-only.

## 3. Route map (every route on mobile)

```
/                       Home
├─ /chat/:id            ChatView port (App.tsx:135) — push 1
│   ├─ /chat/:id/source/:n   source sheet (sheet, was hover-card on desktop)
│   └─ (long-press) msg actions sheet
├─ /ask (sheet)
├─ /commands (sheet, pull-down)
├─ /onboarding (first run, replaces the 5-step Onboarding.tsx; ends in a live chat)
└─ /pair?code=re://pair… (deep link, see §5)
/library
├─ /library/search?q=…        lane results
├─ /doc/:id                   Reader — push 1 (page streaming; native-island candidate #1)
│   └─ highlight actions sheet
├─ /notebook/:id              chat scoped to a space (`spaceId` on Chat/DocumentRecord)
└─ /articles/:id              ArticleEditor (long-doc native-island candidate #2)
/quiz                         QuizHub → /quiz/:id/play → /quiz/:id/result — one question per screen
/flood                        FloodView port (radio-room scale selector)
/workflows                    list → /workflows/:id (run/monitor/approve/history; build → companion offer)
/code                         companion-only: /code/:project → diff review (no editor)
/design                       ?design=1 preview route (dev builds only, brief §8 end)
/secrets                      easter egg, long-press Home 2s — kept (parity-matrix §1.2)
/you/*                        settings sections: theme, appearance, privacy, providers,
                              companion (pair/scopes/devices), models, notifications,
                              advanced (frame log, storage, cache), about
```

Desktop routes `/compare`, `/chats` fold into Library/You sections — the tab bar
cannot afford more destinations; compare keeps its capability inside the chat
long-press ("answer with another model").

## 4. Back

- iOS: interactive edge swipe, transition continues from interrupt point (brief §5.3).
  Every push has a visible back control (12 pt inset) for one-handed left-reach;
  Android: predictive back with system animation; sheet: back closes topmost
  sheet first (matches `useGlobalShortcuts.ts` Esc-ladder semantics).
- A back gesture never loses text: autosave on every keystroke settles (store
  debounce ≤ 50 ms), the pattern `useStore` already persists through.

## 5. Deep links **[gate]**

`researchengine://` + universal/app links on the hosted domain for: `chat/:id`,
`doc/:id`, `quiz/:id`, `flood/:runId`, `article/:id` (shared article),
`pair?code=` (companion pairing). Landing on any of these while unauthenticated
by device unlocks is impossible (no accounts) — links open the app to the object
directly. Foreign link to an unknown id renders the not-found state with the
glitch styling kept (the `easter/NotFound404.tsx` voice, one blink, reduced-motion
honours).

## 6. State on re-entry

Cold start → Home; warm → last route (memory only, never persisted — a phone
relaunch after a crash should show calm Home, not a half-open flood). Tab
switches preserve scroll exactly (list state is component-owned, brief tier-1
≤ 8.3 ms switch).
