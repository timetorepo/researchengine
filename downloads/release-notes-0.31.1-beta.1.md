# Research Engine 0.31.1-beta.1

A patch release with one root cause behind it, and it is worth naming because it
explains a white square you sent me.

## The reset was beating the components

Every control in this app takes the project's font and colour instead of the
browser's, through one line:

```css
input, textarea, select, button { font: inherit; color: inherit; }
```

That line was **unlayered**. In CSS, an unlayered author rule outranks *every*
layered rule — including everything inside Tailwind's `@layer utilities`. So
whenever a component set a colour on a button with a utility (which is exactly
how the vendored React Bits Micro controls are written), this one line quietly
overrode it.

Two things you can see were caused by it:

- **The send button in Agent Flood's objective bar.** Armed, it fills itself with
  the bar's ink — a light colour — and its arrow is drawn with `currentColor`,
  which the utility was supposed to set to the bar's *background*. Overridden, the
  arrow inherited the composer's own light text colour: **a light arrow on a light
  fill, so the button read as a plain white square**.
- **The dictation pill.** Its listening state sets `color: var(--vp-accent)` with
  a utility, so the mic never turned your accent colour while it was recording.

The fix is where the line belongs:

```css
@layer base {
  input, textarea, select, button { font: inherit; color: inherit; }
}
```

Utilities win over a reset again, and every vendored control gets the colours it
was written with. The build now **asserts this on the built stylesheet** — it
walks the compiled CSS, finds the reset, and fails unless it is inside
`@layer base` — so this class of bug cannot come back unnoticed.

## Also in this patch

- The portable archives and the packaged build are regenerated on this tag:
  entry `1,025.64 kB / 321.81 kB gzip`, backend `dist/index.js` 237.8 kb.
- Create-path bench on the packaged portable build: **8/8 PASS**
  (`bench-report-0.31.1-beta.1.txt`).
- Test suites green: render-check **799/0** (including the new cascade assertion),
  integrations 51/0, models 96/0, update 81/0, navigation 20/0, share 18/0, UI
  60/0, smoke 65/0, sample 33/0, design 32/0, render-probe 35/0, background props
  12 themes × 4 kinds; backend and frontend typecheck clean.
- Full 0.31.0 features are unchanged — the popovers, the dictation pill's Cancel
  behaviour, and the working integrations (Drive, Gmail, Calendar, GitHub,
  Notion, Slack, local files) are all in this build. See the 0.31.0 notes above
  for the detail.

## Updating

**Settings → Updates** will find this release the same way it found the last one,
verify the archive against `SHA256SUMS` published with this tag, and swap the code
in — your library is never part of the swap, and a version that cannot start is
rolled back automatically.

Portable archives are in `downloads/` in the repository, hashed in `SHA256SUMS`:

- `research-engine-0.31.1-beta.1-linux-x64.tar.gz`
- `research-engine-0.31.1-beta.1-win-x64.zip`

This is a stylesheet fix, so if you are on the desktop installer there is nothing
you have to do — the installers below are rebuilt by CI from this tag, and the
next feature release will carry them anyway.

## Installers, built by CI from this tag

| Asset | Bytes | sha256 |
| --- | ---: | --- |
| `Research.Engine_0.31.1-beta.1_amd64.AppImage` | 121,772,536 | `99ad8c07fd573673f1a4be11de1f4faef9e4815399e76e2cebb8810b2e7c3ce8` |
| `Research.Engine_0.31.1-beta.1_amd64.deb` | 46,837,874 | `0625a5bc50f98d855ac96630a33691b2ca666240d7393cca0a562795cd958e47` |
| `Research.Engine_0.31.1-beta.1_x64-setup.exe` | 38,441,133 | `52df261f7b5957cb380ba446e50a857aa46964cdb83e58b475841acc4ac490f4` |

Those three digests are GitHub's own reading of the uploaded assets (the release
API's `digest` field for each file); the same three lines are in
`downloads/INSTALLERS.sha256`.
