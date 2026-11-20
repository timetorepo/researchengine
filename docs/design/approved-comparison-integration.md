# Approved design comparison → application integration

User approved the design comparison. This implements the bounded approved
choices, not a wholesale redesign or a new release. No Teams/network/security
behaviour, private content, provider settings or saved defaults changed.

## Included

- Desktop sidebar collapse **and** expansion: immediate compact/expanded layout
  with a 160/200 ms small directional transform/opacity settle. Unlike the
  isolated full-width drawer, the production compact rail stays a usable rail;
  there is no duplicate outgoing navigation, width tween, text scaling, animated
  blur, input lock or queued transition. Retoggling starts from current computed
  progress and cancels the old animation. Resizing/persisted width remain intact.
- Mobile: existing HeroUI sheet owns focus trap, Escape/outside dismissal and
  return focus; explicit left-slide enter/exit timings, no scale animation.
  Desktop animation ref is outside the shared sheet body, so delayed modal
  teardown cannot clear the desktop ref.
- New reactive reduced-motion hook respects saved settings and OS changes while
  mounted, canceling an active settle. Motion's existing hook in this installed
  version snapshots the initial OS value, so it was insufficient for the new
  sidebar's dynamic override. No unrelated effects were migrated.
- Appearance → Home screen → **Blue welcome card**, off until selected. Replaces
  the old Home headline only; composer/suggestions remain real. Static local
  Grainient freebie derivative with high-contrast scrim and solid image-error
  fallback. Start a question focuses the actual composer; Open Board navigates
  to the real Board. No synthetic user activity, staged progress, external asset
  requests, WebGL or Waves capture. Existing painted-picture setting is kept and
  resumes when this option is disabled.
- Appearance → **Geist Rounded** optional interface family. Existing typeface IDs
  and defaults preserved. Home → **Editorial welcome heading** uses Newsreader
  only for that heading. **Rendered code font → Lilex** changes rendered code and
  monospace labels, not embedded-editor preferences. Code ligatures remain off
  until explicitly enabled, with reset to the original Geist Mono fallback.
- Fonts are locally self-hosted OFL files with licences, exact hashes and source
  pins under `frontend/public/fonts/editorial`. CSS font-face declarations do not
  preload them. No new application dependencies or remote fonts.

At this initial checkpoint Waves remained in `tools/design-comparison`. A later
explicit user approval added the synthetic Home treatment Apply confirmation in
Appearance; see `home-treatment-wave-confirmation.md`. That approval does not
make private/credential/editor surfaces safe to snapshot.
AppLlama authenticated screen research remains unavailable in this conversation.

## Verification executed

- `npx tsc --noEmit -p frontend/tsconfig.json`: passes.
- Frontend Vite production build: passes, retaining existing dynamic-import and
  large-chunk warnings. Main chunk ~2,537 KB / 792 KB gzip; do not interpret this
  as a complete asset delta or a runtime performance measurement.
- `tools/design/check-approved-design.mjs`: real application browser checks for
  unchanged defaults/no eager new artwork/fonts, compact/expanded geometry and
  rapid settling, actual Appearance controls, persistence across reload, three
  local font loads, ligatures opt-in/default off, real composer focus/Board route,
  saved **and live OS** reduced-motion override, mobile light rendering/overflow,
  sheet close/Escape/focus restoration, desktop behaviour after mobile teardown,
  image failure, and no Waves import/page exceptions. API responses mocked; no
  provider calls or real keys. Screenshots in ignored `.cache/approved-design`;
  desktop dark and narrow light rendered and inspected.
- `tools/design/check-shell.mjs`: passes (navigation, floating clearance, tools
  focus/Escape, sidebar persistence, coding policy, 390/320px layouts).
- `tools/design/check-native-studio.mjs`: initially failed its stale expectation
  of Glisse while reduced motion was enabled. Updated the test to verify actual
  Glisse with motion enabled **and** the intentional static-navigation fallback
  with reduction enabled; the full test now passes, including settings keyboard,
  existing font selection, zoom/narrow overflow and active-chat clearance.
- All copied font SHA256 hashes verified; `git diff --check` passes.

Not verified: physical Tauri devices, OS-scale/assistive-technology matrix,
exhaustive contrast/target-size audit, frame-time/GPU/retained-memory benchmarks.
Browser emulation and builds are not certification. No deployment, release or
release-note preparation in this checkpoint.

## Review

Launch the ordinary frontend preview. Enable desired options in Appearance;
existing users do not receive a surprise Home/font migration. Full application
redesign, production Waves semantic-action effects, new default themes and code
editor font changes remain outside this checkpoint.
