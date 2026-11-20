# Action Waves implementation progress

Implemented 2026-11-12 on the existing working branch. This is implementation evidence, not release notes or a deployment record.

## Delivered in this pass

| Action | Actual success boundary | Effect |
| --- | --- | --- |
| Settings → Coding → command time limit → Save | Existing synchronous preference-store update returns | Fixed “Unsaved changes” → “Changes saved” receipt |
| Board → Save revision | Awaited local Board storage save resolves | Same fixed receipt, never Board text or attachments |
| Settings → Appearance → layout preset selection | Existing immediate preference update returns | Fixed schematic layout receipt |

Appearance → Workspace layout → **Action confirmation waves** is a saved, default-off opt-in. It is separate from the Home preview’s session-only switch and from Workspace effects. The new setting is searchable. Layout presets already applied immediately: no redundant Apply button was introduced. Re-selecting the current preset does nothing. Theme, density, sidebar resize, pinning, typing, autosaves, message sending, Reset, imports and exports do not trigger this effect.

This is bounded coverage, not every Save button in the application. Profile, provider, model, endpoint, security and integration forms remain unchanged. Exports remain deferred: invoking a browser download does not prove a file was saved.

## Safety and behaviour

- `ActionReceipt` receives only a numeric success event and a fixed layout flag. No form value, Board document, credential, code, image, theme CSS or user string reaches the renderer.
- `ReceiptWave` uses a custom canvas capture adapter with fixed public strings/colours. It never reads `request.element` or walks DOM; dimensions are capped at 800 × 160. Layout blocks are schematic, not a snapshot of the selected workspace.
- Real operations finish independently of loading, capture or animation. The live text status is outside the aria-hidden visual. Optional effects never delay success or dismiss readable errors.
- Default-off means no optional renderer import or receipt artwork. Once enabled, the module loads only after an eligible visible success. Reduced motion provides instant text/sample feedback without loading it.
- New edits clear the preceding save receipt. Board conflicts preserve the draft and existing error handling, without a success wave. Layout/Coding preference exceptions have readable errors.
- Stable guarded `aria-disabled` Save buttons keep keyboard focus after success; handlers reject no-op, invalid or unavailable saves.
- OS/app reduced-motion changes, tab hiding, leaving the viewport and component unmount tear down effects. Returning does not replay the previous event. Renderer import/capture failure, absent WebGL and context loss leave the committed result intact.
- Existing pinned `distortion-waves` 0.1.0 and its recorded MIT notices are reused; no new runtime dependency.

## Verification

Passed:
- `npx tsc --noEmit -p frontend/tsconfig.json`.
- Production Vite build, 42.76 seconds in this sandbox; existing chunk-size/dynamic-import warnings remain. Waves is split into shared/lazy chunks now, so the new ReceiptWave wrapper's 1.79 kB (0.93 kB gzip) is **not** the full renderer cost.
- `check-action-waves.mjs`: default-off/no lazy import; Coding actual save and focus; layout actual selection; persisted opt-in and preference reload; reduced motion including dynamic OS changes/no replay; invalid draft; 390px no horizontal page overflow; awaited Board save; stale writer refusal without success; rejected lazy import; simulated context-loss fallback; unavailable WebGL fallback. API routes are stubbed; no live provider calls.
- Existing `check-board-workspace.mjs`: create/edit/save/reload, recovery, previous revision, conflicts, isolation and wipe integration.
- Existing `check-home-wave.mjs`: prior Home preview behaviour and failure/reduced-motion coverage retained.
- Desktop layout/Coding and narrow Coding screenshots rendered and inspected in `.cache/action-waves/` (ignored artifacts).
- `git diff --check`.

Additional check **not fully passing**: legacy `check-workspace.mjs` progressed through layout persistence, sidebar resizing and chat-list checks, then timed out waiting for `.lg-tab-bar-glass` inside floating navigation (line 91). Cause not established in this task; this is not reported as a pass. No unrelated navigation change was made to satisfy that selector.

Not certified: physical GPU/device performance, native packaging, frame-time or memory budgets, assistive-technology behaviour, every other explicit Save form. No deployment, release, paid API call or provider substitution was performed.

## Progress summary

Home Apply Waves: previously complete. Reusable synthetic action receipt: implemented and verified for the three actions above. Broader Save-form adoption: still outstanding. Export completion effects: deferred. Existing Teams/transport/onboarding milestones are not changed or newly certified by this work.
