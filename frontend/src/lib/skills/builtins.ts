import type { Skill } from '@/types'

export const builtinSkills: Skill[] = [
  {
    id: 'sk-summarize-url', name: 'Summarize URL', builtin: true, category: 'Research', icon: 'link',
    description: 'Fetch and summarize the key points of any URL.',
    promptTemplate: 'Summarize the content at {{url}} in {{length}} bullet points, leading with the single most important takeaway.',
    params: [
      { name: 'url', type: 'string', description: 'The URL to summarize' },
      { name: 'length', type: 'number', description: 'Number of bullets', default: '5' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-extract-citations', name: 'Extract citations', builtin: true, category: 'Research', icon: 'quote',
    description: 'Pull every citation-worthy claim from a passage.',
    promptTemplate: 'Extract all citation-worthy claims from this text. For each, give the claim, its strength, and what would verify it:\n\n{{text}}',
    params: [{ name: 'text', type: 'string', description: 'Paste the passage' }],
    outputFormat: 'json',
  },
  {
    id: 'sk-compare-sources', name: 'Compare two sources', builtin: true, category: 'Research', icon: 'scale',
    description: 'Structured comparison of two sources on one topic.',
    promptTemplate: 'Compare these two sources on "{{topic}}". Cover: agreement, disagreement, methodology quality, and which is more reliable.\n\nSource A: {{sourceA}}\n\nSource B: {{sourceB}}',
    params: [
      { name: 'topic', type: 'string' },
      { name: 'sourceA', type: 'string' },
      { name: 'sourceB', type: 'string' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-translate-technical', name: 'Translate technical passage', builtin: true, category: 'Writing', icon: 'languages',
    description: 'Translate dense technical writing into clear prose.',
    promptTemplate: 'Translate this technical passage into {{audience}}-level language. Preserve every factual claim; flag any jargon you must keep.\n\n{{passage}}',
    params: [
      { name: 'passage', type: 'string' },
      { name: 'audience', type: 'enum', options: ['general audience', 'undergraduate', 'executive', 'expert in another field'], default: 'general audience' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-quiz-from-notes', name: 'Generate quiz from notes', builtin: true, category: 'Study', icon: 'help-circle',
    description: 'Turn any notes into a quiz.',
    promptTemplate: 'Create a {{count}}-question quiz from these notes. Mix multiple choice and true/false. Include an explanation per answer.\n\n{{notes}}',
    params: [
      { name: 'notes', type: 'string' },
      { name: 'count', type: 'number', default: '8' },
    ],
    outputFormat: 'json',
  },
  {
    id: 'sk-lit-review', name: 'Write literature review section', builtin: true, category: 'Writing', icon: 'book-open',
    description: 'Draft a literature review section from sources.',
    promptTemplate: 'Write a literature review section on "{{topic}}" synthesizing these sources into themes, not a list. Academic tone, ~{{words}} words.\n\n{{sources}}',
    params: [
      { name: 'topic', type: 'string' },
      { name: 'sources', type: 'string', description: 'Paste abstracts or notes' },
      { name: 'words', type: 'number', default: '400' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-equation-to-code', name: 'Convert equation to code', builtin: true, category: 'Code', icon: 'sigma',
    description: 'Turn a mathematical expression into working code.',
    promptTemplate: 'Convert this equation into idiomatic {{language}} with a short test case:\n\n{{equation}}',
    params: [
      { name: 'equation', type: 'string' },
      { name: 'language', type: 'enum', options: ['Python', 'TypeScript', 'Rust', 'Julia'], default: 'Python' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-design-pass', name: 'UI/UX design pass', builtin: true, category: 'Design', icon: 'palette',
    description: 'Rebuild a screen to a real design bar — hierarchy, rhythm, contrast, states, motion — and score it honestly.',
    promptTemplate: `You are a senior product designer who also writes the code. Work on: {{target}}

Method, in order:

1. **Say what the screen is for.** One sentence: who uses it, what they came to do, what the primary action is. Everything below is judged against that sentence.

2. **Name the current problems, ranked by impact.** Be specific and measurable — "the primary button is the same weight as the secondary one", "body text is 13px at 1.35 line-height", "four different greys carry three different meanings". No vague adjectives.

3. **Rebuild against this bar, and state the numbers you chose:**
   - Hierarchy: exactly one primary action; headings differ in size AND weight; the eye has an obvious path.
   - Type: a scale with a ratio (e.g. 12/14/16/20/26/34), body 15–17px, line-height 1.5–1.7, measure 45–75 characters, and a single family for UI.
   - Space: a 4px base with 8/12/16/24/32/48 in use — related items closer than unrelated ones, consistent padding inside and between groups.
   - Colour: contrast ≥ 4.5:1 for body and ≥ 3:1 for large text/icons, one accent doing one job, an intentional grey ramp (not five accidental greys), never colour alone to carry meaning.
   - States: hover, focus-visible, active, disabled, loading, empty, error and long-content — all designed, not left to the browser.
   - Density and alignment: aligned edges, equal optical spacing, tap targets ≥ 44px on touch, nothing off by one pixel, nothing centred that should be left-aligned.
   - Motion: 150–300ms, one easing family, entrances fade+rise ≤ 12px; motion must explain a change or it is deleted; respect prefers-reduced-motion.
   - Content: real labels, real empty-state copy, real numbers — never lorem ipsum or "Item 1".

4. **Implement it** in the existing stack and style, keeping the diff reviewable. Delete the patterns you replaced.

5. **Score your own result** out of 10 on: hierarchy, typography, spacing, colour/contrast, states, motion, accessibility, coherence. Any axis below 8 gets another pass — say what you changed on the second pass. If a problem is out of scope, list it under "not fixed".

Do not describe improvements you have not made. Do not claim a check you did not run.`,
    params: [
      { name: 'target', type: 'string', description: 'The screen, component or file to improve' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-zero-hallucination', name: 'Zero-hallucination pass', builtin: true, category: 'Code', icon: 'shield-check',
    description: 'Audit or fix code with every API, path and claim verified against the real project — never invented.',
    promptTemplate: `Work on {{target}} with one rule above all others: **nothing you state may be unverified**.

Procedure:

1. **Read the ground truth first.** Open the files involved and the dependencies they rely on (the project's own node_modules, its lockfile, its types). Do not describe, import or call anything you have not seen.

2. **Build a facts table** as you go — for every symbol you are about to depend on: name, where you saw it (path:line), and whether it exists as you think. Anything you cannot place in that table does not go in the code.

3. **Flag every class of hallucination you check for:** package names and versions, function signatures and argument order, props and options, default values, environment variables, config keys, CLI flags, file paths, endpoints and their methods, regex behaviour, and any "probably works" assumption about a framework's lifecycle or CSS.

4. **Fix only what you can justify.** Each change: the file, the line, what was wrong, the exact edit, and what proves it. If a fix needs a fact you do not have, say what you would need instead of writing a plausible guess.

5. **Verify by running, not by narrating.** Use the project's own commands (tests, lint, typecheck, the dev server) and report their real output. If you could not run anything, say "unverified" explicitly — that is a better answer than an invented confirmation.

6. **End with an uncertainty list:** what you could not verify, what you assumed, and what would change your conclusion if it turned out differently.

Never state a test result, a version number or a benchmark you did not observe. Never write "this should work" as if it were evidence.`,
    params: [
      { name: 'target', type: 'string', description: 'File, feature or question to verify' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-no-filler', name: 'No-filler implementation', builtin: true, category: 'Code', icon: 'eraser',
    description: 'Implement exactly what is needed and nothing else — no TODOs, stubs, dead code or decorative complexity.',
    promptTemplate: `Implement or clean up: {{target}}

The bar: **every line earns its place.**

While writing:
- Complete implementations only — no TODOs, no "left as an exercise", no stub returns, no placeholder comments, no commented-out code left behind.
- Nothing dead: every import used, every parameter read, every branch reachable, every state handled (empty, loading, error, long input, permission denied).
- Nothing duplicated: reuse what exists; if you add a helper, put it where the project keeps helpers and give it an honest name.
- Nothing decorative: no abstraction with one caller, no config for a value used once, no defensive try/catch that hides the failure, no "for future use".
- Smallest full fix: prefer editing what exists over parallel new code; when you replace something, delete the thing you replaced.
- Match the project's conventions (naming, structure, error style, formatting) instead of importing your own.

Before you hand it over, run this checklist against your own diff and report the result line by line:
1. Every import in the diff is used.
2. Every new function is called from somewhere reachable.
3. Every branch can actually be taken.
4. Every error path does something meaningful.
5. No placeholder text, mock data or example.com in the final code.
6. The diff contains nothing that is only there to look thorough.
7. The feature works end to end — and here is the command or assertion that proves it.

Then state the line count added vs removed. If the number is large, justify each file you touched.`,
    params: [
      { name: 'target', type: 'string', description: 'What to build or clean up' },
    ],
    outputFormat: 'natural',
  },
]

export const SKILL_CATEGORIES = ['Research', 'Writing', 'Study', 'Code', 'Design', 'Analysis', 'Custom']
export const SKILL_ICONS = ['wand', 'link', 'quote', 'scale', 'languages', 'help-circle', 'book-open', 'sigma', 'flask', 'sparkles', 'zap', 'target', 'palette', 'shield-check', 'eraser']
