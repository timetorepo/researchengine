# Research Engine 0.38.0-beta.1

**The Library searches the whole web and opens what it finds, a coding workspace drawn with Xcode and Cursor taste, and recommendations that read like a feed.**

This round was seven asks. All seven are in this build, and each one has a test
that fails if it stops working.

## Every source opens

The Library used to hand you links. It now opens them, in a squircle reading pane
inside the app:

- **Wikipedia is read through its own API**, so the article arrives as sections
  and paragraphs rather than as a page of navigation and sidebars.
- **Everything else is reduced from HTML** to headings, paragraphs, lists, quotes
  and code by a small reader that runs in the server — with the private-network
  guard applied to the URL it is asked to fetch.
- **A page rendered by its own JavaScript says so** instead of arriving as an
  empty pane: the reader explains what it could not get and offers the browser.
- The pane shows the word count and reading time, and it scrolls in its own
  container, not the page behind it.

The agent reads the same way, through `library_read`: article sections, a word
count, and a bounded amount of text.

## Search became a small engine, with this app's own components in it

Library search now runs one query through five labelled verticals, each of which
says what it is and why it is empty or failed:

- **web** — your SearXNG, then DuckDuckGo
- **wikipedia** — the API
- **screens** — Awwwards, Dribbble, unicorn.studio and Refero, by URL grammar
- **ui** — the pattern you are building, in Refero and Mobbin, **plus the
  components this app can actually install**: every component hit names the
  registry it comes from and the exact command that installs it, per package
  manager
- **docs** — a curated index of MDN, React, Tailwind, shadcn, Tauri, Hono, Zod
  and Motion

The instant verticals answer on the first call and the network ones follow up, so
the screen fills in two beats instead of waiting on the slowest lane. A screen
word is read as one request: "empty state" is not the two words "empty" and
"state", which is why the catalog is searched through one shared vocabulary that
the Library, the design hub and the agent all read identically. When the catalog
genuinely has nothing, the answer is nothing.

**The agent reaches all of it by tool call.** `library_search` runs the same
ladder and returns the hits labelled by vertical, with install commands attached;
the component half ships inside the app, so it answers even when the local server
does not.

## The coding workspace, drawn again

Studied against Xcode 26, Cursor 3 and Zed, then rebuilt:

- Bars and controls **float on their own glass** instead of sitting in a toolbar
  strip; related controls are grouped into pills; icons are monochrome.
- **Eight distinct movements**, one per interaction, so nothing repeats: a press
  that compresses, a button that grows from the point you clicked, a pulse, a tab
  pill that glides, a rail marker that slides, a spinner that only turns while a
  task is running, rows that rise as they arrive, an underline that travels
  between panels, and a dock that opens in the direction it was asked for.
- The agent dock groups tasks by repo, gives each a state glyph and a live timer,
  and ends each finished task with a diff you accept per file — and the merge
  button says how many of them you are merging.
- Reduced motion stills all of it: the movements are suppressed, and the CSS that
  hides the growing control is part of the check.

## Recommendations read like a feeder

Newest first, grouped by the day they arrived, filtered by what you watch —
the tags you saved and the feeds you added. Each story says which watch produced
it, and carries who published it and a favicon; saving puts it in your Library,
dismissing is remembered. When the feed cannot be built it says so on the panel,
with a Retry beside the message.

## Folders are squircles, and opening one stays put

The Library's folders are the installed `folder-reveal` component, blue, opening
under the pointer, with a squircle background. Clicking one shows its saves.
Opening a folder no longer throws the page to the top: a scroll keeper records
where you were and puts you back, clamped only to what the shorter page can
actually hold.

## Updates is every changelog

From the first version to the latest, newest first and each one selectable — a
224 px rail of versions beside the release's own page, with search, arrow-key
stepping, and the running build at the top. The record covers 30 releases and 634
items, generated from the releases themselves, so it cannot drift from what
shipped.

## The desktop app

The Tauri shell is unchanged and built from this tag: NSIS on Windows, `.deb` and
`.AppImage` on Linux.

**Verified before tagging**: TypeScript strict on both workspaces, the production
build, both portable archives built and run, the packaged build serving and
answering its own expanded search, the create-path bench (8/8, report in
`downloads/bench-report-0.38.0-beta.1.txt`), and the suites — library 58, smoke
65, ui 60, r17 107, r18 54, render 857, ui-lab 44, updates 34, fork 32, design
32, sample 33, ide-chrome 35, r17-ui 31, API JSON 11, bench 8, and the navigation
repro's nine steps — all passing.

## Download

| Installer | Platform |
|---|---|
| `Research.Engine_0.38.0-beta.1_x64-setup.exe` | Windows 10/11 x64, per-user, WebView2 fetched automatically |
| `Research.Engine_0.38.0-beta.1_amd64.deb` | Debian/Ubuntu x64 |
| `Research.Engine_0.38.0-beta.1_amd64.AppImage` | any x64 Linux |

Installers are attached to this release by CI, with their SHA-256 digests recorded
in `downloads/INSTALLERS.sha256`.

Portable archives — a launcher plus the built server and UI, needing only Node 20+
on your machine — are in `downloads/` in the repository, hashed in `SHA256SUMS`:

```
research-engine-0.38.0-beta.1-linux-x64.tar.gz
research-engine-0.38.0-beta.1-win-x64.zip
```

There is no macOS build. From 0.29.0 on the app updates itself: **Settings →
Updates** reads the release list, verifies the archive against `SHA256SUMS`, swaps
only the code, and rolls back on its own if a version cannot start. A desktop
install is handed the installer instead, and a source checkout is told to
`git pull && npm run build`.
