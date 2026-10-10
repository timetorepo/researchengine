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

Research Engine itself is MIT. See `LICENSE` at the repository root.
