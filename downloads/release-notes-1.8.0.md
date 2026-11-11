## 1.8.0 — An Apple-style interface, a floating tab bar, and faster saving

This release makes the app look and feel closer to Apple's own interfaces. Cards, toggles and sheets follow the iOS 26 references the project studies, and the Settings pages group their switches the way iOS does. The main screens are laid out as tables, and a new experimental floating tab bar is available. Saving to the database is also much faster.

## What changed

- **Apple-style cards and sheets.** Cards use a larger corner and a softer depth. Sheets have one centred title, and their close button is a small grey round control, as in Apple's sheets.
- **Toggles like iOS.** Every switch is the iOS size, is green when on, and rows are at least 44px tall for comfortable tapping.
- **Grouped Settings lists.** The switches on the Appearance, Updates and Developer pages sit in grouped lists with hairlines inset from the edge. Saved memories are an Apple-style list too.
- **An experimental floating tab bar.** A glass capsule with Home, Chats, Coding, Library and Workflows at the bottom of the screen. It is off by default; turn it on in Settings → Appearance. It is hidden on Chat and Coding, where the composer and the editor need the space.
- **Faster saving.** The database now uses SQLite's NORMAL sync setting with WAL, which made single-row writes about 20 times faster in measurement. A power cut can lose the last few changes, but the database cannot be corrupted.
- **ChatGPT and Claude style chat.** It is the default chat layout.
- **Tables for Chats, Workflows and Articles.** Each list is a dense table with actions on hover.
- **Persistent memory.** Facts you keep are carried into later replies, and the Memory tab lists them.
- **A new update card.** A large Update button, a README reader that loads the release notes, and progress and completion views.
- **Lightpanda for headless browsing.** A browse_page tool reads web pages without a full browser, and it has its own installer step.
- **A bird's-eye graph.** Agents save to it, with a preview window and a notice in chat.
- **An optional home picture.** Off by default, with a switch in Settings → Appearance.

## Notes

- The desktop installers for Windows and Linux are built by the tag's CI run and attached to this release.
- The installer size is unchanged: the server runtime is most of it. See `docs/research/installer-size.md`.
