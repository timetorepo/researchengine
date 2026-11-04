## 1.4.0 — Interactive answers, a coding task loop, an agent harness, usage and council roles

- **Interactive answer cards.** An answer can include a card you can explore: a small ui-card block, checked and clipped before it is shown. Cards never run scripts or HTML, and their links must be https.
- **Coding task loop.** In a coding project the assistant works in small steps, with a read-only Review intent that looks at changes without touching files. Each new project starts with an `AGENTS.md` file for your own rules, and the assistant reads it on every turn.
- **Agent harness (a subset).** A plugin kernel with tools (bash, editor, files), a session log with fork and search, a model client, and an agent loop, with `minimal` and `standard` profiles, behind `/api/harness`. This is a reimplemented subset of DeepSeek Harness, not a full port. Its MIT notices are in THIRD-PARTY-NOTICES.md.
- **Clearer connector failures.** When Pipedream cannot sign you in, the message now says why. Apps listed in Pipedream's catalogue but not among its managed sign-ins need your own OAuth client for that app, added in your Pipedream project.
- **Download updates on launch.** Settings → Updates has a new switch. A newer release is downloaded and verified in the background on the portable build. It is installed only when you press Restart now.
- **A shorter Settings rail.** Tabs are grouped into You, AI, Data and safety, App, and an Advanced group that opens with one click. Tab names are unchanged, so links to a tab still land on it.
- **The assistant knows the app.** It knows the settings sections, the in-app actions it can take, the coding tools, how council works, and how connector sign-in works, and it is told not to invent controls.
- **Import a skill from GitHub.** Paste a link to a GitHub folder in Settings → Skills. The files are read and scanned before anything is saved.
- **Council roles.** Each council member can be a Researcher, a Critic or a Drafter, and the chair weighs their drafts by role.
- **Usage page.** Settings → Usage shows tokens per day for the last year, as a column chart with a hover tooltip.
- **Stat card component.** A dot-grid card for any percentage, with a comparison to a previous value.
- **Fixes.** A failed-connect message is no longer hidden under the top bar. Accordion separators are grey. Focus rings and outlines show only while you browse with arrow keys.

Not tested live yet: the Pipedream and Composio failure messages against a real provider account, the Usage page and the grouped Settings in a browser, and the harness routes over HTTP. The code paths are covered by tests.

Installers: built by the release workflow. Their digests will be added to `downloads/INSTALLERS.sha256` once the desktop build has run.

Upgrade: nothing to migrate. Saved bots, chats, projects and settings are kept. Council roles default to Researcher, Critic and Drafter in order. Download on launch is off until you turn it on.
