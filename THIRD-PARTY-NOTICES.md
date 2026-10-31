# Third-party notices

Research Engine vendors agent skill packs into
`frontend/src/content/skills/upstream/` so they work with no network call and
no `npx` in the user's path. Each pack keeps its own licence, and the notices
below travel with the code, as those licences require. The `origin` file in
each pack directory names the repository it came from, and
`scripts/vendor-skills.mjs` re-fetches them.

Nothing in a vendored pack has been rewritten. What upstream ships is what the
app runs.

## Packs

| Pack | Source | Licence |
| --- | --- | --- |
| `animate`, `animate-expo`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `break-ui`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `mobile-native`, `pick-ui-library`, `prototype`, `review-animations`, `write-swift` | https://github.com/emilkowalski/skills | MIT |
| `ian-xiaohei-illustrations` | https://github.com/tojileon/ian-xiaohei-illustrations-en | MIT |
| `find-skills` | https://github.com/vercel-labs/skills | MIT |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills | MIT |
| `anti-ui-slop` | https://github.com/davepoon/buildwithclaude | MIT |
| `impeccable` | https://github.com/pbakaus/impeccable | Apache-2.0 |
| `taste-skill` | https://github.com/Leonxlnx/taste-skill | MIT |

`trojan-detector` is Research Engine's own skill, MIT, distributed with this
repository. Its three-check shape follows the free `/trojan` detector guide
published by Chen Media at https://chen.media/, which is credited in the skill
itself.

## MIT licence text

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Apache Licence 2.0

`impeccable` is licensed under the Apache License, Version 2.0. The full text
is at https://www.apache.org/licenses/LICENSE-2.0. Section 4 requires
redistributors to give recipients a copy of the Licence, which this file and
the `origin` marker in the pack directory satisfy; any NOTICE file upstream
ships must be reproduced alongside it.

## Strix

The nine Strix skills under `frontend/src/content/skills/upstream/` are the work
of the Strix team, licensed under the Apache License, Version 2.0. Source:
https://github.com/usestrix/strix — https://www.strix.ai/

Strix itself, the penetration testing engine those skills describe, is not
vendored or modified here. The app invokes the `strix` command line as the
process it is, through the `/api/strix` routes. It needs Docker running and an
LLM key, both of which are the user's to supply, and it reaches the network by
design: it is a tool for attacking a target. The coding workspace shows the
target, the instruction and the report; it does not score, summarise or
second-guess Strix's findings.

Apache-2.0 §4(b) requires that any modified files carry prominent notices. None
of the nine `SKILL.md` files are modified — they are vendored verbatim, and each
carries an `origin` marker recording the repository, the revision and the
licence.

Research Engine itself is MIT. See `LICENSE` at the repository root.

## Components from Untitled UI React (MIT)

`frontend/src/components/ui/untitledui/carousel-base.tsx` is the carousel from
the open-source Untitled UI React set, Copyright (c) 2025 Untitled UI, MIT
licence, taken from `components/application/carousel/carousel-base.tsx` at
https://github.com/untitleduico/react. Only its import of the class-name helper
was changed (`frontend/src/lib/cx.ts` carries the same merge behaviour). It
depends on `embla-carousel-react` (MIT).

The Untitled UI `video-player`, `calendar` and `metrics` blocks are not in that
open-source repository, and the Untitled UI CLI that would fetch them could not
be reached from the build environment. None of their code is in this repository.

## Agent roles and skills from ECC (MIT)

Source: affaan-m/ecc (Everything Claude Code), pinned at commit 76aaa77df6adc5b889e689007bf99b9a4f74af34.
Copyright (c) 2026 Affaan Mustafa, MIT licence. Vendored: sixteen skills (`frontend/src/content/skills/upstream/`,
catalogued in `catalog.ts`) and all 71 agent roles (`frontend/src/content/ecc/agents.ts`, metadata in `meta.ts`). Refreshed by
`scripts/vendor-skills.mjs --only …` and `scripts/vendor-ecc-agents.mjs`. The text is upstream's, unchanged except
for a length cap on the agent roles, which is marked in the text.

## bot-avatars (MIT)

Source: Libraries.dev by Jakub Antalik (https://libraries.dev/bots), npm package `bot-avatars` 0.2.2, MIT licence.
Used for the drawn faces of Bots.


## Agent harness design, from DeepSeek Harness and Cordis (MIT)

The agent harness in `backend/src/harness/` follows the architecture of
DeepSeek Harness: a plugin kernel in which every capability is a plugin that
claims a stable service key, boot profiles that choose which plugins stack, an
append-only session log, and a minimal tool set.

- **DeepSeek Harness**, https://github.com/deepseek-ai/deepseek-harness,
  Copyright (c) 2026 DeepSeek, MIT licence.
- **Cordis**, the plugin kernel it is built on, by Shigma,
  https://github.com/shigma/cordis (vendored by DeepSeek Harness under
  `vendor/cordis`), Copyright (c) 2021-present Shigma, MIT licence.

The kernel in `backend/src/harness/kernel.ts` is an independent, smaller
TypeScript implementation of the ideas above. It does not copy Cordis's source.
The DeepSeek Harness MIT licence text is reproduced below, as its copyright
notice requires.

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
