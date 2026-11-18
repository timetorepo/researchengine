# ResearchEngine — Native Studio design proposal

Status: proposed, awaiting approval. No product UI or brand assets changed for this proposal.

## 1. Creative direction

**A research instrument with an inviting face.** Quiet warm-graphite chrome,
compact desktop controls, confident typography, and one recognisable sculpted
mark. Not a landing page inside a window. Not a wall of glass demo cards.

- Product: a local-first studio for research, writing and agent-assisted coding.
- Character: curious, assured, tactile.
- Material world: graphite instruments, frosted edges, ink and diffused light.
- Rich moments: the app icon/onboarding identity and an optional gradient backdrop.
- Signature: an open, forward-facing notch in the logo, echoed subtly in selection markers.

Your references contribute bold negative space, soft geometric corners, a strong
monochrome silhouette and a dimensional app-icon finish. We will not reproduce
the Crest symbol, another brand's C, or any icon from the supplied collection.
The product remains ResearchEngine; these are references, not replacement names.

## 2. Original identity: “Open Engine”

Recommended concept: two substantial, softly chamfered forms enclosing an open
aperture. The negative space hints at an R and an unfolding page; a forward
opening suggests entering a line of inquiry. No generic sparkle, atom, brain,
or magnifying-glass badge. Avoid depending on fine details to communicate R/E.

Deliver the **same mark in two required forms**:
1. Symbol alone, optically tuned for 16/24/32px toolbar use and a larger app icon.
2. Symbol + ResearchEngine wordmark, with a horizontal primary lockup.

Also supply monochrome light/dark SVGs, outlined wordmark artwork, transparent
PNGs, a padded rounded-square desktop icon, and a small clear-space/minimum-size
sheet. Keep the flat source mark independent from the dimensional icon treatment.

Creative process after approval: show two original symbol concepts first, each
with its matching wordmark; refine the selected concept into precise vector
geometry. Generated imagery may help explore material finish, but it will not
be represented as editable vector artwork or become the only source asset.
Check visual similarity and small-size recognition; no trademark-clearance claim.
Do not update every app icon or installer asset until the identity is selected.

## 3. Typography from FaceTypes

Reviewed https://facetypes.xyz/ — these candidates are listed there. Verify the
actual upstream font licence before bundling; the catalogue's commercial-use
statement is not a substitute for retaining the font's licence.

| Candidate | Proposed role | Reason |
| --- | --- | --- |
| Allo | Recommended interface candidate | Friendly without becoming cartoon-like; inspect small UI sizes first |
| Work Sans | Interface comparison/fallback candidate | Screen-oriented workhorse for dense controls and long labels |
| Bricolage Grotesque | Recommended wordmark / sparse display candidate | Distinctive shapes and optical-size character for the brand |
| Cal Sans | Alternative wordmark candidate | Strong, simple silhouette; compare against the more expressive option |
| DM Mono | Code-adjacent labels, IDs and timing | Quiet mono companion, never whole paragraphs |

Build one **real rendered specimen** before changing the global font: same
settings rows, chat paragraph, code block, long filename, numbers and Indonesian
sample text. Compare Allo and Work Sans at 12/13/14/16px, normal/medium/semibold,
light/dark, and 200% zoom. Select a pairing from actual rendering rather than
assuming the specimen proves language coverage. System UI remains the fallback;
code-editor font preference remains independent. Self-host approved WOFF2 assets,
limit initial font requests, and use swap/fallback metrics to limit layout shift.
Do not redistribute Apple SF fonts as webfonts.

## 4. Desktop-native structure and Glisse

SwiftUI is the interaction reference, not a claim that React becomes native
SwiftUI. The Tauri build should respect its OS window rather than draw a web
landing page or pretend macOS traffic lights on Windows.

- A stable title/toolbar row; compact source sidebar; one central working canvas;
  optional right inspector. No repeated giant page headings and intro banners.
- Glisse is the **single floating navigation bar**, reusing the installed MIT
  TabBar. Do not install Uberdesigner's tab bar beside it.
- Keep existing saved opt-in/navigation preferences and the active-chat/Codersa
  exclusions. The project-list view may show the bar; editor/composer clearance
  remains reserved. A static, opaque equivalent must work without refraction.
- Contextual run/download state belongs in an adjacent compact status capsule,
  not a second competing navigation system. Expand on deliberate interaction;
  no automatic width changes while the user is targeting a tab.
- Toolbar actions are icon buttons with tooltips and keyboard shortcuts.
  Primary actions use restrained filled buttons, not gradient call-to-action pills.
- Replace settings-page card grids with grouped form rows, aligned trailing
  values and contextual help. Boolean settings use compact platform-like
  switches; multiple modes use segmented controls/radio groups; navigation uses
  disclosure rows. Retain accessible switch semantics and visible focus.
- Menus/popovers, keyboard selection, predictable Escape, focus restoration,
  resizable panes, context actions and undo provide native feel—not decoration.
- Preserve all settings/state and distinct layout/density/material preferences.

## 5. Uberdesigner discovery: 24 references mapped to real components

Reviewed the public free-filter catalogue at https://uberdesigner.ai/?tier=free.
These are **reference candidates**, not 24 freely redistributable packages.
Names/links identify the catalogue entries; adaptations below are our own
product-specific implementations. Public catalogue review is not a claim that
all interactive demos/source were inspected. Inspect shortlisted demos before
implementation. Do not import the site's autoplay loops or invented statistics.

| # | Public reference | ResearchEngine application / decision |
| --- | --- | --- |
| 1 | [Paper widgets](https://uberdesigner.ai/t/paper-widgets) | Grouped settings rows and restrained surfaces |
| 2 | Paper widgets — music player | Existing user-started music controls; actual playback state |
| 3 | Paper widgets — focus timer | Existing focus session display; actual timer only |
| 4 | Paper widgets — calendar agenda | Calendar event list with actual saved events |
| 5 | Paper widgets — progress indicators | Existing downloads/setup; known vs unknown totals |
| 6 | [Spotlight tabs](https://uberdesigner.ai/t/spotlight-tabs) | Subtle selected-tab contrast in Glisse, not another bar |
| 7 | [Flow tab bar](https://uberdesigner.ai/t/flow-tab-bar) | Material/movement study; installed Glisse remains implementation |
| 8 | [Energy morph](https://uberdesigner.ai/t/energy-morph) | Compact/expanded running-operation status capsule |
| 9 | [Pip login](https://uberdesigner.ai/t/pip-login) | Connection form field/error hierarchy; omit robot/autoplay |
| 10 | [Verification code](https://uberdesigner.ai/t/verification-code) | Existing authenticator setup/verification input states |
| 11 | [Holiday calendar](https://uberdesigner.ai/t/holiday-calendar) | Date picker selection and event markers; omit particle holidays |
| 12 | [AI glow button](https://uberdesigner.ai/t/ai-glow-button) | Distinct agent-run action with restrained pending state; no perpetual glow |
| 13 | [Duo card](https://uberdesigner.ai/t/duo-card) | Expandable source/project summary with real details |
| 14 | [Home widgets](https://uberdesigner.ai/t/home-widgets) | Home quick controls for existing features |
| 15 | [Beamfall](https://uberdesigner.ai/t/beamfall) | Real usage/spending chart and tooltip hierarchy; no theatrical beam |
| 16 | [Transfer card](https://uberdesigner.ai/t/transfer-card) | Explicit project/source move confirmation; no money-transfer feature |
| 17 | [Warp cards](https://uberdesigner.ai/t/warp-cards) | Optional theme/layout preview selector; flatten distortion for readability |
| 18 | [Glass widgets](https://uberdesigner.ai/t/glass-widgets) | Compact existing resource/status summaries; no fake health metrics |
| 19 | [Night dial](https://uberdesigner.ai/t/night-dial) | Existing automation time selection with keyboard/text alternative |
| 20 | [Laser engrave](https://uberdesigner.ai/t/laser-engrave) | Real update-stage labels; discard simulated timed engraving |
| 21 | [Melune](https://uberdesigner.ai/t/melune) | Optional still-gradient onboarding panel; no pinned-scroll WebGL journey |
| 22 | [Lucid](https://uberdesigner.ai/t/lucid) | Material/transparency comparison preview; no wipe gesture requirement |
| 23 | [Vibetyper](https://uberdesigner.ai/t/vibetyper) | Existing optional keyboard effect's settings preview; keep consent/off default |
| 24 | [Portale](https://uberdesigner.ai/t/portale) | Wallet card artwork treatment; no 3D flight/scroll interaction |

This is more than twenty component references with real-feature placements, not
a promise to scatter twenty-four unrelated visual styles through the app.
Entries 1–5 intentionally draw distinct widgets from the same coherent study.
The first implementation tranche is the shell, controls, Glisse and typography;
remaining patterns are applied only where they improve an existing workflow.

**Licensing boundary:** inspected Paper Widgets and Flow Tab Bar pages explicitly
state free-account personal use only; paid tiers add commercial/client work,
with restrictions on sharing prompts/files. No sign-in, gated prompt, project
ZIP or Figma extraction is included. Use original implementations informed by
public visual principles; any direct licensed template reuse requires a separate
licence review and must respect this repository's redistribution model.

## 6. Gradient and material direction

Reviewed https://grainient.supply/freebies and the SwiftGlow-05 detail page.
Shortlist **SwiftGlow, Obscura, BlueRays and Astral** for review: diffused light,
ink-blue depth, restrained grain. The detail page identifies SwiftGlow-05 as a
5K JPG; it does not establish redistribution terms in its retrieved text.

- Use gradients for onboarding, the icon's dimensional finish, and selectable
  wallpapers—not behind every message or form row.
- Default working surfaces stay warm charcoal. Recommended new accent: vivid
  ultramarine, softened in text/selection use where contrast requires it.
- Trial palette: canvas #171719; raised #202023; separator #343438;
  primary ink #F3F2EF; secondary #B5B3B0; accent #365BFF. Validate contrast in
  actual component pairs; these are design candidates, not certified tokens.
- Keep palette choice independent from structural workspace presets.
- Download/bundle a Grainient asset only if its actual licence permits app
  distribution. Otherwise create original CSS/static gradients with a similar
  light direction, clearly labelled original rather than a Grainient asset.
- Prefer compressed, locally served still backgrounds. No mandatory account,
  live gradient service, animated full-window noise or expensive shader wallpaper.

## 7. Skills and build strategy

Use the installed skill set deliberately, not as thirteen conflicting styles:
Unslop for hierarchy/identity; Apple Design and Impeccable for native behaviour
and access; Emil Design Engineering for control polish; Pick UI Library to avoid
new-system churn; Gestures for direct manipulation; Animation Performance for
frame-budget diagnosis; Animate/Animation Vocabulary for purposeful feedback;
Remove Animations to cut decorative delays; Ask Sonner for notice consistency;
Prototype for the requested font/identity review; Find Animation Opportunities
only where feedback communicates real state. Read the relevant references per
phase. Skills remain reviewed guidance, never authority to install or run scripts.

Reuse HeroUI/Base UI, Motion, Sonner, BoardUI adapters and Glisse. No new general
component library is proposed. Keep original public-source attribution.

## 8. Order of delivery and acceptance

1. Brand and font specimen: two original symbol + wordmark concepts, flat and
   app-icon treatments; actual font samples and a material/token sheet.
2. Shell: toolbar/sidebar/inspector hierarchy, Glisse/status separation, desktop
   spacing and structural presets. Compare real populated screens.
3. Chat then Settings: composer, source citations, agent activity, grouped rows,
   segmented controls, compact switches. Preserve all actions/preferences.
4. Extend the accepted component language to Library, Coding, Calendar,
   Marketplace, notifications, updates and relevant optional previews.
5. Verification and provenance report; no release or deployment in proposal scope.

Performance is a gate, not a slogan: profile the existing cold-settings 150ms p95
case before adding material work; record cold/warm p95/p99, longest tasks, pane
resize, Glisse changes and large-tree scroll in production. Target a 16.7ms
60Hz budget; do not promise 60fps from a screenshot or a headless average.
Animate transform/opacity by default, no React state per animation frame, no
full-surface animated blur, stop hidden work, and provide opaque/reduced-motion
fallbacks. Preserve large-tree windowing.

Verify keyboard-only controls, modal stacking, focus restoration, contrast,
reduced motion/transparency, 200% zoom, 390px fallback, long labels, empty/error
and populated states, and persistence. TypeScript/build/component/browser checks
are required. Distinguish browser emulation from physical/native testing.
Screenshots must use fixture data labelled as such; no fabricated live progress.

## Approval requested

Approve the **Native Studio direction and phased scope**. The next deliverable
is the two original logo concepts (each symbol plus wordmark) and rendered font
comparison, before a broad UI replacement. Existing dirty workspace changes
must be preserved and reconciled; do not overwrite or mass-stage them.
