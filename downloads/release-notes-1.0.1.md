## 1.0.1 — Connect opens in your browser, smoother long chats

- **Connect opens in your browser.** Press *Connect* on an app and Composio's sign-in opens in your default browser, the one where you are already signed in. If it cannot open, a link appears to click.
- **Notices are alerts.** Saved settings and new update notices show as alerts at the top of Settings. A ready update has its own alert in the update window.
- **Two-factor codes use a six-box input.** Setup, turning it off and unlocking the vault use the same code boxes.
- **Delete everything stays deleted.** A save that was still pending could write chats back after a wipe. Saves now stop at the wipe.
- **Smoother long chats.** Chat history is saved at most every 400 ms, not on every streamed token. Pending changes are saved when the window is hidden or closed.
- **Server caches stay bounded.** Link previews and robots.txt checks keep a fixed number of entries.

Installers: `Research.Engine_1.0.1_x64-setup.exe` and `Research.Engine_1.0.1_amd64.deb`. Digests are in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Saved bots, chats, projects and settings are kept.
