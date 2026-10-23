<div align="center">

<h1 align="center">Research Engine</h1>
<p align="center"><em>An open-source research app that runs on your own computer.</em></p>

### Ask a question, get a sourced answer, keep the rest to yourself.

**Search, read, study, write, code and design, with every page, note, quiz and draft staying on your machine.**

[![Release](https://img.shields.io/badge/release-v0.52.0-blue)](https://github.com/timetorepo/researchengine/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%C2%B7%20Linux%20%C2%B7%20Web-success)](#-download)
[![No account](https://img.shields.io/badge/account-none%20needed-8b5cf6)](#your-work-stays-yours)
[![Made by](https://img.shields.io/badge/made%20by-dnishh-111111)](https://github.com/timetorepo)

[Download](#-download) · [What's new](#whats-new) · [What it does](#what-it-does) · [Only here](#only-in-research-engine) · [Your data](#your-work-stays-yours) · [Questions](#questions-people-ask)

</div>

---

<img src="https://i.ibb.co/DDzfyQ05/1.png" alt="Research Engine, screenshot 1 of 5" width="100%" />

<img src="https://i.ibb.co/7dZGxJJh/2.png" alt="Research Engine, screenshot 2 of 5" width="100%" />

<img src="https://i.ibb.co/PGDs16jk/3.png" alt="Research Engine, screenshot 3 of 5" width="100%" />

<img src="https://i.ibb.co/Nk8B5hG/4.png" alt="Research Engine, screenshot 4 of 5" width="100%" />

<img src="https://i.ibb.co/v4dDdkm8/5.png" alt="Research Engine, screenshot 5 of 5" width="100%" />

---

## What Research Engine is

Research Engine is a workspace for people who think for a living. It is a library, a study desk and a writing room in one app. You can ask a question and get an answer that shows where it came from. You can drop in a paper and get a study session. You can keep notes, draft articles, send a small team of agents at a topic, and turn what you learned into something you can share.

It is built for **researchers, students, teachers, analysts, journalists and writers**, and for anyone who would rather not hand unfinished thinking to a company. Nothing you write goes to us, because there is no "us" server. You run the app, and your files sit in a folder you can open, copy, back up or delete.

You do not need to be technical. For real AI answers you need one thing: an account with an AI provider you already use, or a model running on your own machine. If you have neither yet, the app still works with a built-in offline model, so you can look around first.

**Download it, open it, start asking.** No sign-up, no subscription, no dashboard.

---

## What's new

The last few releases, newest first. Full notes are on the [releases page](https://github.com/timetorepo/researchengine/releases).

- **0.52.0: a calmer first run, connectors, documentation lookup, long sessions.** The welcome is a page you scroll, and only the tear ticket moves on. Connectors lists the apps Composio supports, under Automatic or your own Composio account. The chat and the bots can look up current docs through Context7 with no setup. Roles are picked by plain name, and the app chooses the ECC members that fit. Long sessions stay fast, with capped context and an optional daily token budget.
- **0.51.1: answers that keep going.** Answers no longer stop partway through. With *Raw stream* turned on, every word now appears as it arrives, and the answer keeps going while the tab is in the background. If a provider goes quiet, the chat says so and keeps what came in. Errors that show up after an answer has started are displayed instead of silently dropped. Citations are checked properly, and `[1]` in an answer opens its source. The active tab in Bots slides between tabs.
- **0.51.0: bots on the web, group chats, handoffs.** A bot with *Web access* can search and read pages, and it shows every step under its reply. Put two to six bots in a group chat and they can call each other in by name. A project can be handed from one bot to another with a written brief. Sixteen skills and eight agent roles from ECC are built in.
- **0.50.0: backgrounds, study rewards and meetings.** Two animated backgrounds. A streak and XP for real study time, not for opening the app. Learn has a demo that runs offline. Library has a Videos tab, and a Meetings tab that transcribes on your device with Whisper.
- **0.49.0: keys and folders.** An authenticator app can guard your key vault. Two looks for the Library shelf. Exam moved into Learn.
- **0.48.0: the desktop app.** Tauri-based installers for Windows and Linux. Updates now back up your library before they start.

---

## What it does

### Find things, and know where they came from

| | |
|---|---|
| **Answers with sources** | Answers come with numbered citations you can open. You can also ask for an answer drawn only from a page, a PDF or your own notes. |
| **Search that just works** | Web search is ready the moment you install. There is no key and no setup. It checks for a search service on your own machine first, then falls back to public ones. |
| **Five ways to think** | **Flow** for a normal, well-paced answer. **Search** to look things up first. **Quality** for careful, deeper answers. **Math** for worked steps and proper formulas. **Replicate** to rebuild a technique on your own data. One click each. |
| **Bring any AI you like** | 17 providers are built in, including OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI, DeepSeek, Kimi, GLM, MiniMax, NVIDIA, OpenRouter, Together and Inception's Mercury. Ollama and LM Studio run models on your own machine, and a "custom" slot takes anything else. |
| **Free models first** | Turn on **Free routing** and questions go to a free model you already have access to. If that one is busy, the app quietly tries the next. |
| **See what it cost** | Every answer reports its token use, so a month of reading does not surprise you. You can also choose how long to wait on each provider before giving up. |
| **Attach what you have** | Images for models that can see, PDFs and Word files to read, and files from your computer as context. |
| **Feeds that read cleanly** | An RSS or Atom feed shows up as a proper reader page with channel, items, dates and text, not raw XML. |
| **Stable article links** | The reader follows article ids, so a search result opens the article it promised. |

### Study it properly: Read & Quiz

| | |
|---|---|
| **A paper becomes a study session** | Upload a PDF, Word file, text or Markdown document. You get a clean reading view with highlights, an AI summary and a quiz written from the actual text. |
| **Six question types** | Multiple choice, true or false, fill in the blank, short answer, put in order, and match the pairs. There is a timer, streaks and a score you can act on. |
| **Highlights that feel instant** | Select a sentence and it is marked straight away, with a sweep like a highlighter. Two buttons offer the next step: quiz this passage, or undo. |
| **Steps that look like steps** | Lines that are clearly steps, lists and "Step 2 —" runs become numbered steps and bullets as you read. No extra AI call, no extra cost. |
| **Practice exams for 12 countries** | **Learn → Exam** runs a practice civics test for the country you pick, including the United States and Indonesia. It is practice material, not an official test. While it runs, the app locks itself until you finish. The lock applies only inside this app. |
| **A study timer that knows what it's timing** | It lives in the top bar and tracks Quiz, Reading or Coding, with pause, play, skip and reset. |

### Write it up

| | |
|---|---|
| **Articles** | A long-form editor with AI blocks, headings and quotes, and real images from Wikimedia Commons, so a draft looks finished without leaving the app. |
| **Notebooks** | A private notebook per project. You can chat against only what is in it, which means your sources and not the whole internet. |
| **Share Studio** | Turn an answer or quiz result into a picture to post. Pick Liquid glass, Gradient, Solid, or your own background. Copy it or save it. |
| **Humanize** | One click rewrites a reply so it reads like a person wrote it. Every fact, number and citation stays where it was. The new text shows in green, and the original is one hover away in red. |
| **Export everything** | A versioned ZIP of your whole library, and an import that merges it back in. |

### Send a team of agents: Agent Flood

Point several assistants at one topic and let them work in parallel. Pick a squad (Deep Research, Software Design and more), give them an objective, and watch them file findings into a shared scratchpad while a budget keeps the cost in view. At the end you get one briefing instead of five separate answers.

### Put routines on rails: Workflows

A visual canvas for things you repeat. Add a trigger, a few AI steps, some logic, a transform and an output. Build it with drag and drop, run it whenever you like, read the run history, and share a workflow as one file.

### Build things: Coding and Design

For the days when research turns into making something.

- **Coding workspace.** Your project files open in a real editor. An AI pair edits alongside you, runs commands behind an approval gate, and keeps a record of every change. Files wear their language's mark (JavaScript, TypeScript, React, Python, C++, Rust, Go and more).
- **Dependencies, in view.** A panel reads the open project's `package.json` and shows what is installed, what is declared, and whether a lockfile pins it. Next to it is a short list of dependencies people often use to build AI features.
- **MCP servers in one click.** Recommended Model Context Protocol servers (filesystem, fetch, memory, GitHub, Puppeteer, search and more) install straight from the coding workspace and are tested against the live bridge. The registries are linked for everything else.
- **Screenshot to code.** Drop in a picture of an interface and a vision model writes it back as a single HTML file with Tailwind, or as a React component. Screen recordings work too: the panel samples frames and rebuilds the final state.
- **Design mode.** The running app can show itself to the AI. It reads the real layout, colours and console, takes screenshots, clicks and types through the screen, and then checks a fix with an assertion. You can also press every control yourself as a one-click test.
- **UI components.** Browse ready-made components from the popular registries, preview them live in design mode, save the ones you like, and copy one command that installs everything you saved.
- **Starting points.** Create a project, upload a ZIP, or press **Try a sample app** for a page with deliberate bugs to practise on.

**Changes, like a proper git client.** The coding dock's Changes tab lists staged and unstaged files with their line counts. Each diff opens with line numbers and added lines in green. You can stage all, revert all (a second click confirms, because it throws work away), or commit. Nothing is pushed.

### Connect your own accounts

Research Engine can read the places your work already lives: **Google Drive, Gmail, Google Calendar, GitHub, Notion, Slack**, and files on your computer. Paste a token once. The app tests it against the real service before trusting it, and tells you which account it is signed in as.

Once connected, you can search these from the chatbox and attach a result to your question. The assistant can also look things up itself. If an account isn't connected, it says so instead of guessing. Tokens are encrypted on your machine and only ever sent to the service they belong to.

### Talk to it

Dictation has three engines: your browser's own, a transcription service you already pay for, or a Whisper server on your own machine if the audio is confidential. Hold the mic to talk, or click to start and stop. Your words land in the composer, ready to send.

### Run several sessions at once

Every chat streams on its own, so one can think while you read another. Press **Alt + Shift** (you can rebind it in Settings → Shortcuts) and your sessions fan out as cards. Press again to step through them, and Enter to open one. A task that needs isolation can run in its own Docker container or multipass VM, and the chat says so.

### Effort, and thinking you can read

The effort pill in the composer uses each provider's own words: Claude's low through max, and ChatGPT's Instant through Max. Models that think show their reasoning in a collapsible block above the answer. For Claude, the app asks for a summary of the reasoning, not the raw chain of thought.

### Bring your chats with you

Settings → Data imports a ChatGPT export (the zip or its `conversations.json`) or a Claude export. Each conversation becomes a session in your history. Everything is read in your browser. For ChatGPT, the branch you ended on is the one that comes across.

### Make it work your way

- **Skills.** Reusable standards you can attach to any task. Three ship with the app: a **design pass** that scores its own work and must clear 8/10, a **zero-hallucination pass** that checks claims against the real project, and a **no-filler pass** that won't leave TODOs or placeholders behind. Write your own in plain language.
- **Personas.** 836 system prompts from a public archive of frontier-product prompts. The flagship ones are available offline, and Settings → Personas syncs the full archive once. Attach one to a chat and the model answers in that voice, on top of your own instructions.
- **Skill packs.** The Apple-design pack from emilkowalski/skills, and an annotated-illustration pack with an adapter for models other than Codex. Attach them per chat.
- **MCP servers.** Settings → MCP Servers and the coding panel share one list. The catalog holds 7,729 servers from an open index. The 116 with a verified run command install in one click, and the rest open their project page.
- **Master prompts.** The instructions behind every answer are readable and versioned. You can change them, compare them and roll them back.
- **Tasks.** A checklist you share with the assistant, pinned to the top so it works on what matters to you.
- **Meetings, on your device.** Library → Meetings records from your microphone and transcribes in roughly 20-second parts with Whisper, on this computer. Type notes alongside the recording. Pick a template (general, 1:1, interview, lecture or study session) and the notes follow its sections. If the microphone drops, the transcript says so with a timed line instead of a silent gap. Leaving the tab does not stop a recording, and the recording stays in your browser until you delete it. Speakers are not separated, and the app does not join calls. The first transcription downloads the speech model once from the Hugging Face hub.
- **YouTube in the Library.** Library → Videos keeps a video with its title, your notes and a start time. Clicking one opens a player inside the app, using YouTube's privacy-enhanced embed. Learn → Videos finds videos for what you're studying, and you can save any of them with one click.
- **Calendar, on your device.** A month grid and an agenda. Events you create stay in this browser. You can import an `.ics` file, or add a Google Calendar with its secret iCal address (Google Calendar → calendar settings → Integrate calendar). That address is read-only. The app fetches it through its own backend, and only Google's calendar host is allowed. Daily, weekly, monthly and yearly recurring events are expanded. You can export your events as one `.ics` file for Google Calendar to import. Nothing is written back to Google.
- **Bots.** A bot is a named teammate with a job, a face (one of 18 shapes from bot-avatars, MIT), its own thread, and a memory you can see and edit. Type `remember: …` to save something. Bots can run routines on a schedule, at least five minutes apart, with up to 50 per bot and the last 20 runs kept. Replies come from the model you chose. Routines run only while the app is open, and *Pause all routines* stops them without touching your chats. Design notes live in `docs/research/grok-bot-notes.md`.
- **Bots on the web, with the steps shown.** Switch on *Web access* for a bot and it can search and open pages. Each step appears under the reply as *How it answered*, and the pages it read are listed as sources. Search goes to **SearXNG**. We recommend running it yourself with Docker (`docker run -d -p 8080:8080 searxng/searxng`), then pasting `http://localhost:8080` into Bots → Settings. You'll need to enable the JSON format in its `settings.yml`. Pages are read directly by default. For sites that need JavaScript, run a headless browser container such as `browserless/chrome` and paste its address. It must expose `POST /content`.
- **Group chats and handoffs.** Put two to six bots in a group. The first member answers your message, and a bot brings in the next teammate with `@Name`. A round stops after six bot turns, when nobody is called, or when a bot passes. A **project** has a brief and a log. Its owner can hand it to another bot by writing a brief for them. The log keeps who held it and when.
- **Moving your bots.** Bots → Settings exports every bot, group and project to one JSON file, with threads and memories in plain text. Importing never overwrites what you already have.
- **Agent roles from ECC.** 16 skills and all 71 agent roles from [affaan-m/ecc](https://github.com/affaan-m/ecc) (MIT) are built in. The skills join a chat's skill packs. You pick a plain role such as *Researcher*, *Workflow* or *Builder*, and for each question the app picks the ECC methods that fit it and the bot's (or chat's) own instructions. The code is vendored at one pinned commit. See `docs/research/ecc-integration.md`.
- **Connectors.** A *Connectors* section in the sidebar lists the apps [Composio](https://composio.dev) supports. Connect an account there with one project key, and both the main chat and the bots can read from it and act on it. Bots can also search your local accounts with `FIND`. See `docs/research/composio-connectors.md`.
- **Photos sent together.** Two or more photos in one message open in a carousel with arrows and dots, not as a stack.
- **Backgrounds that move.** Settings → Appearance has two: an animated silk-like gradient, and *Etched Accretion*, a crimson and silver black hole that drifts toward your pointer and flares when you press. Both run behind the home screen and chats.
- **A streak for real work.** The home screen shows your streak as a week of ticks, plus today's focus minutes against a goal. A minute counts only when the tab is visible, you have pressed, typed or scrolled in the last two minutes, and you are somewhere you are working: a lesson, coding, a source, a draft or a workflow. Five active minutes keep the day. Milestones at 3, 7, 14, 30 and 100 days earn a badge and XP. Leaving the app open on an idle page earns nothing.
- **A wallet of cards.** You earn cards as you use the app, such as your first quiz, and you can customise them. Optional resource and FPS readouts can sit on screen if you want them.
- **Learn → Path has a demo.** No document needed. *See the demo* builds a sample path about photosynthesis on this device, and none of it is saved to your library.
- **Two looks for folders.** The Library shelf can show folders as blue SmoothUI folders, or as frosted-glass folders that lean toward your pointer and fan out their files when opened. Your choice is remembered on this device.
- **A bug finder for developers.** With developer mode on (Settings → Developer), press **Alt+Shift+B** and click any element. It writes a bug report with the page, the element's selector and text, and a line of your own. You can attach a screenshot you took yourself. The app does not take screenshots.
- **Looks.** Light, dark, Catppuccin, Solarized, Nord, high contrast and more. Gradients that animate into a new theme instead of snapping. Glass, frosted or solid surfaces. Your own background image. A dock-style sidebar. A profile avatar generated from your name.
- **Privacy Shield.** One switch with three settings: **No Privacy**, **Privated** (the default, which scrubs secrets from anything leaving your machine), or **Top Secret** (nothing leaves except to the AI provider you chose, and search runs offline from what you already have).
- **Feels like an app.** A command palette (`Ctrl/Cmd + K`), right-click menus, pages and tabs that animate when they change, live toasts, and a desktop app that opens like any other program.

### Keeps itself up to date

Press update and the app downloads the new version. It **checks the file against its published fingerprint before unpacking anything**, installs it, and if the new version won't start, it puts the old one back. Your library is never part of that swap.

**Before any update starts, your data is backed up.** The desktop app copies the database (a consistent snapshot, even while the app is open) and your settings into a `backups/` folder inside your data folder, and keeps the newest five. If that copy can't be made, the update doesn't start. The desktop installer keeps the same app identity, so an update installs over the old version, and your data folder sits outside the program. The in-place upgrade has not yet been tried on a machine with an older install. CI builds both installers and the backup logic is tested. You can also hand the app a file you downloaded yourself, or point it at a private source if you run a fork.

**It tells you when there's a newer version.** It says so once per version, in a popup with the release notes, the download and its progress. You restart when it's ready. "Skip this version" is remembered. Nothing installs without you pressing the button.

---

## Only in Research Engine

Plenty of apps answer questions. These are the parts you won't find elsewhere, and the reason this one exists:

1. **Answers that read like writing.** A pacing engine shapes each reply as it streams: clause by clause, with pauses at punctuation and whole code blocks revealed at once. A long answer reads like prose, not a slot machine. There are four settings, from raw to cinematic.
2. **Study text formatted by the app, not by another AI call.** Things like `:dot:` runs, "Step 2 —" and repeated numbering become real numbered steps and nested bullets the moment they're displayed. No extra request, no extra cost, and no chance the model rewrites your source.
3. **Humanize that keeps the facts.** One click rewrites a reply in plain human prose and shows both versions. Numbers and citations are untouched. It only works on chat text, never inside code.
4. **A quiz engine, not a quiz toy.** Six question types generated from your own document, with a timer, streaks, a shareable result card, and a study timer that knows you're in Quiz mode.
5. **Agent Flood.** A squad of agents on one objective, working in parallel, filing into a shared scratchpad under a visible token budget, and ending in one briefing. On a laptop.
6. **A design workspace where the AI can see the screen.** It reads real geometry, colours and console output, takes screenshots, clicks and types through your running app, resizes it to phone width, and then proves a fix with an assertion.
7. **Screenshot to code, including video.** A screen recording becomes working code. Images map to HTML and Tailwind or React, and a recording is sampled into frames so the AI rebuilds where it ends up.
8. **MCP as a one-click shelf.** The coding workspace recommends useful tool servers, installs them into your config, tests them live, and points to the registries for the rest.
9. **Free routing.** Questions go to a free model you already have, a local one first, and move on by themselves when a model is busy. It's a switch, not a provider you have to choose.
10. **An updater that works for a private project.** A read-only token or a plain manifest link is enough. The fingerprint is checked before a single byte is unpacked, and an automatic rollback runs if the new version won't start.
11. **Integrations the assistant can actually use.** Real accounts with real sign-in (Drive, Gmail, Calendar, GitHub, Notion, Slack and your own files) are searchable from the chatbox and readable by the agent. "You haven't connected this yet" is a valid answer, and a made-up one is not.
12. **Your work, one folder away.** Notes, chats, quizzes, articles, workflows and skills all live in one folder on your disk. Back it up by copying it. Move it to a new computer by copying it.
13. **Local-first, with a shield.** Encrypted keys, no account, no telemetry, and three privacy settings that decide what is even allowed to leave the machine.
14. **A workspace, not a chat box.** Reader, quiz, notebooks, articles, agent teams, workflows, a coding desk and a design studio, in one app you own.

---

## ⬇ Download

Pick **one** of these. They all run the same product.

| Your situation | What to get | How |
|---|---|---|
| **Windows 10/11** | `Research.Engine_…_x64-setup.exe` | Download it from the [latest release](https://github.com/timetorepo/researchengine/releases), run it, then open Research Engine from the Start menu. No admin password needed. |
| **Linux (Debian or Ubuntu)** | `Research.Engine_…_amd64.deb` | `sudo apt install ./Research.Engine_…_amd64.deb`, then launch it from your applications menu. The .deb is the only Linux installer built right now. |
| **Windows, no installer** | `research-engine-…-win-x64.zip` | Unzip it anywhere and run `research-engine.cmd`. Needs Node.js 20 or newer. See [docs/install.md](docs/install.md). Offered only when the release includes it. |
| **Linux, no installer** | `research-engine-…-linux-x64.tar.gz` | Unpack it, run `chmod +x research-engine-linux-x64/research-engine`, then start it. Needs Node.js 20 or newer. Offered only when the release includes it. |
| **Just want to look** | Nothing to install | Any Chromium browser (Chrome, Edge, Brave, Arc) can install the running app as a normal program. See [docs/install.md](docs/install.md). |
| **A home server or NAS** | Docker, or the portable build | One install the whole household reaches over HTTPS. See [docs/install.md](docs/install.md). |
| **You like tinkering** | The source | `git clone`, `npm install`, `npm run build`, `npm start`. See [docs/development.md](docs/development.md). |

Portable builds, when a release has them, are kept in [`downloads/`](downloads) with their checksums in `SHA256SUMS`, along with a report from a real test run on that exact build.

> **Want to check the file before you run it?** Every release lists the SHA-256 fingerprint of each installer, as GitHub recorded it. Compare it with what you downloaded and you'll know it's the file we built. The current digests are in [`downloads/INSTALLERS.sha256`](downloads/INSTALLERS.sha256).

### Your first five minutes

1. **Open it.** A short welcome tour asks for a theme and a language. You can change both later, or skip.
2. **Add an AI provider, or skip for now.** Paste a key from a provider you already use, point the app at a model on your computer, or press *Skip* and explore with the built-in offline model.
3. **Ask something.** Type a question in the big box on the home screen and press Enter. The suggestions come from your own recent reading.
4. **Try one thing you'll really use.** Upload a paper to **Read & Quiz**, open **Agent Flood** for a topic you've been meaning to survey, or connect Drive or Notion under **Settings → Integrations**.

---

## Your work stays yours

Everything Research Engine writes lives in **one folder** on the machine running it:

| Where | What's in it |
|---|---|
| `~/.research-engine/` (Windows: `%USERPROFILE%\.research-engine`) | Your whole library: chats, notebooks, documents, quizzes, articles, skills and workflows |
| `keys.enc` | Your provider keys, encrypted with your passphrase |
| `backups/` | Snapshots taken before each update (the newest five are kept) |
| Your own backups | A versioned ZIP from **Settings → Data**, or just a copy of the folder |

**Locking your keys.** Two layers guard the key vault. The **vault passphrase** encrypts every provider key with AES-GCM, using a key derived with PBKDF2. The optional **authenticator lock** (Settings → Security) adds a six-digit code from an app such as Google Authenticator, Stratum, Aegis or 1Password. Once it's on, unlocking the vault takes both the passphrase and the current code. Setup shows a QR code, or the same key typed by hand for apps that can't scan. You type a code once to confirm setup, so a bad setup can't lock you out. Five wrong codes make the box wait 30 seconds.

The limit is worth knowing. The authenticator secret lives on this device, encrypted with your passphrase. That stops someone who has only the device, or only the passphrase, from using your keys. It doesn't stop someone who has both. A second device or a hardware key would be stronger, and that isn't part of this release.

**What leaves your computer.** The messages needed to get an answer, sent to the AI provider *you* set up. Your search queries, sent to the search service you chose (SearXNG at the address you set, or the public instances if you set none). Pages a bot with web access opens, fetched from the sites themselves or through the browser container you run. And only if you use these features: saving a YouTube link asks YouTube for the video's title and thumbnail, and playing a video loads YouTube's embed. The first meeting transcription downloads the Whisper model from the Hugging Face hub. A Google Calendar address makes this computer fetch that calendar from Google once per sync, and the address is kept only in this browser. Meeting audio is never sent anywhere. A transcript goes to your configured model only when you press *Write notes*. That's the full list. No telemetry, no analytics, no crash reports, and no update checks that carry your data.

**What never leaves.** Your library, your files and your keys. With **Privacy Shield** on its default setting, anything that looks like a secret is scrubbed before an outbound message can include it.

The desktop app, a browser tab and a portable copy on the same machine all read the same library. Deleting the app never deletes your data.

---

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| `Ctrl/Cmd + K` | Command palette: jump anywhere, do anything |
| `Alt + Shift` | Session switcher. Step with the same keys, Enter to open (rebind in Settings → Shortcuts) |
| `Ctrl/Cmd + N` | New chat |
| `Ctrl/Cmd + Shift + N` | New chat with web search |
| `Ctrl/Cmd + B` | Show or hide the sidebar |
| `Ctrl/Cmd + M` | Math mode on or off |
| `Ctrl/Cmd + F` | Answer pacing (AIFlowEngine) on or off |
| `Ctrl/Cmd + Shift + A` | Agent Flood |
| `Ctrl/Cmd + Shift + S` | Settings → Providers |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + Shift + F` | Full screen in the Coding or Design studio (the chat becomes a floating pill) |
| `Ctrl/Cmd + S` | Save, inside the studios |
| `B` / `J` | Sidebar / side panel, inside the studios |
| `/` | Show this list |
| `Esc` | Close whatever is open |

In the Quiz, `Space` or `Enter` moves to the next question. On the Workflow canvas, `Ctrl/Cmd + Z` undoes, `Ctrl/Cmd + Y` redoes, `Ctrl/Cmd + D` duplicates a step, and `Delete` removes one.

---

## Questions people ask

**Do I need an AI account?** Not to try it. The built-in offline model runs every part of the app, so you can explore. For real answers, add a provider you already pay for, or a model on your own machine. You pay them directly, not us.

**Is my work private?** It stays on your computer. Nothing is uploaded to us, because there is no "us" server. The app and your library live on your machine. See [Your work stays yours](#your-work-stays-yours).

**Is this like Perplexity?** The answer experience is similar: questions in, sourced answers out. The difference is that this one runs locally, keeps your library on your disk, and adds a study desk, a writing room, agent teams and a design studio. The "Perplexity" theme is a look-alike and nothing more. This is an independent project.

**What does "beta" mean here?** It works and it's tested, but it may still change shape between small versions. Take a backup from Settings → Data now and then, and you're covered.

**Can several people share one copy?** Yes. Run it once on a home server or a spare computer. Everyone opens it in a browser, with their own screen and their own chats, sharing one library.

**Does it work offline?** With the built-in model and content you already have, yes, entirely. Live search and paid models need a connection, by definition.

**Something's broken, or it feels old.** Go to **Settings → About**. It shows the version you're running and whether a newer one exists. On an older build, press update. If you built it yourself, it shows the one command to run.

---

## Credits & license

**MIT licensed.** Copyright (c) 2026 dnishh. See [LICENSE](LICENSE). Use it, change it, ship it inside your own product, or sell it. Just keep the copyright notice with the copy.

Made by **dnishh**, in the open, with no company behind it.

The public website in [`website/`](website) is the same story for people who will never open GitHub: the features, why it's free, and the download. It's a static Vite page built from the SmoothUI, Aceternity UI and shadcnspace registries. Each vendored file's source and digest are recorded in `website/scripts/site-sources.json`. It deploys to Netlify from the root `netlify.toml`, with no functions and no configuration. `npm run site:build` builds it, and `npm run site:test` runs its 150 checks.

The interface uses components from [React Bits](https://reactbits.dev), [HeroUI](https://www.heroui.com), [Aceternity UI](https://ui.aceternity.com), [skiper/ui](https://skiper-ui.com) and [Watermelon UI](https://ui.watermelon.sh). It also includes [Border Beam](https://beam.jakubantalik.com), [Orbs](https://orbs.jakubantalik.com) and [Voice](https://libraries.dev/voice) by Jakub Antalik, the [Blobatar](https://blobatar.dev) avatars, and design references from [Refero](https://styles.refero.design). Everything is credited inside the app under **Settings → About**.

Built on excellent open source: React, Vite, Hono, Zustand, Motion, esbuild, KaTeX, pdf.js, Mammoth, Lucide and Tauri. Their licenses travel with their packages.

<div align="center">

**If Research Engine is useful to you, a star helps other people find it.** ⭐

[Download the latest release](https://github.com/timetorepo/researchengine/releases) · [Install guide](docs/install.md) · [For developers](docs/development.md) · [Prebuilt archives](downloads) · [The website](website)

</div>
