# Research Engine 0.28.0-beta.1

The four things you reported, fixed — and each one has a test that would have
caught it before you saw it.

## One click is one page again

You said it plainly: you had to click a page twice, and the first click felt
like it "denied" you. It did, and it was my bug, not the browser's.

The View Transitions layer was deferring the real `history.pushState` into the
transition callback. react-router announces a navigation *when `pushState`
returns* — so the router reported the **old** location, React re-rendered the
old page, and the address bar quietly disagreed with the screen. The second
click worked only because by then the URL already held the path the router
would read.

- the push now happens **first, always, in the same tick** — the transition
  wraps it and tells the browser to wait for the next paint, with no `flushSync`
  anywhere in the path;
- the route observer that was rewriting history during navigation no longer
  gets in front of the push;
- a route is animated into only after it has **rendered** once: its first render
  suspends, and animating into a skeleton is what froze the frame two rounds ago.

`scripts/nav-test.mts` (new) runs the real app in a real DOM with a faithful
View Transitions polyfill and asserts the only thing you actually care about —
**one click, one page** — for every row in the sidebar. 20 checks.

## The dock's name plate is readable

The minimized dock labels were too small to read at a glance. They are now
13.5px with more padding, still quiet, still morphing on hover.

## Right-click does something, everywhere

shadcn's **context menu** (Radix, themed with the app's own tokens — not its
default skin) is mounted over the whole app:

- **Paste** — into the field you pointed at, or into the AI composer when you
  pointed at nothing. It uses the real paste path, with a fallback so a denied
  clipboard still lands text somewhere instead of doing nothing;
- **Ask AI**, **Start a chat**, **Search the web**, **New research** — on the
  selection when you have one;
- copy, cut, and link actions (open, copy, *read it with AI*) that only appear
  when you are actually over a link;
- tasks, settings, the command palette and a theme switch.

Anything that owns its own right-click (the scroll indicator) is skipped, so
the two menus can never fight.

## The progress indicator answers right-click itself

Right-clicking the scroll indicator no longer collides with the app menu. The
indicator owns that menu, and it now has the shapes you asked for:

- **Bar** — the original rail (still the default, and still in the same place);
- **Circle progress** — a ring **with** a background track/plate;
- **Circle (bare)** — the same ring with no background at all;
- **Top bar** — a hairline across the top that clears the sidebar rail.

Plus **unlock to drag**, reset position for the current tab, and hide on every
tab. Rings can be scrubbed by dragging around them, and it is all per-surface:
the home, chats, coding and workflows tabs each remember their own placement.

## The Share Studio draws again

The preview was blank and Copy put a blank PNG on the clipboard for every style
except "Custom image" — because every style set the canvas size and then never
called the drawing function.

- one `paint(image)` path now covers **all four** looks (Liquid Glass, Gradient,
  Solid, Custom image);
- a picture that fails to decode falls back to the gradient instead of taking
  the studio down with it;
- if the browser refuses to encode the canvas, we fall back to a data-URL blob;
- an empty blob is never copied — you get a toast instead of a silent nothing;
- long unbroken text (a URL pasted into a caption) is now broken to fit rather
  than running off the card.

`scripts/share-test.mts` (new) draws every style into a recording 2D context and
reads back what the card says, including that the grade label is right and that
no line is ever drawn wider than the card. 18 checks.

## The bench can be run from a terminal now

Settings → Developer has always had "Test: create a project" and "Test: create
the sample app" buttons that run the real create path and print every fact. That
logic is now **one shared function** — the buttons call it, and so does
`scripts/bench-report.mts`, which prints the identical report the Copy button
produces:

```bash
npx tsx scripts/bench-report.mts --out bench-report.txt
```

It was run against this build before release, and it passes: the server answered,
it served 0.28.0-beta.1, a project was created in one request, the sample app was
created in one request, and neither was left on disk. The report is in
`downloads/bench-report-0.28.0-beta.1.txt` — that is this machine proving it, not
a screenshot of a machine.

## Verified

| Suite | Result |
|---|---|
| `scripts/render-check.mts` | 562 checks, 0 failures |
| `scripts/nav-test.mts` | 20 checks, 0 failures |
| `scripts/share-test.mts` | 18 checks, 0 failures |
| `scripts/render-probe.mts` | 35 checks, 0 failures |
| `smoke` / `ui-test` / `sample` / `design` | 65 / 60 / 33 / 32, all pass |
| engine / workflow / background props | all pass |
| `tsc --noEmit` | clean |
| production build | clean |

Version bumped to 0.28.0-beta.1 across the workspace, the README badge and
Settings → About, which carries the full changelog entry.

## Downloads

| Platform | File | Needs |
|---|---|---|
| Windows 10/11 x64 | `research-engine-0.28.0-beta.1-win-x64.zip` | Node.js 20+ |
| Linux x64 | `research-engine-0.28.0-beta.1-linux-x64.tar.gz` | Node.js 20+ |
| Windows installer | `Research.Engine_0.28.0-beta.1_x64-setup.exe` | nothing — per-user, no admin |
| Linux installer | `Research.Engine_0.28.0-beta.1_amd64.deb`, `…AppImage` | nothing |

Portable archives are in `downloads/` and hashed in `SHA256SUMS`. The installers
were built by CI from this tag (run 36255237632, both jobs green) and verified
before upload — magic bytes, NSIS/ar/ELF signature, product name, size; their
hashes are in `downloads/INSTALLERS.sha256`, taken from the "installer verified"
reading CI published, cross-checked against the byte counts GitHub reports for
the uploaded assets. Node.js is only needed by the portable builds; the
installers carry their own server.

| File | sha256 |
|---|---|
| `Research.Engine_0.28.0-beta.1_x64-setup.exe` | `940e4baa…b9a1` |
| `Research.Engine_0.28.0-beta.1_amd64.deb` | `c263d097…aff6` |
| `Research.Engine_0.28.0-beta.1_amd64.AppImage` | `50d8ad5f…f663` |
| `bench-report-0.28.0-beta.1.txt` | *(a report, not a build)* |
| `research-engine-0.28.0-beta.1-linux-x64.tar.gz` | `9a87a07e…3f41` |
| `research-engine-0.28.0-beta.1-win-x64.zip` | `20b1c4a8…b20d` |

Data lives in `~/.research-engine` (`%USERPROFILE%\.research-engine` on Windows)
and is shared by every build, so updating never touches your library.
