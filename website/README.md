# The Research Engine website

The public website: what the app does, why it is free, and the download. It is a
static single page built with Vite, React and Tailwind 4, and it deploys to
Netlify with no functions, no server and no secrets.

```bash
cd website
npm ci
npm run dev          # http://localhost:5188
npm run build        # → dist/, ready for any static host
npm run site-test    # 73 checks, mounted in jsdom
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

## Deploying to Netlify

Connect the repository and accept the defaults. The root `netlify.toml` sets the
base directory to `website`, the command to `npm ci && npm run build`, the publish
directory to `dist`, the SPA fallback, the cache headers for hashed assets and
images, and `NODE_VERSION=22`. There is nothing to configure by hand, no build
hook, and no environment variable.

The one thing Netlify does not do is rebuild itself when a new release is
published: the page reads its version at build time. Re-deploying the site after a
tag is a push of any commit, or the "Trigger deploy" button.
