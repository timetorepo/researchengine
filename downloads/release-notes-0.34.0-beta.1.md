# Research Engine 0.34.0-beta.1

**Seven more components, each with a job — an onboarding that ends inside a
working chat, a UI lab for the interface built here, and a fork that carries the
same context for fewer tokens.**

You asked for the Aceternity components to be used, for onboarding to have more
steps so that someone can just go and run the app, for Developer Mode to be able
to test UI, for the app to stop getting laggy, and for forking a chat to compress
the prompt. All five are in this build.

---

## Where each of the seven lives

| Component | Its job |
|---|---|
| `colourful-text` | the welcome line — **The swiss knife of AI Research.** — with *AI Research* in colour, one beat, and a single static render when the system asks for less motion |
| `container-text-flip` | the new **Modes** step: one sentence slot flipping through *read a 60-page paper → build a quiz from it → search with citations → write and run code → flood a topic with agents* |
| `canvas-reveal-effect` | the dot matrix under that headline — its own lazy chunk, so onboarding's first paint never waits for a 3D renderer |
| `dotted-glow-background` | the backdrop of the new **Free** step, drawn from this app's own theme variables rather than a `.dark` class nobody sets |
| `apple-cards-carousel` | the new **Features** step: six cards that open, every illustration hand-drawn SVG in your palette |
| `gooey-input` | chat search in the Chats page — a dot that expands into a real field and collapses again |
| `images-badge` | message attachments — three photos become a folder whose papers fan out under the pointer, instead of three full-size images stacked above every answer |

**No stock images.** The carousel art is drawn in the component, from
`color-mix()` on your theme tokens, so it follows all thirteen palettes.

## Onboarding: five steps became eight, and it ends by running the app

`Welcome → Privacy → Modes → Features → Free → Provider → Try the demo → You're set`

The last step is not a summary screen with a button on it. There is a question
box: type your own or take one of the suggestions, press **Run**, and it creates
the chat, hands the prompt over through the same handoff the home screen uses,
and starts streaming — the first answer arrives inside onboarding, on the local
demo model if you have not added a key yet. That is the whole point of the extra
steps: you leave with the app already doing your work, the users' way.

### The Free step

Seven apps that do what Research Engine does, each one charging by the month,
each with its own favicon — and an eighth tile that is this app:

> **ResearchEngine is free, unlike these apps.**

The favicons are **bundled SVG marks**, not a call to a favicon service. A first
run that pings seven subscription businesses on your behalf is the opposite of
what this app is, and it would render nothing on a machine that is offline — the
one place this app is supposed to work best.

## Developer Mode now has a UI lab

**Settings → Developer → UI lab.** A registry of the interface that is built
here — the composer, the thinking indicator, the mode menu, the revolving hero,
the route skeleton — each one rendered **live**, with the knobs that actually
matter, in three widths (390 / 768 / full), in any theme, with the grid you style
against, a remount button, and a log of what you touched. **Show me in the app**
jumps to the real element through the `data-ui` anchor the component carries and
flashes it: the composer in the chat, the thinking indicator next to a streaming
answer, the mode menu in place — and the flash scrolls only that element's own
scroll box, because the app-wide ban on browser scrolling exists precisely
because it used to load pages at the bottom.

**The scope is deliberately narrow**, because you were explicit about it:
Aceternity, SmoothUI, ReactBits, Watermelon, HeroUI and skiper are excluded by
name, the rule is printed on screen, and a check fails the build if a lab entry
ever points at a vendor folder. The lab is for the interface that is made here.

## Forking a chat now compresses the prompt

`lib/chat/fork.ts` — local, deterministic, no model call, so compressing a
conversation costs nothing and never leaves the machine.

- The **last turns stay verbatim** (0–6, your choice), so the thread continues
  mid-sentence where it stopped.
- Everything older becomes a **capsule** with four sections: *the task*,
  *decisions, constraints and facts*, *what was said*, *how to continue*.
- Repeated phrasing, facts stated twice and the same code fence pasted into
  every reply are removed — word-overlap similarity, digits stripped, so
  `250 ms` in three different sentences counts as one numeric fact and survives
  once.
- Three strengths — **compact / balanced / faithful** — plus a code switch and a
  token budget.
- **Measured on a real thread**: a 30-turn conversation of ~3,078 tokens
  compresses to a ~1,154-token capsule (**63% fewer**), with the task, the
  constraints, seven decision facts and the code block intact. The panel shows
  the real numbers for *your* conversation, both sides of them, before you press
  the button.
- The panel shows the capsule itself, then **Fork into a new chat** — the new
  chat opens with the capsule as its context and the card above it saying where
  it came from and what it saved.

`npm run fork-test` is the suite: 32 checks over savings, what must survive,
limits and determinism. It asserts the words that had to survive compression
verbatim.

## It stops getting laggy

A frame-budget governor (`lib/system/frame-budget.ts`) measures the real thing —
median frame time over 90 samples, after 30 warmup frames — and when the machine
is not keeping up, the expensive layers step down instead of stuttering:

- the reveal dot matrix serves a **static grid** (and pauses entirely off-screen,
  and skips the shader under reduced motion);
- the dotted-glow field draws **one still frame** and turns its glow off;
- the shape grid **stops its loop** at the lowest level;
- the onboarding canvas is a **separate lazy chunk**, so it is never part of the
  first paint, and `react-three-fiber` is fetched only when that step is opened.

**Settings → Performance** shows the live fps, the measured frame time, the
reason for the current level, and a **Re-measure** button — with adaptive quality
off meaning *always full* (fps and frame time are still reported, nothing is
downgraded). Long chats also stopped re-rendering the whole transcript on every
streaming tick, and rows you have scrolled past no longer do the work of rows on
screen.

## What is in the box

- **Windows** `Research.Engine_0.34.0-beta.1_x64-setup.exe` — per-user, WebView2
  fetched automatically, no Node and no Electron on your machine.
- **Linux** `Research.Engine_0.34.0-beta.1_amd64.deb` and
  `…_amd64.AppImage`.
- **Portable archives** (`research-engine-0.34.0-beta.1-linux-x64.tar.gz`,
  `research-engine-0.34.0-beta.1-win-x64.zip`) run on any Node 20+ machine and
  are what the in-app updater verifies and installs against `SHA256SUMS`.

There is **no macOS build** — no macOS runner is configured, and this release
does not pretend otherwise. CI builds the Windows and Linux installers from this
tag and attaches them here; their hashes are in `downloads/INSTALLERS.sha256`
and are GitHub's own digests for the uploaded assets.

## Verified before shipping

`tsc` clean · `render-check` **857/0** (it now asserts every Aceternity component
is imported by a host outside its own folder, the onboarding copy and favicons,
the fork panel, the lab's scope rule and the frame-budget wiring) ·
`fork-test` **32/0** · `ui-lab-test` **41/0** · `ui-test` 60/0 · `models-test`
96/0 · `smoke` 65/0 · `integrations-test` 51/0 · `updates-ui-test` 17/0 ·
`update-test` 71/0 + 3 skipped · `desktop-check` 36/0 · `design-test` 32/0 ·
`bench-report` 8/0.
