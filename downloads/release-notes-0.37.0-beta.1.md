# Research Engine 0.37.0-beta.1

**The library search actually fixed, a design mode you can work in, and an agent that asks before it touches your machine.**

This round started from an error message and a list of thirteen things. The error
was real, and the route was never the problem.

## The search was not broken, the answer was unreadable

`/api/library/search?q=javascript&refresh=1` answered 200 with real JSON every
time it ran — on a live server, the response names each lane with its state, its
count and its time. The report came from a build whose server did not have the
route: that request fell through to the single-page-app fallback and came back as
`index.html` with a 200, and the client turned that into *"something that was not
JSON"* — true, and useless.

Two guards, at both ends:

- **Every path under `/api` answers JSON now**, including a 404 for an unknown
  route and a 405-style answer for a wrong method. The app shell is still served
  for page paths, so deep links keep working. A regression test starts a real
  server in a temporary directory and proves all eleven cases, from the unknown
  route to the page path.
- **The client describes what it actually received** when a response is not JSON:
  the status, the content type, whether it looks like the app shell, and the first
  bytes of the body. A failure now says which of those happened instead of naming
  the symptom.

## Design mode is a workbench

- **Design Brief** asks the questions that settle what "premium" means — style,
  density, motion, theme, type, accent, references, must-haves, avoid-list — one
  at a time, before any UI code exists, and turns the answers into a style
  contract.
- **Design Board** turns those answers into two or three directions, each with a
  type pairing, a palette of real tokens, a motion rule and the components it
  would use, and copies the brief with the chosen direction attached.
- **Inspiration** searches Awwwards, Dribbble, unicorn.studio and Refero for the
  screen being built — not for "inspiration" — and keeps the references on the
  board.
- **Prototype** runs the live preview in a phone, a tablet, a laptop and a TV at
  once, with one reload for all four and a checklist of the things that silently
  do not fire: hover, press, focus, entrances, exits, the reduced-motion path,
  scroll-linked motion, text that overflows.
- **Ship** writes the host's config files into the project for Vercel, Netlify,
  Cloudflare Pages, Render or GitHub Pages, and says plainly that the deploy is
  the user's to press.
- **Design grids over the live preview**: columns, baseline rhythm, an 8 pt grid
  and safe areas, drawn over the frame so measuring the page can never change it.
- **Devices** from a 320×568 phone to a 1920×1080 TV and 4K.

## Thirty component providers that install

Fourteen namespaced shadcn registries (shadcn, shadcnspace, Bklit, Skiper UI,
ReactBits, Magic UI, Tailark, soundcn, Intent UI, uiable, ns-ui, lucide-animated,
Atomloader, ProseKit), Aceternity and SmoothUI by URL, nine real packages
(HeroUI, Mantine, Chakra, MUI, Ant Design, Radix, Headless UI, Base UI, DaisyUI)
and five copy-paste libraries that honestly get no invented command.

Every provider carries the command that is true for it, per package manager, so
switching npm / pnpm / yarn / bun rewrites every line. The **dependency box**
collects what you want from any of them and copies the whole block at once — the
reason the box exists is that copying commands one at a time from six websites is
the actual work being removed. **Design Supremacy** is one client-side skill
assembled from Anthropic's frontend-design, the UI/UX Pro Max practice and
Apple's guidance, registered beside the other builtins.

## The agent asks before it reaches

- **Access scoping**, chosen by the user and enforced in the server on the command
  runner: the open project only (the default), the project plus named folders, or
  the whole computer behind a typed confirmation. A command that reaches outside
  is refused with the path that failed.
- **Downloads are announced and checked twice**: the link with VirusTotal before
  a byte is fetched, the file by its SHA-256 after it arrives, both verdicts on a
  ledger you can read afterwards. When no key is configured it says *not checked*,
  which is the truth, rather than implying clean. A link any engine flags is
  refused outright.
- **The agent's terminal** clones repositories and downloads files through that
  same gate, and every clone, install and download raises a notification.
- **Twenty-seven frameworks** with real commands: one-click projects for React,
  Go, Rust, Java and Python, and the official create command plus the toolchain it
  needs for everything else — Next, Nuxt, SvelteKit, Astro, Angular, Solid, Qwik,
  React Native, Expo, Flutter, Swift, Kotlin, Gradle, Spring Boot, .NET, FastAPI,
  Django, Rails, Laravel, Phoenix, Tauri.
- **MiMo** (Xiaomi's open platform) as a provider, and step-by-step key guides for
  it and every other provider — which console, which button, what the key looks
  like, what it costs, and the one thing that usually goes wrong.

## The pipeline reaches every prompt that builds

Research the look, ask what premium means, design a board, prototype at real
sizes, sweep the bugs, ship only on the user's signal — the six directives are now
injected into every prompt that asks for something to be built, not only into
coding mode, in that order.

## The desktop app

The Tauri shell is unchanged and built from this tag: NSIS on Windows, `.deb` and
`.AppImage` on Linux, each around a single-file server compiled by Bun so the
installed app needs no Node. Two changes this round: the installer build now also
runs on pull requests that touch the desktop side (the installers are the one
artifact nobody can check by reading a diff), and the sidecar compiled from this
commit was booted on the runner and probed before the bundle was allowed to build.

**Verified before tagging**: TypeScript strict on both workspaces, the production
build, both portable archives built and run, the create-path bench against the
packaged build (create a project 11 ms, create the sample app 4 ms, 8/8 checks,
report in `downloads/bench-report-0.37.0-beta.1.txt`), and the suites — smoke 65,
ui 60, design 32, r17 107, r18 60, render 857, ui-lab 44, updates 17, fork 32,
sample 33, the new API JSON test 11, and the create-path bench 8 — **1,326
checks**, all passing against the packaged 0.37.0-beta.1 build.

## Download

| Installer | Platform |
|---|---|
| `Research.Engine_0.37.0-beta.1_x64-setup.exe` | Windows 10/11 x64, per-user, WebView2 fetched automatically |
| `Research.Engine_0.37.0-beta.1_amd64.deb` | Debian/Ubuntu x64 |
| `Research.Engine_0.37.0-beta.1_amd64.AppImage` | any x64 Linux |

Installers are attached to this release by CI, with their SHA-256 digests recorded
in `downloads/INSTALLERS.sha256`.

Portable archives — a launcher plus the built server and UI, needing only Node 20+
on your machine — are in `downloads/` in the repository, hashed in `SHA256SUMS`:

```
research-engine-0.37.0-beta.1-linux-x64.tar.gz
research-engine-0.37.0-beta.1-win-x64.zip
```

There is no macOS build. From 0.29.0 on the app updates itself: **Settings →
Updates** reads the release list, verifies the archive against `SHA256SUMS`, swaps
only the code, and rolls back on its own if a version cannot start. A desktop
install is handed the installer instead, and a source checkout is told to
`git pull && npm run build`.
