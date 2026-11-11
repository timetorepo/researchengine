# Research Engine 0.39.0-beta.1

**The crash you sent is fixed, the coding workspace is drawn again as a set of tools rather than a table, design mode browses its own references inside the app, and the top bar shows what the app is costing you.**

This round was six asks, five of them from the crash report and the screenshot you
sent. All six are in this build, and each one carries a test that fails if it stops
working, so none of them can quietly regress.

## The crash, and the quieter damage underneath it

`Cannot read properties of undefined (reading 'map')` was two bugs wearing one
coat.

The screenshot's glitch was a layout bug in the bottom panel: its header row was
allowed to wrap, so the guard sentence at the end of it broke into a column one
word wide, the tabs wrapped under it, and the terminal, having no width to fall
back on, pushed the strip wider than the window. The row cannot wrap now, the
tabs scroll sideways on a three-pixel bar, and the guard note lives in the status
bar, where a long sentence cannot change a layout.

The throw itself came from a Design record written by an older build of this app.
The real damage was quieter than the crash: the store *dropped* a record whose
version it did not recognise, so the box, the brief and the board were being
thrown away on upgrade rather than crashing once. The store now carries a
version, **migrates instead of dropping**, and repairs every field on the way in,
and every list this app maps over is read through a default: agent tasks, test
runs, attachments, access roots, search hits, reader blocks, tags, palettes,
checklist items.

## The coding workspace, redrawn as surfaces

R24 redrew the chrome. This round redrew the page the chrome sits on. It was four
full-height columns sharing one hairline grid: a rail, an explorer, an editor and
an assistant, all flush against each other. It is now a canvas with panels nested
on it, the way Xcode 26 and the Finder draw a window:

- The rail, the explorer, the editor, **the terminal panel below it** and the
  assistant are each their own rounded surface with a six-pixel gutter, so
  nothing shares an edge with anything else.
- The status bar is **two floating glass pills** with the canvas showing between
  them: what this workspace is on the left, what it is doing on the right.
- The assistant dock is a panel of the same family instead of a column with a
  border-left.

Two things came with the layout:

- **The caret reaches the status bar.** The editor reports it and a readout
  subscribes through a ref, so typing re-renders one line of text rather than the
  whole workbench.
- **Nothing open is a welcome window**, not a sentence: three rows that each do
  something (open the explorer, ask the AI, run the app), each naming the key
  that also does it, and only keys the workspace actually binds.

The chrome suite still passes untouched, and a new one covers this: 29 checks on
the panes, the pills, the caret arriving, the welcome rows working, and reduced
motion turning the entrance off.

## Design mode browses its own references

Inspiration used to build the right Awwwards or Dribbble search URL and open it in
a **tab**, on the honest grounds that neither site offers a public search API.
That was still the wrong answer to "browse them in the app", and the app already
had the right one: the reader the Library opens sources with.

- **Awwwards** (sites of the day, nominations, collections), **Dribbble**
  (popular, web design, mobile), **Refero** (screens, apps, flows) and
  **unicorn.studio** open in a pane of the studio.
- Both ways in are kept: **Read** for the page reduced to text and pictures on the
  server, **Browser** for the real page in a sandboxed frame.
- An **address bar** takes any other URL, and **Back** walks the pages this
  session opened, beginning with the list of sources.
- Anything you read can be **kept as a reference** in one click, filed under the
  site it came from and titled the way the reader found it rather than by its
  domain. Kept references open here again or in a new tab, and the links that
  leave say so.
- **The component registry is one row away**, where the catalog is browsable
  (sixty items before you type) and every hit carries the install line for this
  project.

The reader gained an `inline` mode for this: same header, same two tabs, standing
in the caller's layout instead of over the window. The Library keeps its modal.

## Pick mode: smoother, and in your theme's colour

The pick marquee is drawn inside the preview frame, which is a different document
from the app and cannot read its CSS. It carried a hard-coded green and a 120 ms
transition that snapped whenever the pointer crossed into the next element.

- **The colour travels with the call**, read from Appearance at the moment it is
  needed: switch the theme, point again, and the marquee is the new accent. The
  label takes the ink that stays legible on that fill.
- **The box travels** instead of appearing: a per-frame lerp toward the target
  that stops asking for frames once it has settled, so it moves between elements
  the way a hand does.
- **One measurement per element**, not one per mouse move, which is the other
  half of smooth.
- **The linger after a pick is a timer**, because a settled box no longer
  schedules the frame that used to do the letting go.
- Scrolling hides the marquee instead of smearing it, and **reduced motion turns
  the travel off** while keeping the reading.
- The studio says the picker is armed (ring and pill, in the same colour), and a
  picked element walks its own row into view.

The studio itself is the same panelled page as the code workspace, with its
eleven tools grouped into work, design and ship rather than one flat row.

## The top bar shows what the app costs

A live **RAM, CPU and GPU** meter beside the privacy shield, fed by a new
`/api/resources`:

- CPU is measured as a delta between samples, so the first reading is honestly
  `null` rather than a made-up zero, and the second is the real percentage.
- System memory, load average and core count come from the machine.
- The GPU is read from `nvidia-smi` when it answers, then from the Linux DRM
  counters, and cached for three seconds. On a machine with no readable GPU the
  card **says what it could not read** instead of printing a zero.
- The client polls every two seconds, keeps forty samples for the traces, and
  **pauses while the window is hidden**.

## macOS folder blue

The Library folders' blue is now the accent itself (#0A84FF dark, #007AFF light),
converted into the component's own oklch ramp so the flap and the back stay one
hue, instead of a blue that merely read as blue.

## The desktop app

The Tauri shell is unchanged and built from this tag: NSIS on Windows, `.deb` and
`.AppImage` on Linux.

**Verified before tagging**: TypeScript strict on both workspaces, the production
build, both portable archives built and run, the create-path bench (8/8, report in
`downloads/bench-report-0.39.0-beta.1.txt`), the packaged build answering its own
health check, and the suites: render 857, r17 107, smoke 65, ui 60, library 58,
r18 54, ui-lab 44, design-browse 35, ide-chrome 35, updates 34, resilience 33,
fork 32, workbench 29, bridge-pick 24, resources 19, api-json 11, nav 9. The
bridge suite drives frames by hand rather than racing a 16 ms clock, which is how
it caught the marquee measuring every hovered element twice.

## Download

| Installer | Platform |
|---|---|
| `Research.Engine_0.39.0-beta.1_x64-setup.exe` | Windows 10/11 x64, per-user, WebView2 fetched automatically |
| `Research.Engine_0.39.0-beta.1_amd64.deb` | Debian/Ubuntu x64 |
| `Research.Engine_0.39.0-beta.1_amd64.AppImage` | any x64 Linux |

Installers are attached to this release by CI, with their SHA-256 digests recorded
in `downloads/INSTALLERS.sha256`.

Portable archives, a launcher plus the built server and UI needing only Node 20+
on your machine, are in `downloads/` in the repository, hashed in `SHA256SUMS`:

```
research-engine-0.39.0-beta.1-linux-x64.tar.gz
research-engine-0.39.0-beta.1-win-x64.zip
```

There is no macOS build. From 0.29.0 on the app updates itself: **Settings →
Updates** reads the release list, verifies the archive against `SHA256SUMS`, swaps
only the code, and rolls back on its own if a version cannot start. A desktop
install is handed the installer instead, and a source checkout is told to
`git pull && npm run build`.
