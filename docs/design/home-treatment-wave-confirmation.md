# In-app Home treatment Apply confirmation with Waves

User approved the explicit confirmation action following the design comparison.
This checkpoint puts actual `distortion-waves` in the application, not only in
`tools/design-comparison`. It is deliberately limited to a synthetic sample in
Appearance. No deployment or release preparation.

## Use

1. Settings → Appearance → Home screen → **Home welcome-card preview**.
2. Enable **Wave confirmation** (optional, off initially; resets when this
   Appearance panel unmounts). Reduced motion disables this switch.
3. Select a different treatment: **Plain headline** or **Blue welcome card**.
4. Press **Apply Home treatment**. The real `homeWelcomeCard` preference changes
   immediately using the ordinary store/persistence path; the source-anchored
   wave changes only the sample above the live confirmation control.

Changing a radio alone does not save. Existing direct Home switches remain
available and synchronise the draft/sample. The Apply button uses guarded
`aria-disabled` when nothing differs so keyboard focus remains on it after a
confirmation; repeat activation is a no-op. Role=status reports the applied
setting, not animation progress or a fabricated completion timer. No save,
rollback or success callback depends on the wave finishing.

The blue sample is an illustrative fixed colour field, not a capture of the
actual Home artwork or personalised content. It is explicitly labelled synthetic.
The ordinary Home card continues to use the separately licensed static artwork.

## Safety boundary / lifecycle

`HomeTreatmentPreview.tsx` owns controls and ordinary state. Only its lazy
`HomeTreatmentWave.tsx` imports the pinned MIT package. Wave opt-in, visibility,
viewport intersection and motion policy gate that lazy child; no import or
prewarm during normal Home use or initial settings display. When disabled,
reduced, hidden, offscreen or unmounted, the renderer is removed. A failed import,
capture/context failure or missing WebGL leaves a plain sample and working Apply.

The actual wave root contains only fixed sample elements. Apply is a stable
positioned live overlay **outside** that root, and supplies the source rectangle.
Controls, announcements, forms and other settings are not in the capture tree.
The decorative sample is aria-hidden; controls and applied-state text remain
ordinary accessible DOM with independent names and keyboard behaviour.

More importantly, `capture` is a custom canvas drawing adapter. It uses only
slot/dimensions/scale from the capture request, draws constants from `HomeTreatmentSample.tsx`, and does
**not** inspect the element, walk DOM, serialize CSS, fetch assets, embed fonts,
copy images, or forward data to a service. Uses local Arial/system rasterisation,
not a font-download/capture request. Backing canvas capped at 800×240; renderer
resolution 1. The upstream generic DOM-capture implementation remains in the
package code but is not the execution path used here. Do not replace this adapter
with default DOM snapshots or make sample strings user-editable without review.

`prewarm=false`, `live=false`, one bounded renderer, no app-root wrapper and no
CSP/CORS/TLS bypass. Custom capture and module errors fail to a static preview;
context-loss listener unmounts without reverting the real setting. Dynamic
app/OS reduced motion bypasses rendering rather than relying on upstream's
crossfade. No capture of chats, code, PDFs, Board data, credentials, invites,
recovery, API keys or user metadata. No effect attached to typing/send/scroll.

## Package / attribution

Application dependency `distortion-waves@0.1.0`, MIT, exact pin in frontend manifest
and root lock. Integrity matches the reviewed comparison artifact:
`sha512-Y+UgvTq+KtvPOp26piB940ikKKWIf3MOMA8PoaFrSwOskbCDjNSwWW8vo0x6UvB2a9IjNGLBgu+f9+ORm0/sYg==`.
No runtime dependencies declared; React peers use the existing app installation.
Full MIT text in `docs/licenses/distortion-waves-MIT.txt` and bundled public
licence; added THIRD-PARTY-NOTICES entry. No Studio/Pro assets or paid code used.

Install/audit reported existing advisories in other dependencies (including
Vite/esbuild/router and backend packages); no finding for distortion-waves and
no other package version changed in the lock diff. This is not a clean security
audit of the repository; no unrelated automated/force upgrades performed.

## Verification

- Frontend TypeScript and Vite production build pass. Existing dynamic-import
  and oversized-chunk warnings remain. Measured lazy HomeTreatmentWave chunk:
  **76.37 KB / 28.23 KB gzip**. This is not startup transfer cost or a frame-time
  claim. No production Waves import before explicit enabled/eligible preview in
  browser checks.
- `tools/design/check-home-wave.mjs`: actual settings radio vs confirmation,
  immediate setting application, actual WebGL canvas, reverse/reapply, persistent
  setting after reload, effect opt-in reset, keyboard Apply focus, context-loss
  no rollback, mobile/no horizontal overflow, reduced-motion no-import including
  a live OS preference change, missing WebGL, rejected lazy module, no page
  exceptions/external requests in the primary flow. APIs mocked; no keys or
  provider calls. Screenshots in ignored `.cache/home-wave`; rendered desktop and
  narrow states inspected.
- Additional read-only browser diagnostic observed upstream controller in
  `mode=lens`, running intermediate progress, WebGL true and both captured slots
  ready; reported DOM walk/nodes zero. This confirms more than canvas existence
  in that run; it is not a complete privacy proof or a physical-GPU benchmark.
- `tools/design/check-approved-design.mjs`: existing production Home/sidebar/
  typography/settings/focus/reduced-motion/route/persistence/fallback checks pass.
- `git diff --check` passes. Browser tests are sandbox Chromium, not physical
  Tauri/WebView/device or screen-reader certification. Full contrast, native CSP,
  low-end GPU, exhaustive capture faults, frame-time and retained-memory work
  remain outstanding. No claim of native performance or security certification.
