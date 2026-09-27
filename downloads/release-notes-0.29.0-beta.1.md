# Research Engine 0.29.0-beta.1

You said you were tired of installing and uninstalling old versions. This release
is the end of that: the app now updates itself — and your library is the one thing
an update is never allowed to touch.

## The updater

Settings → **Updates** is a new tab, and the top bar grows a small pill when a
newer release exists. Nothing downloads until you press the button; the check
itself is a quiet background request ten minutes at a time.

What happens when you press **Install update**:

1. **Check** — GitHub's release list is read (not `/releases/latest`, which skips
   prereleases — every release of this project is one), and the newest version is
   picked with a real semver comparison, prerelease rules included.
2. **Download** — `research-engine-<version>-<platform>.tar.gz` (or `.zip` on
   Windows) from the release, with a second source (`api.github.com` contents +
   `Accept: application/vnd.github.raw`) for networks that block the first.
3. **Verify** — `SHA256SUMS` is fetched from the *same tag*, the archive must be
   listed in it, and the SHA-256 must match **before a single byte is unpacked**.
   A mismatch aborts the update and leaves the installed app exactly as it was.
4. **Unpack** — with an extractor written for this job: tar.gz and zip, GNU long
   names, pax headers, ustar prefixes, base-256 sizes, stored and deflated zip
   entries. Entries that try to escape the target (`..`, absolute paths, drive
   letters, links) are refused, and there are per-file and total size ceilings so
   a hostile archive cannot fill your disk.
5. **Swap** — `server/`, `frontend-dist/` and `bin/` are replaced, with the old
   ones moved to `.update/backup/` first. The library is never in that list and
   the code that decides it is a pure function that three tests pin down.
6. **Restart and watch** — the server restarts on the new code; if it cannot get
   through its own health window, the next boot **rolls back by itself** and the
   Updates tab says what happened, in plain words.

Where you see it:

- **portable build** (the archives below) — updates itself in place;
- **source checkout** — refuses, and tells you `git pull && npm run build`;
- **desktop app** — downloads the installer and hands it to your OS.

The library (`~/.research-engine`, `%USERPROFILE%\.research-engine`, or
`RESEARCH_ENGINE_DATA_DIR`) is never read for update purposes, never written, and
never swapped. That is not a promise in a comment: `scripts/update-test.mts`
hashes every file in a real library directory before and after each step —
download, verify, unpack, swap, rollback, **and a real update over the network
from the published release** — and fails if one byte moved.

## The model picker feels like a dock

Hover a model in the picker and the row grows toward the pointer, neighbours
easing up behind it — the magnifying-dock motion, done with transforms only so it
stays smooth. The row that is scaled keeps its text anchored left, so the name
never slides out from under the cursor.

While it is open you can now:

- **separate free from paid** — `All / Free / Paid` chips with live counts;
- **sort** by provider, name, or tier;
- **read the tier** off the row itself, with a right-click to override it (your
  answer wins, and the picker says so);
- **unlist a model** with the eye button — it moves to a collapsed "Unlisted"
  section rather than disappearing, and unlisted models stay out of the picker
  until you bring them back.

## Logos next to the codename

Every model row carries a mark: the model family's own glyph for the families
this build knows (OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, Qwen,
xAI, Cohere, and the smaller ones), and the **provider's logo** for anything
niche, exactly as you asked. Identified families fall back to their provider's
logo if the family glyph cannot be drawn. All of it is inline SVG — no favicon
round-trip, so it draws identically offline.

## The Providers tab starts empty

It used to list all eighteen providers whether you used them or not — packed, as
you said. Now it opens with an empty state: *"No providers yet"*, how many this
build ships, and one button. Adding opens a searchable catalog (search over
name, id and hint) where providers you have already added are marked, and adding
one only appends its id — it never touches a key you have stored.

Removing a provider asks one question first: **Keep my saved key** or **Remove
and delete the key**. Two buttons, no ambiguity.

## Every response says what it cost

Each reply now carries its token cost in the hover row under the message. The
numbers are the provider's own when the provider reports them — OpenAI's final
`usage` frame (the request asks for it with `stream_options.include_usage`),
Anthropic's `message_start` + `message_delta`, Gemini's `usageMetadata`,
Ollama's `prompt_eval_count` + `eval_count`. When a provider does not report
usage at all, the count is an estimate and is written as `≈`. The cost of every
tool round in one reply is summed into that one number, and the session total is
kept in the store. It can be turned off in Settings if you would rather not see
it.

## Verified before shipping

| Suite | Result |
|---|---|
| `scripts/update-test.mts` | **93 checks, 0 failures** — including a real network update from the published release into a real install, and a packaged 0.29.0 build booted and probed as `portable` |
| `scripts/models-test.mts` | **96 checks, 0 failures** |
| `scripts/render-check.mts` | **607 checks, 0 failures** |
| `scripts/nav-test.mts` | 20 checks, 0 failures |
| `scripts/share-test.mts` | 18 checks, 0 failures |
| `scripts/render-probe.mts` | 35 checks, 0 failures |
| `smoke` / `ui-test` / `sample-test` / `design-test` | 65 / 60 / 33 / 32, all pass |
| engine / workflow / background props | all pass |
| `tsc --noEmit` (frontend, backend) | clean |
| production build | clean |

The Developer bench was run from the terminal against this release's packaged
build — `mode: portable`, version `0.29.0-beta.1`, both create paths 200/201 in
single requests, nothing left on disk. The report is in
`downloads/bench-report-0.29.0-beta.1.txt`.

## Downloads

| Platform | File | Needs |
|---|---|---|
| Windows 10/11 x64 | `research-engine-0.29.0-beta.1-win-x64.zip` | Node.js 20+ |
| Linux x64 | `research-engine-0.29.0-beta.1-linux-x64.tar.gz` | Node.js 20+ |
| Windows installer | `Research.Engine_0.29.0-beta.1_x64-setup.exe` | nothing — per-user, no admin |
| Linux installer | `Research.Engine_0.29.0-beta.1_amd64.deb`, `…AppImage` | nothing |

Unpack a portable archive, run it once, and every release after this one arrives
through Settings → Updates. The installers are built by CI from this tag and
attached to this release; `INSTALLERS.sha256` is updated with their hashes once
CI has published them.

| File | sha256 |
|---|---|
| `research-engine-0.29.0-beta.1-linux-x64.tar.gz` | `8a1028e3dea397126c28bdd2e162980e512c503aa6871459c8937ba7183dce3e` |
| `research-engine-0.29.0-beta.1-win-x64.zip` | `6d227e4ed86bc55f0e13b7820c53d4e0cbd774bbf368701c0124c22b7a324c1c` |

Full hashes: `SHA256SUMS`. Data lives in `~/.research-engine`
(`%USERPROFILE%\.research-engine` on Windows), shared by every build — so an
update replaces code and nothing else.
