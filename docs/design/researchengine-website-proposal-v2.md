# Research Engine website — art-directed AI workspace proposal

**Status:** proposal for review only. No website code, screenshots, artwork, or deployment has been changed by this proposal.

## Recommendation

Make the public site feel like an independent research publication made by people who use AI every day: warm, editorial, specific, and unmistakably about an AI workspace. Put **real Research Engine screens on rights-cleared oil-painting canvases**. Let the artwork add human presence; let the product UI, source trail, and model choices explain what the AI actually does.

Working headline: **“Research with AI. Keep the work yours.”**

The visual contrast is intentional: a quiet paper-and-ink page; a compact plum accent carried forward from the current identity; expressive, earthy paint; and crisp, dark app windows. The paintings are staging behind the screenshots, never texture laid over readable app controls or body copy.

This is a new direction for review, not authorization to start implementation. It is a refresh of the existing static marketing page, not a change to the Research Engine app.

## Current website and useful findings

The site is a static React/Vite/Tailwind page in `website/`, with release data prepared at build time and existing download, accessibility, metadata, and link checks. Its story is currently spread over many sections. UIArc is already present in two places (`InViewTitle` and `MetricCard`), with its source/version recorded in `website/scripts/site-sources.json`.

The current hero uses a purple cloud shader, and the four `/public/shots/shot-*.webp` files are finished promotional compositions with purple/neon backgrounds—not clean captures that can simply be placed on a new painting. Their visible subjects also appear to differ from the labels in `website/src/data/screens.ts`: in a visual pass, `shot-2` looks like coding, `shot-3` like a quiz, and `shot-4` like a workflow, while the data currently describes study, writing, and coding for those slots. Treat that as an apparent mismatch to verify against the running app before reusing any image or caption. Do not remove the baked backgrounds or invent a UI to fit them; capture the real current screens again.

The copy already has strong, concrete AI material: answers with numbered sources, user-selected and local model providers, document-to-study flows, coding, workflows, and a local library. Keep those product truths. Reorder and condense them rather than replacing them with generic “AI productivity” promises.

## Art direction: a working notebook, not an AI template

### Page and palette

- Move the marketing surface from near-black/purple to warm paper, charcoal ink, and quiet borders. Retain the existing violet/plum as the recognizable AI/action accent, but use it sparingly rather than as a full-page glow.
- Let each painting provide its own small supporting colors—earth red, ochre, blue, or green—without turning every section into a different palette.
- Use editorial scale selectively: a confident display headline and a few short, human section titles; readable sans-serif body copy; compact monospaced labels only for real source/model metadata. Existing Geist faces can remain the baseline. A serif display face is an optional comparison, not a requirement.
- Use tactile details that feel authored—small figure captions, dates/source labels, deliberate whitespace, and a visible line between question, evidence, and answer. Avoid repeated cards, pill rows, floating orbs, generic sparkles, and synthetic “AI network” decoration.

### Oil paintings behind the product

Use a small, consistent set of real oil paintings with clear reuse rights: public-domain/rights-cleared works, or original human-made art if the user later approves that route. Check both the artwork and the digital scan’s rights; credit the artist/work where required. Do not take images from Raylers or SiteInspire, and do not buy a commission or stock licence without separate approval.

The hero gets one broad, cropped painting as a canvas. A real application screenshot sits above it in a restrained, nearly front-on app frame with a soft shadow and enough opaque surface to keep the interface legible. The painting should remain visible around the screenshot, not through the controls. Later feature screenshots can use a second crop or a second painting, but the page should feel like one curated series rather than four unrelated mockups. No continuous parallax or animated paint.

This meets the requested oil-painting treatment while keeping the product the focal point. A literal AI brain, robot, circuit board, neon tunnel, or made-up interface would work against the human-made direction.

## Proposed page and sample first-screen copy

### Header

Simple branded header with **Product**, **How it works**, **Privacy**, **FAQ**, and one **Download** action. Keep GitHub available but secondary; never display an unverified star count or imply that a private repository is public.

### Hero

**Eyebrow:** A desktop AI research workspace

**Headline:** Research with AI. Keep the work yours.

**Body:** Ask across your files and trusted sources, follow numbered citations, then turn what you learn into a study set, an article, a workflow, or code. Choose from hosted providers or local models.

**Actions:** Download Research Engine · See how it works

**Proof line:** Free and open source · MIT · Windows and Linux

The text column stays clean and high-contrast. The other column is a large, real screen—preferably a research answer with its citations visible—staged over the painting. Use a small caption such as **Question → sources → answer** to explain what the image demonstrates. Build the image from the actual app; do not paint copy into it.

### Story, in a shorter scroll

1. **Ask a question; follow the evidence.** Show the real prompt, answer, and numbered source panel. Preserve the useful explanation of what is searched, what a reply includes, and what happens when a source fails.
2. **One workspace, several kinds of AI work.** A compact tabbed feature story for **Research**, **Study**, **Build**, and **Workflows**, with a real, correctly captioned screen and a short factual description for each. This keeps the AI focus explicit without a wall of identical cards.
3. **Your AI, your choice.** Explain supported provider choice and local-model options in plain language. Make clear where a prompt goes when a hosted provider is selected; do not imply every request remains on-device.
4. **Keep the working.** Explain the actual location/ownership of saved work, folders, exports, and source code. Preserve the strongest verified privacy and open-source details, with no absolute security claims.
5. **Questions, then the download.** Keep the current FAQ and release-driven downloads, checksums, supported platforms, and repository links. Use real testimonials only where permission and provenance are established. Do not invent a newsletter, live status, usage counts, or roadmap features.

The current “site health” measurements are useful to the maintainers and existing test suite, but they are not a visitor’s reason to install the app. Keep them in developer checks rather than making them a main marketing section. Condense repeated feature, tour, and comparison material; retain the detailed product facts where people can still find them.

## UIArc component plan

Use UIArc as a source library, not a stock visual theme. Its pages describe copy-into-your-project React components and blocks; the library documents **121 free components and 22 free blocks/screens under MIT**, with separate Pro items. The first implementation should use only free/MIT items—no Arc Pro purchase—and record upstream source/digest and any local changes in the website’s existing vendor manifest.

| UIArc item | Proposed use | Guardrail |
|---|---|---|
| `SiteHeader` — `simple` | Responsive marketing navigation and the one download action | Replace all sample brand/content; keep link semantics, mobile-sheet focus return, and reduced-motion behavior. |
| `Tabs` | Research / Study / Build / Workflows feature story | Keep the panels to a few real views. Check narrow overflow and keyboard navigation; reduce panel travel for reduced motion. |
| `FaqSection` — `accordion` | Existing product questions | Supply stable IDs and verified plain-text answers; no sample contact form or made-up service promise. |
| `SiteFooter` — `minimal` | Closing product/source/download links | No newsletter or status widget without a real endpoint and verified status. |
| Existing `InViewTitle` and `MetricCard` | Keep selectively if they still serve the revised story | Do not keep a component only to advertise its source; avoid turning the page into a metrics dashboard. |

UIArc’s `HeroSection` is a candidate, not a drop-in: its documented variants are full-viewport and include a mesh or simulated example workflow/dashboard. If used, pass Research Engine’s own title and screenshot media, remove the stock scenario/mesh, and confirm that it can be made editorial and naturally sized. Otherwise keep a small custom hero and use the UIArc components above. Do not add the Pro AI-chat block or any sample preview data to the real product story.

Keep the existing Vite/React setup and static hosting. Check source dependencies and bundle impact before adding a block; prefer copied, pinned source over a runtime dependency on the UIArc site or registry. Preserve the source manifest/verification approach and MIT notices.

## Screenshot and artwork production

1. Prepare a small demo workspace with fictional, non-sensitive research, documents, and project names. Never capture real user material, credentials, private repositories, or personal data.
2. Capture the current desktop application at consistent, readable sizes, with no baked-in slogan or background. Confirm every screen against the running app and update alt text, captions, and the feature it supports together.
3. Select paintings only after rights review. Compose the screenshot above the canvas; test contrast at full and mobile sizes. Export responsive, optimized local images—no hotlinked art or remote image dependency.
4. Screenshot Studio is optional for framing/cropping. Its editor page says imported images are not uploaded for editing, while export compression sends the finished image to its server and returns it without storage. If used, use only the synthetic demo captures, check the current export behavior, and prefer a local export/composition path where practical. The site must not depend on Screenshot Studio at runtime.

## Interaction, accessibility, and performance

- Make the painting a decorative background (`aria-hidden`/empty alt); give each product screenshot concise, accurate alt text and a visible caption. Keep text outside the image.
- One `h1`, semantic sections/nav/footer, visible keyboard focus, useful anchor destinations, a mobile menu with focus return, and fully keyboard-operable tabs/FAQ. Check contrast over both paper and painted regions.
- Honor `prefers-reduced-motion`; no auto-playing loops, scroll-jacking, or motion needed to understand product behavior. A screenshot should not move while someone is reading it.
- Design for narrow phones and 200% zoom: screenshot follows the headline instead of colliding with it, tabs can be reached without page-wide overflow, and no section spills outside the viewport.
- Preserve the static build and release pipeline. Use local responsive images with explicit dimensions; eager-load only the hero image, lazy-load the rest, and avoid a new WebGL shader or large animation dependency. Measure the built page before and after rather than claiming a speed improvement in advance.
- Maintain accurate meta/OG data, release/version facts, image rights/credits, and direct links. Do not silently alter the app’s download, release, or privacy behavior.

## Review gates before implementation

1. Review this direction and the sample hero copy. Decide whether the warm editorial palette and rights-cleared oil-painting treatment are the right fit.
2. Confirm an artwork sourcing route (public-domain/rights-cleared originals first; no unapproved commission) and approve the screenshot set. First resolve the apparent screenshot/caption mismatch in `website/src/data/screens.ts` against the running app.
3. Only then make a non-deployed website prototype using the approved free UIArc components and real app captures. Compare desktop, mobile, reduced motion, keyboard use, and 200% zoom before migrating the rest of the page.
4. Acceptance: the AI capability is obvious in the first viewport; every product image and claim matches the release; the painting frames rather than obscures the app; UIArc provenance/licensing is recorded; no horizontal overflow or keyboard traps; static build, site tests, vendor verification, and link checks pass. No deployment is implied by these gates.

## Reference notes

These references inform principles, not reusable assets or templates.

- [Raylers](https://raylers.com/) — the portfolio combines product-interface concepts and identity work. The [Okara AI concept](https://raylers.com/post/1989383838737563995) is relevant for treating an AI product as a distinct, authored brand rather than a generic chatbot. Borrow the product-specific art direction and coherent presentation of a concept series, not its images, marks, or compositions.
- [Microsoft AI on SiteInspire](https://www.siteinspire.com/website/13340-microsoft-ai) — a technology/identity reference; SiteInspire records Red Hat Mono for headlines. The live site’s watercolor-style model illustrations show one way to give AI features a more human visual voice. Adapt the clarity and authored tone, not Microsoft’s branding or art.
- [Brand.ai on SiteInspire](https://www.siteinspire.com/website/12994-brandai) — identity-led AI art direction, useful as a reminder that the brand can carry the AI story without filling every section with generic effects.
- [Conversation Design on SiteInspire](https://www.siteinspire.com/website/13425-conversation-design) — big type, color, and illustration in an educational-technology context. Use as evidence that technical subjects can feel approachable; do not copy its layout or artwork.
- [UIArc introduction](https://uiarc.dev/docs/introduction) and pages for [SiteHeader](https://uiarc.dev/components/blocks/site-header), [Tabs](https://uiarc.dev/components/tabs), [FAQ section](https://uiarc.dev/components/blocks/faq-section), [SiteFooter](https://uiarc.dev/components/blocks/site-footer), and [Hero section](https://uiarc.dev/components/blocks/hero-section). UIArc says free source is MIT-licensed; check and preserve the item’s licence/provenance when copying it.
- [Screenshot Studio editor](https://www.screenshot-studio.com/editor) — optional browser-based composition tool; its privacy/export behavior is summarized above.

**Research limit:** the references were reviewed through their public pages and available page content; this is not a frame-by-frame usability study, and it makes no claim that our implementation has been compared against them in a browser. No reference art or paid material was used.
