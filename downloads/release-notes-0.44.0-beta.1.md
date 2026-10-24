# Research Engine 0.44.0-beta.1

The sessions round. Several chats can run at once without getting in each other's way, and Alt+Shift moves between them the way an app switcher does. Models get the effort controls their own providers document, and the chain of thought a model exposes is readable in the chat. Settings and the coding workspace now share one MCP server list, and the prompts and skills that shape a model's voice ship inside the app.

The r31 suite (90 checks) and the earlier suites all pass, and CI builds the Windows and Linux installers from this exact commit. Live provider calls, Docker containers and VMs were not exercised in our test environment, so those are the first things to try on your machine.

## Sessions that do not collide

- Alt+Shift opens a switcher of your sessions as cards. Press it again to step, Enter to land, Escape to dismiss. You can rebind it in Settings, under Shortcuts.
- Each chat streams on its own, so one can think while you read another.
- A session can run inside its own Docker container, or inside a multipass VM, when a task needs isolation. The chat says so when it does, and the AI can start one itself.

## Effort, and the thinking you can read

- The effort pill in the composer speaks each provider's own vocabulary: Claude's low, medium, high, xHigh and max as Anthropic documents them, and ChatGPT's Instant through Max.
- For Claude the app asks for a summary of the reasoning. Anthropic's docs say that text is always a summary, never the raw chain of thought.
- A model that exposes its reasoning shows it in a collapsible block above the answer.
- If a model refuses one setting, the app sends the request again with only that setting stepped down, so you still get an answer.

## Bring your chats with you

- Settings, then Data: import a ChatGPT export (the zip, or its conversations.json) or a Claude export.
- Each conversation becomes a session in your history. For ChatGPT, the branch you ended on is the one that comes across.
- The file is read in your browser. Nothing is uploaded.

## One server list, and the prompts behind the voices

- MCP servers: Settings, then MCP Servers, and the coding panel share one list. The catalog holds 7,729 servers from an open index. The 116 with a verified run command install in one click, and the rest open their project page. Chats get the same servers.
- Personas: 836 system prompts from the public archive of frontier-product prompts. The 24 flagship ones open offline. Settings, then Personas, syncs the full archive once, which needs git. Attach a persona to a chat and the model answers in its voice, on top of your own instructions.
- Skill packs: the full Apple-design pack and the other emilkowalski skill packs, plus the annotated-illustration pack's instructions and references, with an adapter for models other than Codex. Attach them per chat.

## The coding dock

- The Changes tab lists unstaged and staged files with their line counts. Each diff opens with line numbers, and added lines are green.
- Stage all, revert all and commit are one click each. Revert all asks for a second click, because it discards work, and it only resets tracked files. Untracked files are never deleted from there.
- The status bar shows the branch and how many files have changed.
- The AI can open Read and Quiz, Coding, Sessions or Library when that would help you.

## Lighter to load

- Long chats render their last 60 messages, and the older ones are one click away.
- The MCP catalog and the persona manifest load only when their tabs open, so the first screen does not pay for them.

## Known limits

- Docker sandboxes need Docker running. VM sandboxes need multipass installed. Without them the app says so instead of pretending.
- The persona archive is about 28 MB. It syncs from GitHub and is not bundled in the app.
- mcpservers.org lists more servers than the catalog holds, so the panel links out to it.
- Servers that only offer a hosted endpoint open their project page. The app runs local servers only.
- The portable archives were not rebuilt for this release. The installers are the release.
