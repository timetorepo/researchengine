# Selective Waves, animated navigation, and editorial type — proposal only

Status: awaiting design approval. No runtime Waves/font installation, new styling, or sidebar changes accompany this document. Client transport work is a separate approved milestone.

## Recommendation

Give Research Engine a quieter, more deliberate shell: warm dark-grey surfaces, compact readable controls, restrained material, and an interruptible opening **and closing** sidebar. Reserve Waves for a few explicitly requested, completed actions on non-sensitive shell surfaces. Do not turn the editor or work stream into a transition demo.

Keep current HeroUI, Motion and opt-in Glisse. Preserve density, theme/layout independence, keyboard controls, and adjustable glass/refraction. Keep active chat, Codersa, code and reading surfaces stable. No new component system.

## Reference study and limits

The public pages/documentation and package source were reviewed. Reference videos were **not played**, and reference layouts were not verified in an interactive browser; this is not a claim of frame-by-frame visual matching or measured reference timings. No paid/gated material was accessed. The next approved step includes a rendered comparison, rather than treating text extraction as sufficient visual research.

- [Waves](https://libraries.dev/waves): an outgoing DOM snapshot bends into an incoming view, with a live overlay for controls. The effect can originate at an action source; vertical, horizontal and center modes support different relationships. This is a whole-view transition, not a substitute for real asynchronous state. The strongest application is a bounded state change whose before/after are already available.
- [Glid](https://glid.cash/): borrow clear ownership language, named contexts, plain-language review and backup cues. Its site describes a UI-only/sample-data TestFlight; do not infer production security or reuse wallet claims for Teams. Translate this into clear local-versus-shared labels and explicit join review, not financial visual metaphors.
- [MOUTHWASH / Maximum](https://mouthwash.studio/project/maximum/): this is the requested client case study, not just the agency homepage. Its published direction combines a geometric identity, scale, a restrained currency-inspired palette and a confident, human voice. Translate the discipline into strong section titles, aligned metadata and one purposeful accent. Do not copy the mark, banknote assets, compositions or typography wholesale. Large editorial scale belongs in Home/empty onboarding context, not dense chat/tool rows.
- [60fps](https://60fps.design/) and its [Plasma sheet example](https://60fps.design/shots/plasma-duo-style-bottom-sheet-open-interaction): contextual continuity from trigger to sheet is useful. Keep the initiating control visually related to the destination; background attenuation clarifies hierarchy. Do not assume the gallery's frame-rate label is a benchmark of this app or copy its spring constants without observation.
- [Coolest](https://coolest.design/) and [Second identity](https://coolest.design/design/second-brand-identity): editorial hierarchy, warm visual identity and authored reading space are useful counterweights to an overly glassy shell. It is a curator of third-party work, not an asset licence. No artwork is proposed for reuse.
- [TypeDump](https://www.typedump.com/): useful discovery catalogue, but licences must be checked upstream per family. “Free for commercial use” does **not** mean open source.

## Where Waves should and should not appear

| Action | Proposal | Truthful trigger / alternative |
|---|---|---|
| Explicit theme/material preview | Best first isolated trial: non-sensitive sample swatch only | User presses Preview; no real content capture. Commit theme separately and immediately. |
| Switching a Home layout preset | Optional later trial on a static non-sensitive shell preview | Apply is real; a canceled effect never reverts settings. Never distort an active editor. |
| Board snapshot review → accepted shared revision | Conditional, later: generic receipt card only | Only after durable host acknowledgement; never infer success from animation completion. Capture neither Board contents nor attachments. |
| Update download → ready | Optional generic status card after actual verification | Preserve measured progress, the large round update action and existing completion instruction. No animated fake download. |
| Sidebar open/close | **Use existing Motion, not Waves** | Cheap interruptible transform/opacity, focus and layout remain predictable. |
| Team join, session/credential import, invite creation, recovery | **Exclude** | Credential safety, trust text, errors and keyboard review take priority. Ordinary immediate state feedback. |
| Typing, streaming, scrolling, searches, send-per-message, Board drag/drop | **Exclude** | No repeated capture, input delay, flicker, layout instability or GPU work in the core loop. |
| Private chats, code, PDFs, BackChat, passwords, API keys | **Exclude snapshots entirely** | Text and native controls remain live and selectable. |

Start with the sample swatch only, not all conditional candidates. This does not authorise adding a UI to incomplete features merely to demonstrate an effect.

## Waves technical/source audit

Reviewed npm `distortion-waves@0.1.0`, MIT, React/react-dom >=18 peers, no declared runtime dependencies. Package unpacked size: **204,772 bytes**; this is not compressed transfer cost or incremental app bundle size. Upstream observed main SHA `14ae9d2dad18fcee251f4b06333b492a2a41d2ed` is reference provenance, not proof that npm and main are identical. Tarball integrity:

`sha512-Y+UgvTq+KtvPOp26piB940ikKKWIf3MOMA8PoaFrSwOskbCDjNSwWW8vo0x6UvB2a9IjNGLBgu+f9+ORm0/sYg==`

Read-only package audit; downloaded into ignored cache, not installed. MIT licence included in tarball; any future distribution must retain its notice. Pro-labelled playground assets/features are not automatically covered by the package licence.

Source observations:

- Uses WebGL2 and captures DOM through SVG `foreignObject`/raster images. Fonts/styles/images may require same-origin or CORS access. Video/canvas frames can be captured; iframe contents are not a dependable supported target. Never wrap the application root.
- Source includes asset `fetch` calls with abort timers and module-level asset caches. No claim of a complete security audit: snapshot strings, decoded images and GPU textures can retain content. A private-data scrubber is **not** equivalent to proving a snapshot boundary safe. Restrict to synthetic, self-contained, public shell content; no remote URLs. Verify request interception and cache disposal before approval to ship.
- Default prewarming can capture before the user clicks. Future wrapper should set `prewarm={false}`, `live` off, then explicitly prepare the safe preview only. Do not use `live="animations"` as a default.
- Both DOM views are mounted in an overlapping grid and the larger can determine size. A wrapper needs a stable bounded box; no duplicate IDs/forms or duplicate effectful children. Overlay is for live controls. Hidden views use inert/aria-hidden in source, but actual focus restoration, announcements and assistive-technology behaviour still require tests.
- Reduced-motion/no-WebGL paths exist; upstream crossfade is not the same as a product “motion off” promise. Product wrapper must bypass rendering/capture altogether for motion off/reduced motion. Also bypass for hidden documents, unsupported WebGL/CSP, context loss and failed capture. State commits must not depend on `onFinish`.
- Candidate implementation: lazy-load on an eligible opt-in preview; one active bounded effect, no background loop, resolution capped at 1 initially, no prewarm on startup. Interruptions should settle to the latest real state without replaying queued effects. Do not weaken CSP or certificate/CORS policy to make capture work.

## Sidebar opening AND closing

Desktop: retain existing compact/expanded geometry and persistence. Animate the navigation surface and labels with a short transform/opacity transition; do not animate width or backdrop blur every frame. Commit the content layout once per state change rather than reflowing the editor every animation frame. If that creates a visible content jump, compare a single-layout FLIP treatment in an isolated prototype before adopting it. Never scale text during the transition.

Proposed starting values, **not measurements**: opening 180–220 ms ease-out; closing 140–180 ms; label fade 80–120 ms with no list-item cascade. Toggle again mid-flight reverses from current progress; don't queue opens/closes or delay interaction. Motion off/reduced motion resolves immediately. No elastic bounce by default.

Narrow windows: overlay drawer with a stable opaque/translucent scrim (according to transparency preference), focus trap only in modal mode, Escape and outside dismissal, scroll locking and focus restoration to the toggle. Desktop sidebar must not trap focus. Toggle exposes accessible name, `aria-expanded` and `aria-controls`; closing removes hidden descendants from the tab order immediately. No hover-only open behaviour. Keep selected location and scroll position, independent of opening animation.

## Typography shortlist — compare before choosing

| Family | Intended trial | Licence evidence / caveat |
|---|---|---|
| Current installed UI family | Baseline/default | Preserve until a rendered readability comparison wins. |
| Geist Rounded | Optional shell labels and friendly Home headings | [Upstream OFL 1.1](https://mishanaer.com/ui/geist-rounded/downloads/OFL.txt) reviewed; do not apply roundness to code or all body copy. Verify binary/version and include notice before bundling. |
| Newsreader | Optional editorial Home/long-form heading accent | [Upstream OFL](https://github.com/productiontype/Newsreader/blob/master/OFL.txt) verified; variable weight/optical size. Not a replacement for small metadata or code. |
| Lilex | Optional code font, never change ligatures silently | [Upstream OFL](https://github.com/mishamyrt/Lilex/blob/master/OFL.txt) verified. Retain monospace fallback, expose ligature preference and test punctuation alignment. |
| General Sans / Satoshi | Not in open-source shortlist | Fontshare labels these closed-source; free commercial use is a different licence. No download/bundle without separate licence review. |

TypeDump discovery pages: [Geist Rounded](https://www.typedump.com/font/geist-rounded), [Newsreader](https://www.typedump.com/font/newsreader), [Lilex](https://www.typedump.com/font/lilex), [General Sans](https://www.typedump.com/font/general-sans). [Fontshare](https://www.fontshare.com/) upstream labels override broad catalogue descriptions.

Self-host only after exact font-binary/hash/licence pinning. Do not introduce remote font requests. Compare Latin, Indonesian copy, numbers, punctuation, code, long filenames and fallback scripts at current compact sizes, 100/200% zoom, light/dark and opaque/glass modes. Check perceived weight and layout shift; don't make the app wider merely to suit a new font. Prefer at most one optional new UI family plus an editorial accent, not an uncontrolled font menu.

## Approval and acceptance gates

1. Approve the direction and shortlist, then inspect public reference motion/rendering and produce a local non-production comparison: sidebar opening/closing, one synthetic Waves swatch, current type versus shortlisted fonts. No full-app redesign implied.
2. Review populated, empty, error, narrow-window, zoom and rapid-toggle recordings. Keyboard and screen-reader testing; reduced motion/transparency; foreground/background; WebGL disabled/context loss; slow or failed asset loading. State feedback must survive every disabled effect.
3. Measure baseline versus candidate compressed chunks, startup work, interaction latency, frame times and retained memory after repeated mounts/transitions. Target no startup Waves work and no core-input regression. A 60 Hz frame has ~16.7 ms, 120 Hz ~8.3 ms; these are budgets, not results. Test representative lower-powered physical hardware before claiming performance.
4. Only after approval implement the chosen design, optional settings and attribution. No automatic deployment/release; release notes belong to release preparation.

Open decision: approve a **sidebar + synthetic Waves preview + typography comparison** first? Conditional action effects remain deferred until their underlying features are real and their safe snapshot boundary passes review.

## Approved comparison checkpoint

User approved the first isolated comparison step. Implemented under
`tools/design-comparison` with its own pinned supplemental dependencies and
preview, not in production routes/settings. Includes sidebar opening/closing,
synthetic opt-in actual Waves, and self-hosted Inter/Geist Rounded/Newsreader/Lilex
comparison. App defaults and existing UI remain unchanged. See its README for
source/licence hashes, reproduction, measured bundle sizes, executed browser
checks and outstanding accessibility/performance/reference-video validation.
This is not approval to roll these choices across the application.
