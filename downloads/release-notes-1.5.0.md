## 1.5.0 — Coding that builds from a prompt, typefaces, llama.cpp, and screen-aware assistant

- **Coding works like Codex.** Type "make X" in Coding and the assistant creates the project and starts building it. You no longer click to create a project first.
- **The assistant knows the screen you are on.** Each part of the app (Chats, Coding, Settings and others) gives the assistant a short system prompt that says where you are, so its answers fit the screen.
- **More typefaces.** Settings → Appearance has Default, Inter, Geist, Plus Jakarta Sans, Bricolage Grotesque, Poppins, Lora and System. The default stack is unchanged.
- **llama.cpp as a provider.** Point Research Engine at a local `llama-server` (OpenAI-compatible, default `http://localhost:8080/v1`, no key) for models that run faster on your machine. Start it with `llama-server -m model.gguf --port 8080`.
- **Cubes grid background.** A new background option in Settings → Appearance.
- **Hover-image links.** Links in AI replies show a preview image on hover, using the same props as the Aceternity component.
- **Smaller fixes.** Longer chat histories keep older messages unless the whole history is over budget. The app no longer fails when WebGL is unavailable. Test suites run headless with a CSS stub loader.
- **Notes on Jan.** `docs/research/jan-notes.md` records what the open-source llama.cpp runner (janhq/jan) offers and what it could teach Research Engine.

Not tested live yet: the llama.cpp entry against a running `llama-server` in the browser, and the Coding build from a prompt on the packaged desktop app. The code paths are covered by the DOM and render suites.

Installers: built by the release workflow on the tag. Their digests will be added to `downloads/INSTALLERS.sha256` once the desktop build has run.

Upgrade: nothing to migrate. Saved bots, chats, projects and settings are kept. The typeface defaults to the existing stack until you choose another.
