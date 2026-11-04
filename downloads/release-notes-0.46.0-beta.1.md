# Research Engine 0.46.0-beta.1

Work modes, a real thinking-effort slider, a leaner Design Studio, the Learn tabs, and the desktop shell built from CI on this tag.

## Work modes, with their own system prompts

- Research, Coding, Design and Math each carry a short, specific system brief on top of the master prompt. Research adds nothing, so its prompt is unchanged.
- The mode is inferred from where the request comes from: Design Studio is Design, the Math toggle is Math, a request inside a project is Coding, and everything else is Research. A caller can name a mode explicitly.
- Briefs stay short on purpose, because some models have much smaller context windows than others.

## Thinking-effort slider in the prompt bar

- The effort control is now a ChatGPT-style slider: a hairline track with a dot per step, a white thumb, and the step labels under it. The steps are each provider's own, so Medium, High and Max are the ones that provider offers.
- Drag anywhere on the track, or use the arrow keys, Home and End.

## Design Studio, simplified

- Removed the Board, Brief, Components, Inspiration and Prototype panels. Their jobs now belong to the mode prompts and the assistant.
- Removed the Full Throttle pipeline. Its four stages (Research, Premium, Design, Prototype) pointed at those panels, so it could not run without them. It is in the git history if you want it back.
- Ship stays. The panel files are still in the repository for the scripts that import them.

## Learn

- Learn is now four tabs: Study, Techniques, Path and Videos.
- Techniques: Active Recall with spaced repetition, Feynman explanations graded by your model, and dual coding with a picture description.
- Path: a step-by-step course built from a document, only when you press Generate. It falls back to on-device questions and says so.
- Videos: YouTube results for what you are studying now, playable inline.

## Themes and marks

- A Gemini theme joins Claude and ChatGPT. Claude's and Gemini's composers now take those products' shape, not just their colours.
- Anthropic, Gemini, NVIDIA, Ollama, Mistral, Perplexity and LM Studio use their official marks. OpenAI, Groq and Together keep their earlier marks.

## Onboarding and About

- The welcome step has a circuit-board explainer of how a question moves through the app.
- The developer card on About sits in a Spotlight Card.

## Desktop

- The Tauri shell is built by CI on this tag, for Windows (NSIS) and Linux. The build environment for this release could not compile Rust, so the installers come from the tag build and are checked there.
