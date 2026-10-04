<div align="center">

# Research Engine

A research, study, writing and coding workspace that runs on your computer.

[![Release](https://img.shields.io/badge/release-v0.40.0--beta.1-blue)](https://github.com/timetorepo/researchengine/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%C2%B7%20Linux%20%C2%B7%20Web-success)](#download)
[![No account](https://img.shields.io/badge/account-none%20needed-8b5cf6)](#your-work-and-privacy)

[Download](#download) · [Features](#what-you-can-do) · [Coding and Design](#coding-and-design) · [Privacy](#your-work-and-privacy) · [Development](#development)

</div>

---

## What Research Engine is

Research Engine brings answers, sources, reading, notes and project work into one local-first app. Search, read an article, keep it in your Library, turn a paper into a study session, write a draft, or open a code project and work on it with an AI assistant.

There is no Research Engine account or hosted workspace. Your library and projects are stored on the machine running the app. When you ask an AI provider a question, the request goes to the provider you chose; the app does not hide that connection behind its own account or subscription.

The app works with hosted providers and models on your own machine, including Ollama and LM Studio. You can explore the interface before configuring a provider, but real model answers need a model that is configured and available.

## What you can do

### Search, read and save

- Search the web, Wikipedia, your saved material and local documents from the Library.
- Open a Wikipedia result and keep its page id attached to the article request, so the reader opens the searched article rather than a similarly named page.
- Read RSS and Atom feeds as article titles, dates, summaries and links instead of a wall of XML.
- Save sources, notes and documents to collections, then return to them from the Library.
- Open a source in a readable view or use the browser view when a site needs its own JavaScript.

### Study and write

- Import PDF, Word, text and Markdown documents into a reading view with highlights, summaries and quizzes based on the source.
- Practice with multiple choice, true or false, fill-in, short answer, ordering and matching questions.
- Keep project notebooks, write long-form articles and export your library for backup.
- Turn answers and quiz results into shareable cards.
- Run parallel research agents or build repeatable tasks with the visual Workflows canvas.

### Bring a model you choose

Research Engine supports OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI, DeepSeek, Kimi, GLM, MiniMax, NVIDIA NIM, OpenRouter, Together, Inception, Xiaomi MiMo, Ollama, LM Studio and custom OpenAI-compatible endpoints. Model lists are fetched from the providers you configure.

Use the answer modes and provider settings to choose how a question is handled. Local models can keep inference on your machine; hosted providers receive the requests you send to them.

## Coding and Design

Coding and Design are workspaces for turning research into a working project.

### Coding workspace

- Open, create or import a local project. Browse and edit files in the editor, inspect Git status, run a preview and use the guarded terminal.
- File rows use locally bundled language marks for common formats such as HTML, CSS, JavaScript, TypeScript, React, C++, Python, Rust, Go and more. They do not call a logo service at runtime.
- Attach screenshots to the assistant and choose Build from screenshot/video. For a video, the browser samples up to six still frames locally; the original video is not uploaded by this feature. The selected model must support images to inspect the references.
- Open Dependencies to see direct packages from the project manifest. Node packages are checked against the project's `node_modules`; Python packages are checked in its `.venv` or `venv`. Other supported ecosystems show manifest entries.
- Browse optional AI-development recommendations, such as model SDKs, validation, tests and browser automation. Copying an install line does not run it; installs still go through the terminal's approval flow.
- Open MCP Marketplace for a bundled directory of stdio MCP server suggestions. Add saves a disabled configuration to the local app profile without starting a process. Connect explicitly starts the command to list its tools; an `npx` command may fetch its package on first use. A server becomes available to the assistant only after it responds to Connect, and only in Coding.
- Commands that modify the project require approval. Destructive commands are blocked, and the terminal is confined to the open project.

### Design workspace

- Inspect a running app's layout, colors, console and controls; capture screenshots, resize to a device width, and test real interactions.
- Ask the assistant to audit the screen, make a focused change and verify it against the running preview.
- Browse locally indexed UI components, open live previews for vendored demos, and save components to the persistent Saves view.
- Copy one command block from Saves to install the saved components and packages with npm, pnpm, yarn or bun.
- Add screenshots or sample local video frames as references before asking the assistant to recreate a screen.

## Your work and privacy

Research Engine stores its library and project files on the computer or server where it runs. A self-hosted server is still a server: if other people can reach it, protect access to that machine and its network.

When using a hosted AI provider, the message and any attached images needed for that answer are sent to that provider. Research Engine includes a Privacy Shield that can redact likely secrets from outbound text. Review a provider's own data policy for how it handles requests.

Video reference sampling happens in the browser. The selected still frames are treated as image attachments and sent only if you send them to a vision-capable provider. The original video is not sent by the sampler.

MCP server configurations and environment values are saved in the local app profile. Credential fields are hidden in the interface, but they are not described as encrypted storage. Values are passed to the configured local server process when it starts. Only connect servers you trust.

For backups, use Settings → Data or copy the Research Engine data folder. Deleting the app does not automatically delete that folder.

## Download

Choose the path that fits your machine. Check the latest release for the current filenames and checksums.

| Platform | Option | How to start |
|---|---|---|
| Windows 10/11 | Installer from the [latest release](https://github.com/timetorepo/researchengine/releases) | Run the installer, then open Research Engine from the Start menu. |
| Linux | `.deb` or AppImage from the latest release | Install the `.deb`, or make the AppImage executable and launch it. |
| Windows or Linux | Portable archive | Unpack it and run the included launcher. Node.js 20 or newer is required; Node.js 22.5 or newer provides persistent built-in database storage. |
| Browser | Installable web app | Run Research Engine on your machine or server, then open it in a Chromium-based browser. |
| Source | Clone and build | Follow [docs/development.md](docs/development.md). |

There is no macOS desktop build yet. Install and self-hosting instructions are in [docs/install.md](docs/install.md). Release files and their checksums are listed on the [GitHub Releases page](https://github.com/timetorepo/researchengine/releases).

## Development

Requirements: Node.js 20 or newer and npm. The repository uses npm workspaces for the frontend and backend.

```sh
git clone https://github.com/timetorepo/researchengine.git
cd researchengine
npm install
npm run dev
```

Useful checks and builds:

```sh
npm run build
npm run smoke
npm run api:json-test
npm run site:test
npm run site:build
```

The frontend includes focused regression scripts under `frontend/scripts/`. See [docs/HANDOFF.md](docs/HANDOFF.md) for the current test map and contributor notes. The application requires a provider to produce real model answers; builds and local-project tools can be explored separately.

## Questions

### Do I need an AI provider account?

You do not need a Research Engine account. To get real answers, configure a hosted AI provider or a model running on your own machine. The app's preview and sample surfaces can be explored without sending a request to a provider.

### Does Research Engine send my library to its developers?

No. There is no hosted Research Engine account or analytics service in the app. Requests you initiate can still go to the AI provider or search service you configure. Your local data stays with the machine running Research Engine unless you export or share it.

### Does it work offline?

You can open local projects, read saved documents and use local models offline. Live web search and hosted AI providers need a connection. An offline fallback can keep parts of the interface usable, but it is not a replacement for a configured model.

### Can I use MCP servers without opening a Coding project?

The marketplace can be opened from Coding, but MCP tools are exposed to the assistant only while a Coding project is open. Adding a listing only saves its configuration. Connecting it starts the configured process.

### Can I install components directly from Design Mode?

Design Mode saves the install commands in Saves. Copy the block, review it and run it in the project terminal when you are ready. The app does not install a component just because you saved it.

### Where is my data?

The default data folder is `~/.research-engine/` on Linux and other Unix-like Node environments, and `%USERPROFILE%\\.research-engine` on Windows. See [docs/install.md](docs/install.md) for alternate data directories and server setups.

## Credits and license

Research Engine is MIT licensed. See [LICENSE](LICENSE).

The interface uses React, Vite, Hono, Zustand, Motion, KaTeX, PDF.js, Mammoth, Lucide and other open-source packages. Vendored UI components retain their source notices and provenance records in the repository. See Settings → About for in-app credits.

[Latest release](https://github.com/timetorepo/researchengine/releases) · [Install guide](docs/install.md) · [Developer guide](docs/development.md) · [Website](website)
