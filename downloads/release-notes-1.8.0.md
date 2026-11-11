## 1.8.0 — An Apple-style interface, a floating tab bar, and faster saving

This release brings the look closer to Apple's own interfaces. Cards, switches and sheets follow the iOS 26 references the project studies, and the Settings pages group their switches the way iOS does. Chats, Workflows and Articles are now dense tables. An experimental floating tab bar is available, and saving to the database is much faster.

## What changed

- **Apple-style cards and sheets.** Cards have a larger corner and a softer depth. Sheets have one centred title, and their close button is a small grey round control.
- **Switches like iOS.** Every switch is the iOS size and turns green when on. Rows are at least 44px tall, so they are comfortable to tap.
- **Grouped Settings lists.** The switches on the Appearance, Updates and Developer pages sit in grouped lists, with hairlines inset from the edge. Saved memories are an Apple-style list too.
- **An experimental floating tab bar.** A glass capsule with Home, Chats, Coding, Library and Workflows at the bottom of the screen. It is off by default. Turn it on in Settings → Appearance. It is hidden on Chat and Coding, where the composer and the editor need the space.
- **Faster saving.** The database uses SQLite's NORMAL sync setting with WAL. In measurement, single-row writes became about 20 times faster. After a power cut you can lose the last few changes, but the database cannot be corrupted.
- **ChatGPT and Claude style chat.** This is the default chat layout.
- **Tables for Chats, Workflows and Articles.** Each list is a dense table, with actions that appear on hover.
- **Persistent memory.** Facts you keep are carried into later replies. The Memory tab lists them.
- **A new update card.** It has a large Update button, a README reader for the version you are looking at, and separate progress and completion views.
- **Headless browsing with Lightpanda.** A `browse_page` tool reads web pages without a full browser. A script installs the browser on request.
- **A bird's-eye graph.** Agents save to it. It has a preview window and a notice in chat.
- **An optional home picture.** It is off by default. The switch is in Settings → Appearance.

## Notes

- The Windows and Linux installers are attached to this release.
- The installers are about the same size as 1.7.0. The server runtime makes up most of the download. See `docs/research/installer-size.md` for the breakdown.
