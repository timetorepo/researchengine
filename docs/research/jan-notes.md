# Notes on Jan (janhq/jan)

Source: the GitHub README (`raw.githubusercontent.com/janhq/jan/main/README.md`) and
the project site (`jan.ai`), read on the day of this note. I did **not** install or
run Jan, so the UI points below come from its site and from the community posts it
quotes, not from using the app. Check them against the app before copying anything.

## What it is

- An open-source (Apache 2.0) ChatGPT replacement that runs models on your machine.
- Desktop app on Tauri. Installers for Windows, macOS, Linux (deb, AppImage, Flatpak),
  Microsoft Store.
- Local models come from Hugging Face (Llama, Gemma, Qwen, gpt-oss and others).
- Cloud providers can be added alongside local ones (OpenAI, Anthropic, Mistral, Groq,
  MiniMax and others).
- Ships an OpenAI-compatible local server on `localhost:1337` for other apps.
- MCP (Model Context Protocol) integration for tools.
- Web search is available, per community posts.

## How it runs models

- The bundled engine is **llama.cpp**, built as a Tauri plugin (`tauri-plugin-llamacpp`).
  The build has engine variants for CPU, Vulkan, Metal, CUDA 12 and 13, and HIP/ROCm,
  picked with `JAN_ENGINE_VARIANT`.
- Community benchmarks in the site's posts compare MLX and llama.cpp on the same
  model: MLX about 90 tokens/s, llama.cpp with flash attention and a q8 KV cache about
  67 tokens/s, plain llama.cpp about 49 tokens/s. These are one person's runs, not a
  controlled test.

## UI, as described (not verified in the app)

- Big, quiet chat layout close to ChatGPT: a centred composer, a sidebar of threads,
  and few controls on screen by default.
- Community posts call it "simple and cute and pretty" and contrast it with
  "engineer-built" tools such as LM Studio and Ollama. That is the impression to test,
  not a fact.
- It uses a single primary accent and generous space, and it does not show model
  internals until asked.

## What to take for Research Engine

1. **Chat first, controls on demand.** Keep model and tool controls one click away, not
   on screen all the time. Research Engine already has many controls in the composer;
   test whether a quieter default helps.
2. **llama.cpp as a first-class provider.** Done in this change: a `llama.cpp` entry
   on `localhost:8080/v1`, using the existing OpenAI-compatible adapter.
3. **One local server, many apps.** Jan exposes its own API for other apps. Research
   Engine's backend already has a local API surface; document the port and the routes
   people can point at it.
4. **Benchmark honestly.** Jan's posts give tokens/s figures; Research Engine's
   bench (`docs/development.md`, the create-path bench) should report the same kind of
   numbers per engine, with the settings written next to them.

## What not to take

- Their brand and assets. Jan's logo, name and screenshots are theirs.
- Anything that needs their cloud account, server or download service.
