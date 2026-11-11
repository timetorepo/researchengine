## 1.3.0 — Sign-in tracking, Pipedream, council and local models

- **Closing a sign-in window fails the connect.** Press Connect, close the window, and Research Engine says the sign-in window closed, with a button to start again. This works in the browser and in the desktop app, where the sign-in opens in your default browser.
- **A finished sign-in closes its own window.** When Composio or Pipedream sends you back, the window closes and the new connection shows up in Connected. Research Engine no longer opens a second copy of itself.
- **Pipedream, next to Composio.** Marketplace → Pipedream. Save your Pipedream OAuth client, project ID and environment once. They are encrypted with your vault passphrase when the vault is on. Then connect apps from Pipedream's catalogue.
- **Council mode.** Ask up to four models the same question, and one answer weighs their drafts. If one model fails, the others still answer.
- **Local models from Hugging Face.** Official, Abliterated and Optimized categories, a fit check for your computer, and a link to each model's page. You can download from Settings → Models or from the model picker.
- **Images and audio from chat.** Available on models that can call tools.
- **Advanced: a self-hosted Composio endpoint.** For a gateway you run yourself. Most people should keep the hosted API.
- **Settings → Coding** replaces Coding & MCP, with a command time limit. MCP servers moved into Marketplace.
- **Rich-card reference.** `docs/technical/17-rich-cards.md` lists all 277 card variants.

Not tested live yet: Hugging Face search, a real Ollama download, the self-hosted Composio route, and Pipedream against a real project. The code paths are covered by tests with stand-ins.

Installers:

- `Research.Engine_1.3.0_x64-setup.exe`, sha256 `a8539a28d93b24edc6087e3c2f1c8985e3c853778dbd456426cc355bcdea99d6`
- `Research.Engine_1.3.0_amd64.deb`, sha256 `ab44e5fa71dfcc1a5ab708888b8c2dd5b723accb492219b19743659f99b4095c`

Digests are also in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Saved bots, chats, projects and settings are kept. Council mode and local models are off until you set them up.
