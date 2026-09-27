# Research Engine 0.32.0-beta.1

This round is about the two things you could see failing: **an update that would
not download**, and **a version number that was not your version**. Both are
fixed at the root, and the update you are reading about now announces itself in
the app — in a real HeroUI modal, with the notes below, instead of a small pill
you had to notice.

## Why the update download failed

The app asked GitHub for the release file **without proving who it was.** The
repository is private while it is in beta, and on a private repository the
browser-style download URL answers `404` to anyone without a session. The updater
had a token on hand — it just was not attaching it to that particular request,
and it was calling the one URL form a token *cannot* authenticate.

Three changes, in the order they now happen:

1. **The committed copy of the archive at the tag is tried first** — raw, then
   through the contents API with the token attached. That is the form a
   read-only token can always read, public or private.
2. **Uploaded release assets are fetched by their API URL** (`/releases/assets/<id>`)
   before their browser URL, because the API form is the only one a token works
   on. Both are tried, so a public repository with no token still works.
3. **The failure message lists every source it tried**, instead of one status
   code and a shrug.

The desktop (Tauri) path had a second, independent bug: it insisted on a
platform installer (`setup.exe`, `.dmg`, `.AppImage`) and **errored out** when a
release published only the portable archives — which every release of this app
does. It now falls back to the verified portable archive, checks it against the
release's own `SHA256SUMS`, and writes a `HOW-TO-INSTALL-<version>.txt` next to
it explaining what to unpack. An installer is still what a desktop build
prefers; the archive is what it gets when that is all the release has.

Proven end to end, not argued: a packaged 0.32.0-beta.1 install was pointed at a
release manifest for a later version, and the sequence ran for real —
downloaded, verified against `SHA256SUMS`, unpacked, swapped with the previous
version kept as the backup, restarted itself, and came back **serving the new
version**. That is the same code path this update will use on your machine.

## `0.0.0-dev` is gone

The version you see is now the version you are running, resolved in this order:

1. the version stamped into the built frontend by Vite,
2. otherwise the version the server reports for the frontend it is serving,
3. otherwise `dev` — and only then.

`0.0.0-dev` was a hard-coded fallback for "we could not read a `package.json`",
which a desktop shell or a hand-unpacked folder can hit while running a perfectly
good build. The top bar, About, Updates and the developer report all read the
resolved value now, and `/api/update/status` reports it as `runningVersion` as
well. (The server's own fallback had a typo in it: `0.0.0.0`. That is also gone.)

## Release notes that function

"Release notes" used to be a link to the release's page on GitHub — a 404 on a
private repository, which is exactly what a beta install is. The notes were
already in the update check's answer the whole time, so they are now rendered
**in the app**, using the chat's own markdown renderer: headings, lists, code
blocks and links, loaded on demand so the first paint does not pay for it.

## A popup when a new version exists

When the quiet check on startup finds a release you have not been told about,
**HeroUI's Modal** opens with:

- the version that is out, and the version you are on,
- the release notes, rendered inline,
- a **Download & install** button (or **Download installer** on the desktop
  app, or the `git pull && npm install && npm run build` line on a source
  checkout),
- live progress while it downloads, verifies, unpacks and swaps,
- **Restart now** once the new version is in place,
- **Skip this version**, which is remembered and never announced again.

It appears **once per version**, four seconds after the app settles rather than
on top of the first paint, and nothing installs without a press. The top bar pill
opens the same popup instead of a settings page, so there is one place to read
what changed and act on it.

## The components you asked for, actually used

- **Chats** now uses **HeroUI's real `Tabs`** for **All / Research / Coding** —
  the library's own roles, roving tabindex, keyboard model and selected state,
  restyled onto this app's tokens through slot classes.
- **The update popup** uses **HeroUI's real `Modal`** — their portal, focus
  trap, Escape handling, scroll lock and enter/exit animation.

Making that work properly took more than installing the packages. HeroUI v2
ships its styles as class names and expects its Tailwind **v3** plugin to have
registered the utilities behind them; this app is on Tailwind **v4**, where that
plugin does not exist. So the class list HeroUI needs is generated into the
stylesheet by a script (`frontend/scripts/heroui-classes.mjs`, 284 class
candidates from `@heroui/theme`) and the plugin's own utilities
(`text-tiny`, `scrollbar-hide`, `opacity-disabled`, `border-medium`, …) are
reimplemented in v4's `@utility` form. Without that second half the components
render but do not look like themselves. Both halves are covered by a check that
fails the build if a class HeroUI asks for is missing from the compiled CSS.

## Home screen: minimal by default

- **Widget cards are off until you turn them on** (Settings → Appearance → Home
  screen), and when they are on they are frosted glass over the wallpaper rather
  than flat panels.
- **"Try the offline demo" is off by default too.** The landing page is the hero
  line, the composer and suggestions drawn from your recent work — nothing else
  competing for the first second.
- **Raycast's wallpapers** ship with the app: ten of them, converted to WebP
  (10–20 kB each), pickable as a thumbnail grid, with the option to keep the
  wallpaper on the home screen only or on every page.
- **The recent-work cards carry Border Beam** by Jakub Antalik — the same
  travelling light as the composer, so the clickable things on the home screen
  read as one family. It is skipped entirely when you have motion reduced.

## Motion, in one hand

- **Pressing send on the home screen** now blurs the page out and settles the
  chat in behind it, as one movement: the home view leaves, the chat arrives
  from a soft focus, and the answer streams in underneath while the focus
  finishes. Continuing a conversation from a "pick up where you left off" card
  takes the same path, because that is the same action.
- **Settings plays an exit** when you leave it (Back, Escape or the palette) —
  it drifts, blurs and fades before the next page arrives, instead of being
  replaced mid-frame.
- **Tasks slides out** when you click away, with the backdrop fading on the same
  beat. The panel previously returned `null` before its own exit animation could
  run, so it vanished instantly.

## The pomodoro timer

Two bugs, both visible:

- **The minimised clock changed every two seconds.** The wake-up for the next
  tick was computed as the *complement* of the fraction-of-a-second left, with a
  negative modulo — so every other tick was scheduled a full second late. It now
  waits out exactly the fraction remaining in the current second, which is what
  makes the digits change once per second, on the second.
- **The expanded timer was clipped at the top.** It lives in a 48px bar at the
  very top of the window and grew around its own centre, pushing its title row
  off the screen. It is top-anchored now and grows downward.

## Numbers

| | |
|---|---|
| CSS (built, gzipped) | 271 kB raw / 61 kB gzip — HeroUI's Modal + Tabs cost ~16 kB raw |
| Entry bundle | 1.32 MB raw / 389 kB gzip |
| render-check | **800 passed, 0 failed** |
| updates UI (new) | **17 passed, 0 failed** — the popup and the tab strip, mounted for real |
| updater suite | 71 passed, 0 failed, 3 skipped (no network in this build environment) |
| models / smoke / UI / integrations | 96 · 65 · 60 · 51 — all passed |
| design mode end-to-end | 32 passed, 0 failed |
| developer bench (this archive) | 8 passed, 0 failed — see `bench-report-0.32.0-beta.1.txt` |

## Updating to this version

From **0.29.0 on, the app updates itself**: Settings → Updates, or the pill in
the top bar, or the popup that now appears on its own. The checksums for the two
archives below are in `SHA256SUMS`; the desktop installers are built by CI from
this tag and attached to this release, with GitHub's own recorded digests.
