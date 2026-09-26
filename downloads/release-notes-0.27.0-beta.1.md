# Research Engine 0.27.0-beta.1

A round of fixes for the things you reported, plus the two Skiper components you
picked — and a sidebar that finally only navigates.

## FreeRoute no longer crashes

`Minified React error #310` was mine, and it was a hook-order violation: the
smooth-caret helper called a React hook and was then spread inside a conditional
field, so the number of hooks changed between renders and React refused to keep
going. Fixed at the source rather than by moving code around:

- the props helper is **hook-free** now — it reads the setting through the store
  without subscribing, so it can be spread anywhere, including inside a branch;
- `useSmoothCaret()` is the hook variant, and it is called **once, at the top**
  of any component that wants it (FreeRoute's key field takes it exactly once);
- `render-check` now proves both, including that there is exactly one call site
  and that it sits above the field that uses it.

## The sidebar is navigation only

The Spaces chips, the research/coding switch, the history list and the search
box are gone — the Chats page already does that job, with room to search and
filter. What the list could do, the page can do too:

- **pin** a chat (pinned chats sort to the top),
- **rename** it by double-clicking its title,
- **export** it as JSON,
- delete, as before.

**Every row in the rail now carries an arrow at its edge** — dim while you are
elsewhere, bright while you point at it, and always present, so the row reads as
a door instead of a label.

**The Chats row opens.** Rest on it and the arrow becomes a **rounded cube of
your recent conversations** — newest first, research and coding together, with
the total and a way through to all of them. Two seconds of rest while the rail
is minimised, one second when it is expanded, one spring either way (nothing is
sequenced), and a short grace window so your pointer can cross the few pixels
between the thing you pointed at and the cube. It re-arms only after you leave.

**The doubled label is fixed, twice over.** Both causes are gone:

1. a rail label may no longer reflow to a second line while the rail animates
   its own width (labels are single-line, truncating);
2. the rail no longer cross-fades its own view-transition snapshot. Both
   snapshots were painted at full opacity over a sidebar whose background is
   transparent between rows, so any 1–2px difference (a hovered row, the active
   marker mid-slide) showed *through* the new snapshot as a ghost.

## The profile card

The banner was shorter than the avatar ring, so the ring was clipped, and the
name and handle sat on the pastel wash. The banner is 96px now, the avatar
overlaps it on the card's own surface, the controls float over it on frosted
chips, and the name, handle and bio live below the banner where they are legible
in every theme.

## Skiper UI, twice more

**CssLink** (skiper40) — links whose underline is drawn in CSS instead of by the
browser, so the rule is wiped in rather than switched on. Answering links now
read as part of what you can touch:

- one component, three shapes: inline in prose, **chip** for a source, card for
  a call to action;
- the external marker arrives on hover instead of sitting there permanently;
- **citations** get the number, the title and the host, as a chip;
- internal links (`#/…`) go through the router — no reload, no lost state;
- reduce-motion gets a plain underline.

Used by every link in a markdown answer.

**Scroll Progress** (skiper89) — a thin indicator on the edge of every scrolling
surface. The hard part was that this app has no single scroll container, so it:

- tracks **whichever container is actually scrolling** (capture-phase listener,
  no hardcoded selectors);
- **hides itself** when the surface cannot scroll — a bar stuck at 0% is noise;
- keeps a **position per tab** (clear of the chat composer on Chats, the
  assistant panel in Coding, the dock on Home) and steps aside while the Tasks
  panel is open;
- **right-click to unlock**, then drag it anywhere — the drop position is
  remembered for that tab; lock it again, reset it, or hide it;
- and there is a **Settings → Appearance → Scroll progress** switch, so hiding
  it is reversible.

## Everything else in this round

- `render-check` grew a section for this round: **532 checks, all passing**
  (hook-order proof included).
- A new **render probe** (`npm run render-probe`, 27 checks) mounts the shell's
  components into a string with no browser — the only headless way to catch a
  crash that happens *while rendering*, which is the class of bug this round
  started with. It caught one of mine: a portal read `document.body` during
  render, which throws anywhere that is not a browser. All floating UI (dock
  labels, the chats cube) now goes through one guarded portal.
- Version bumped to 0.27.0-beta.1 across the workspace, the README badge and
  Settings → About, which carries the full changelog entry.

## Downloads

| Platform | File | Needs |
|---|---|---|
| Windows 10/11 x64 | `research-engine-0.27.0-beta.1-win-x64.zip` | Node.js 20+ |
| Linux x64 | `research-engine-0.27.0-beta.1-linux-x64.tar.gz` | Node.js 20+ |
| Windows installer | `Research.Engine_0.27.0-beta.1_x64-setup.exe` | nothing — per-user, no admin |
| Linux installer | `Research.Engine_0.27.0-beta.1_amd64.deb`, `…AppImage` | nothing |

Portable archives are attached to this release and hashed in `SHA256SUMS`;
installer hashes are in `downloads/INSTALLERS.sha256`. Every one of them was
built by CI from this tag (run 36228769700, both jobs green) and verified before
upload — magic bytes, NSIS/ar/ELF signature, size. Node.js is only needed by the
portable builds; the installers carry their own server.

| File | sha256 |
|---|---|
| `Research.Engine_0.27.0-beta.1_x64-setup.exe` | `436cf139…58d7` |
| `Research.Engine_0.27.0-beta.1_amd64.deb` | `619dfc57…0f78` |
| `Research.Engine_0.27.0-beta.1_amd64.AppImage` | `7ad7ed64…fe6f` |
| `research-engine-0.27.0-beta.1-linux-x64.tar.gz` | `087bad27…33bf` |
| `research-engine-0.27.0-beta.1-win-x64.zip` | `3300a6e0…ae8c` |

Data lives in `~/.research-engine` (`%USERPROFILE%\.research-engine` on Windows)
and is shared by every build, so updating never touches your library.
