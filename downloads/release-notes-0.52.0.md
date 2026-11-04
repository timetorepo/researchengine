## 0.52.0 — a calmer first run, connectors, documentation lookup, long sessions

- **The first screen is a page you scroll.** The welcome reads as a site: a hero, three promises, the three ways to work, and a close. Only the tear ticket at the end moves on, so reading the page never starts setup by accident.
- **Connectors in the sidebar.** Every app Composio supports is listed, with search and category chips. Connect an app right there. Choose *Automatic* (one id made on this device) or *My Composio account* (your own Composio user id, so connections you made there show up here).
- **Bots and the chat share connectors.** Both can use connected apps. A bot can also read current documentation with a `DOCS:` line.
- **Documentation lookup, built in.** The chat and the bots can look up current docs and code examples through Context7. It works with no setup. An optional key under Connectors raises the limits.
- **Roles by plain name.** Pick Researcher, Workflow, Builder and so on. The app chooses the matching members of the ECC library (71 roles in 8 families) from your request and your custom instructions.
- **Streaming words reveal smoothly.** The live part of an answer fades in word by word with SpaceUI's blur reveal. Finished paragraphs are shown as formatted text. Reduced motion shows the answer at once.
- **Long sessions stay fast.** Each part sent to the model has a limit. Old tool output is shortened, the newest turns are kept whole, and a note says when something was left out.
- **Storage that does not break.** When browser storage is full, the oldest chat detail is trimmed and a notice says what was trimmed, instead of saving failing.
- **A daily token budget.** Real provider tokens are counted per day across chat, bots and agents. New requests stop at the limit set in Settings → AIFlowEngine (default 2M, or no limit). The on-device engine is never counted.
- **The sidebar and the bots chat behave.** The collapsed sidebar keeps every button reachable. The bots conversation scrolls on its own instead of pinning to the last message.

Installers: `Research.Engine_0.52.0_x64-setup.exe` and `Research.Engine_0.52.0_amd64.deb`. Digests are in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Existing bots, chats, projects and settings are kept. The first run shows the new welcome page only on a fresh install.
