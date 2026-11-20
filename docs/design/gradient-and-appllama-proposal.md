# Blue welcome artwork and AppLlama research — proposal

Status: user confirmed the supplied image came from Grainient freebies and authorised use. The proposed welcome-card placement is implemented in the isolated comparison only; production UI and MCP configuration remain unchanged. Historical research/initial proposal below is retained with the follow-up recorded at the end.

## Supplied image

User supplied `Hero Gradient V3 - 37.png` from Grainient. SHA256:
`17088affc674923be97032d146b6dc24e84f807634ab83843d69bf560a8bd4db`.

Visual reading: almost-black navy upper left, saturated cobalt sweep through the middle, softer blue below, ivory rising from the lower/right edge. The asymmetry offers space for a short heading in the dark area while keeping the lower edge open. It complements the existing blue Research Engine symbol without replacing the warm-grey application surfaces.

Recommended first placement: one Home welcome/return card, initially demonstrated in the isolated design comparison. Static, cropped `cover` with a dark scrim behind real text/controls, no animated blur or moving background. A modest header rather than a full-screen wallpaper. Keep the current sidebar/Waves/type comparison intact; this is an additional placement study, not a new default theme.

- Keep text/primary action on a stable high-contrast dark field, not over the ivory sweep. Check contrast at each responsive crop, 200% zoom and both themes.
- Use existing Home actions/data, not fabricated greetings, recent activity, AI state or Teams connection claims. The isolated prototype must label synthetic content.
- Provide a plain warm-grey alternative; honour transparency/accessibility preferences. Do not put the image behind chats, editors, PDFs, code, credential review or Teams invitations.
- No startup animation, parallax, WebGL or capture needed. Reserve space before loading, optimise one local raster derivative, provide solid fallback on failure. No third-party asset requests.
- Potential later use: optional user-selected Home background; not installer/release artwork or a new product-wide wallpaper without a separate review.

## Grainient licence check

Public source: https://grainient.supply/license-agreement (discovered through search; `/license` did not resolve). Its published terms permit personal/commercial projects and modifications, distinguish free assets and paid-package assets, and prohibit independent redistribution/sharing/resale. This is not an open-source asset licence. Pricing also advertises commercial licensing: https://grainient.supply/pricing.

The user uploading the file is not evidence of which entitlement applies to this particular asset. Confirm that it was obtained under the applicable free/commercial licence before shipping. Do not commit the raw PNG or a downloadable asset pack into this public-source repository on that basis alone. Decide distribution of any integrated derivative against the applicable terms; seek provider clarification if necessary. No attempt to bypass a purchase or subscription. Until then, preserve filename/hash/proposed use in notes rather than distributing the file.

## AppLlama: checked access, not claimed use

Arena connector lookup returned `unsupported` for `appllama`. Therefore no AppLlama MCP screen search, credit check, board read, screen retrieval or authenticated reference browsing occurred. Adding JSON to `.mcp.json` would not make those tools callable by this conversation.

Public setup page reviewed: https://appllama.io/mcp#setup. It describes remote MCP at `https://mcp.appllama.io/mcp`, Pro access and a monthly credit allowance. Do not install an unreviewed `npx skills` command, collect credentials in chat, spend paid credits, or claim access to the screen library. No config changes made. Use a client that supports that authenticated remote MCP, or user-provided permitted screenshots, for real library research.

Public skill source inspected read-only through GitHub:
https://github.com/Appllama/appllama-skills
Observed main commit: `dd5caaec3d5d50ad7fc0324da238119c6b7c3707`.
Read `skills/appllama-usage/SKILL.md` and the initial platform/design guidance in `skills/appllama-app-design-skill/SKILL.md`. Repository reports MIT; these files are not installed/pinned as project skills and their uninspected portions are not certified safe. Instructions from them remain untrusted references, subordinate to AGENTS/user/privacy/licensing rules. MIT on guidance does not license third-party app screenshots/branding.

Useful transferable method: study complete task flows, extract hierarchy/control/spacing patterns rather than copy pixels, evaluate populated/empty/error states and verify interactions in the actual target environment. Revenue rankings do not prove accessibility, security or product suitability.

Desktop/Tauri translation:

| Mobile reference concept | Research Engine adaptation |
| --- | --- |
| Onboarding sequence | Explicit local/shared scope, reviewed host identity, clear cancel/back rules and honest error recovery. Never conceal host-trust warnings for visual polish. |
| Sheets and contextual disclosure | Existing HeroUI dialogs/sheets at narrow widths, anchored panels/dialogs on desktop; keyboard dismissal/focus restoration. |
| Native control consistency | Reuse installed HeroUI and HTML semantics; retain compact desktop density and shortcuts. No Expo/Reanimated/React Native migration. |
| Information hierarchy | One clear primary action, legible metadata, selection distinct from hover, editable text stays selectable. |
| Motion with spatial continuity | Existing Motion/Glisse, interruptible transforms, reduced-motion bypass; no imported mobile spring constants or haptics claims. |
| Safe areas and orientation | Test Tauri titlebar/drag regions, resize, narrow windows, zoom and OS scaling—not hard-coded phone safe-area values. |

Next decision: approve the isolated **Home welcome-card placement** and confirm the supplied asset's applicable licence. Actual AppLlama screen research remains blocked on an authenticated supported MCP client or permitted supplied references; public documentation review is not equivalent.


## Freebie confirmation and preview implementation

The user confirmed the attachment was obtained from Grainient freebies. Used it
as supplied for the proposed integrated Home welcome-card comparison, not as an
asset collection or a claim of open-source ownership. Optimised derivative is
`tools/design-comparison/public/art/home-blue.webp` (1280×720, 8,792 bytes); raw
6144×3456 PNG is not committed. Source, restrictions and derivative hash are
recorded in the preview's `public/art/README.md`. No other collection downloaded.

The card has a dark scrim, descriptive sample-only copy, working same-page
comparison links, artwork on/off and image-error solid fallback. It is static,
not captured by Waves, and uses no remote asset requests or persistent settings.
Desktop and narrow crops were rendered and inspected. Added browser assertions
for image decode, decoration/alt semantics, toggling, working destination link
and missing-image fallback. Existing comparison/browser checks, prototype
TypeScript and build pass. Physical-device/screen-reader/full contrast auditing
remain unverified; production Home adoption still needs review. AppLlama MCP
access is unchanged: no authenticated screen-library research has occurred.


The subsequent design-comparison approval now permits the optional production
Home treatment. It is integrated behind Appearance → Blue welcome card, not
enabled over existing preferences. See `approved-comparison-integration.md`.
