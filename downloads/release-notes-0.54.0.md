## 0.54.0 — one Composio identity, artifacts, live bot replies

- **Connectors uses your Composio user id.** The Automatic identity is gone. Save your Composio user id in Connectors, and the apps you connect are filed under it. Connect stays off until an id is saved, and the card says why. The *My Composio account* tab that did not switch is removed with it.
- **Code opens as an artifact.** Code blocks with three or more lines have an *Artifact* button. It opens a side panel with the code and, for HTML, SVG, JavaScript and React, a live preview served from this machine. The preview runs in a sandbox with no access to the app.
- **Bot replies stream in.** One-to-one bot replies and group-room replies appear as they are written. Tool lines stay hidden until the answer is ready.
- **Chain of thought streams and folds.** The thinking section streams while the model thinks, folds once when the answer starts, and the answer is what you read next.
- **Source chips show the site's icon.** Each source shows its site's favicon, fetched as soon as the answer arrives.
- **`/` and `@` work anywhere in the message.** Type them at the caret, not only at the start. `@` lists the apps you connected in Connectors too.
- **ChatGPT, Gemini and Claude Markdown render properly.** ChatGPT's `\[ \]` and `\( \)` math, Gemini's `[cite: n]` markers and Claude's cite tags are turned into the forms the chat already shows, and ChatGPT's citation tokens are dropped or linked.
- **The expanded sidebar header no longer crowds.** The logo gives up room first, so the notification bell and the collapse button keep their size and their clicks.

Installers: `Research.Engine_0.54.0_x64-setup.exe` and `Research.Engine_0.54.0_amd64.deb`. Digests are in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Saved integration credentials, bots, chats, projects and settings are kept. Connections made under the old automatic id on this device do not show any more: save your Composio user id and connect the apps again, or check them in your Composio dashboard.
