# The Research Engine website

The public website: what the app does, why it is free, and the download. It is a
static single page built with Vite, React and Tailwind 4, and it deploys to
Vercel or Netlify with no functions, no server and no secrets.

```bash
cd website
npm ci
npm run dev          # http://localhost:5188
npm run build        # → dist/, ready for any static host
npm run site-test    # 147 checks, mounted in jsdom
npm run vendor       # re-verify the vendored components against their digests
```

From the repository root the same commands are `npm run site:dev`,
`npm run site:build`, `npm run site:test` and `npm run site:vendor`.

## What it is built from

Every component comes from one of the three registries this round names, and
`scripts/site-sources.json` records where each file came from, the digest of the
bytes it was vendored from, the digest of the file as it sits here, and any local
edit with the reason it exists. `node scripts/site-vendor.mjs --verify` re-checks
all of it offline, and re-fetches the upstream copy when the network allows.

| Component | Registry | Where it is used |
|---|---|---|
| `basic-accordion` | SmoothUI | the FAQ |
| `depth-parallax-words` | SmoothUI | the hero headline |
| `folder-reveal` | SmoothUI | the library section, for the file types it takes |
| `inline-testimonials` | SmoothUI | the three early-user quotes, opened from their names |
| `mac-terminal` | SmoothUI | the backend section, typing real output |
| `github-stars-animation` | SmoothUI | the stars band, from GitHub's own API |
| `animated-stepper` | SmoothUI | "how it works", four clickable steps |
| `cloud-shader` | Aceternity UI | the hero background |
| `tooltip-card` | Aceternity UI | the glossary, and two terms inside the feature cards |
| `images-badge` | Aceternity UI | the three attachments on a question |
| `container-scroll-animation` | Aceternity UI | the "look inside" reveal, on the repository's own hero image |
| `carousel` | Aceternity UI | the screenshot gallery: every picture of the app, opened full size |
| `features-section-demo-3` | Aceternity UI | the four-cell bento at the top of "what it does" |
| `typewriter-effect` | Aceternity UI | the answer streaming back in "ask it something" |
| `card-21` (vendored as `card-18`) | shadcnspace | the comparison card, plus the `card` primitive it needs |

`card-21` is served only by shadcnspace.com, which this build environment cannot
reach, and its source is not in the project's public repo; `card-18` is published
there in the same folder with the same layout, so that is what is vendored, with
the difference written down rather than hidden. Lenis supplies the smooth
scrolling, and stops being started at all when the visitor has asked their system
for less motion.

The screenshots are this repository's own, optimised from the originals by
`.github/workflows/site-assets.yml` (a maintainer-run job: it downloads the
images, converts them to 1600 px WebP, and pushes them to a scratch branch, which
is then fetched here). The site never hotlinks an image host.

## The three things a visitor can do without scrolling past them

**Ask it something** (`src/components/site/AskStream.tsx`). A question types itself
into the app's own composer, the app reads, and the answer streams back word by
word with the sources it used underneath. It loops through three real exchanges.
The answer is drawn by Aceternity's typewriter; the same words are also in an
`sr-only` block, so the section reads correctly to a screen reader and to the test
suite whether or not the animation has played. A visitor who prefers reduced
motion gets the first exchange in full and no timers at all.

**The folder of screenshots** (`ScreenshotGallery.tsx`). The folder in the library
section, and two buttons elsewhere, open every screenshot of the app in one
dialog, in two modes:

- **all four at once** (what it opens on): every picture uncropped with its
  caption, so the whole product is visible without clicking, and so it works on a
  phone, where a one-at-a-time carousel hides three quarters of what you came to
  look at;
- **one at a time**: Aceternity's embla carousel, opened on whichever picture was
  clicked, with arrow keys, arrows and a thumbnail strip.

It is a real dialog: Escape closes it, Tab wraps inside it, focus goes back to the
button that opened it, and the page behind it stops scrolling (Lenis included).

**The terminal** (`src/components/site/Backend.tsx`). The backend proof, sized to
be read in one screen and told to loop, so it plays again when it reaches the end
instead of leaving a stranded prompt.

Around the animation, the ask section carries the things a screenshot cannot: the
three questions as buttons that play that exchange, the three lanes a search runs
through with what each one costs in time, what comes back with a reply, and what a
failed lane looks like.

## Honesty rules the page follows

Two of these were reported by looking at the site, and both were right:

- **the star count is never asserted, only read.** The repository is private while
  the app is in beta, so GitHub reports nothing for it. The band says that, in
  those words, and the number appears by itself the day the repository is public.
  There is no "new on GitHub" and no "be the first to star it": the page cannot
  verify either claim. The nav pill shows a gold star only beside a real number.
- **every link works.** The footer's in-page links scroll to sections that exist,
  and every `github.com/.../blob/main/<path>` link points at a file this checkout
  actually has — `scripts/site-test.mts` opens each one and checks. The missing
  `CONTRIBUTING.md` link that used to 404 is gone.
- **the primary action is never a page a stranger cannot open.** The footer's main
  button downloads the app; GitHub is offered beside it, labelled as private
  during the beta.

A press on any button lands on a state the site defines (`active:` on every
variant) with the browser's own tap highlight turned off, because a flash of the
user agent's near-white `buttonface` on a dark page reads as the control turning
white.

## How it is laid out, and why the hero changed

The first version of this page read as generated, and the fixes are structural
rather than cosmetic:

- the hero opens with a line of small type, not a row of pills; a pill above a
  large headline is the shape every generated landing page has, and at heading
  sizes it also ends up sitting on the heading;
- there is one accent, used on one phrase. The violet halo behind the screenshot
  and the second gradient are gone, and the screenshot sits on a plinth with the
  same window chrome the app draws;
- section eyebrows are letterspaced type, in `src/components/site/Section.tsx`,
  and every text entrance fades opacity only. Sliding text, mid-scroll, on a page
  that uses backdrop blur, is what could paint a headline twice;
- the features are one bento of four cells plus a plain list. Fourteen identical
  cards in a grid is what the round called out, so the list is prose with a filter
  and no boxes;
- the "look inside" reveal is sized by this page: Aceternity's demo is 120vh tall
  with taller content centred in it, so its card's projected bottom edge landed on
  the next section. `.reveal-scroll > div` in `src/styles/globals.css` sets a real
  height and real padding, and the section clips itself.

The references were Dribbble's dark SaaS heroes (type first, one product shot, no
decoration pretending to be content) and the Awwwards habit of letting a single
line of type carry the screen.

## How the download works

`scripts/prepare-assets.mjs` runs before Vite and reads the repository it lives
in: the version from the root `package.json`, the portable archives from
`downloads/`, their digests from `downloads/SHA256SUMS`, and the installer
digests from `downloads/INSTALLERS.sha256`. It copies the archives into
`public/downloads/` and writes `public/release.json`, so the published site is
self-contained:

- the installers link to the GitHub release for the exact tag this repository is
  on (`/releases/download/v<version>/…`);
- the portable builds are served by the site itself, with their digests on the
  page, so getting the app does not depend on GitHub;
- if a release has no installer digests yet, the page says so instead of
  inventing a number.

## Deploying to Vercel

Import the repository in Vercel and accept the detected settings. The root
`vercel.json` does the work: it installs only the site's own dependencies
(`cd website && npm ci`, not the whole workspace), builds with
`npm run build`, serves `website/dist`, rewrites unknown paths to `index.html`,
and sets the same cache and security headers as the Netlify file. Hashed assets
are cached for a year; `release.json` is revalidated on every visit. There is
nothing to configure by hand and no environment variable.

Vercel also needs a new deployment after a release is published, because the
page reads its version at build time. A push to the branch, or a redeploy from
the dashboard, does that.

## Deploying to Netlify

Connect the repository and accept the defaults. The root `netlify.toml` sets the
base directory to `website`, the command to `npm ci && npm run build`, the publish
directory to `dist`, the SPA fallback, the cache headers for hashed assets and
images, and `NODE_VERSION=22`. There is nothing to configure by hand, no build
hook, and no environment variable.

The one thing Netlify does not do is rebuild itself when a new release is
published: the page reads its version at build time. Re-deploying the site after a
tag is a push of any commit, or the "Trigger deploy" button.
