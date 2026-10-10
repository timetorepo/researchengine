/** Upstream skill packs vendored verbatim, plus the cross-model adapter. */
export type SkillPack = { id: string; name: string; description: string; files: string[]; origin: string; license?: string; credit?: string }
export const SKILL_PACKS: SkillPack[] = [
 {
  "id": "animate",
  "name": "animate",
  "description": "Build an animation from scratch, making the decisions in the order that determines whether it feels right — should it animate at all, what purpose, which tool, which properties, which curve and duration, how it interrupts, how it exits. Writes the implementation. Use when asked to animate something, add motion, make a component feel alive, or build a transition. For critiquing existing motion use review-animations; for auditing a whole codebase use improve-animations.",
  "files": [
   "RECIPES.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "animate-expo",
  "name": "animate-expo",
  "description": "Build animations in React Native and Expo, making the decisions in the order that determines whether they feel right — should it animate, which thread it runs on, which properties, spring or timing, how the gesture hands off, how it degrades. Writes the implementation with Reanimated, Gesture Handler, Expo Router and expo-haptics. Use when animating anything in an Expo app, adding gestures, sheets, screen transitions, press feedback or haptics, or fixing motion that stutters on device. For web animation use `animate`.",
  "files": [
   "RECIPES.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "animation-vocabulary",
  "name": "animation-vocabulary",
  "description": "Reverse-lookup glossary that turns a vague description of a web animation or motion effect into its exact term (\"the bouncy thing when a popover opens\" → Pop in; \"the iOS rubber-band scroll\" → Rubber-banding). Use when the user asks \"what's it called when…\", or describes a motion effect without knowing its name and wants the right word to prompt an AI or designer with. For naming an effect, not designing or building one.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "apple-design",
  "name": "apple-design",
  "description": "Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "ask-sonner",
  "name": "ask-sonner",
  "description": "Guide to Sonner, the React toast library — install and wire up the Toaster, pick the right toast() call, promise and loading toasts, updating, dismissing and persisting toasts, styling, theming and icons, positioning and multiple toasters. Use when working with Sonner or troubleshooting it — toasts that don't appear, appear twice, lose their styles, ignore Tailwind classes, sit behind a modal, or don't follow dark mode.",
  "files": [
   "API.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "break-ui",
  "name": "break-ui",
  "description": "Try to break a piece of UI by feeding it worst-case data — long names, unbreakable emails, one-letter names, missing fields, huge counts, zero items, long labels, non-Latin text, emoji, extreme numbers — then render it behind a \"Demo data / Worst case\" toggle and report everything that broke, with the fix for each. Use when the user asks to stress-test, break, or find edge cases in a component or screen, or to \"try the worst case\". For visual design critique use emil-design-eng; for motion use review-animations.",
  "files": [
   "CATALOG.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "emil-design-eng",
  "name": "emil-design-eng",
  "description": "This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, and the invisible details that make software feel great.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "find-animation-opportunities",
  "name": "find-animation-opportunities",
  "description": "Search a codebase or UI for places that don't animate but should, and reject everything that shouldn't. Read-only; it proposes motion with exact values, it does not implement it. Use when the user asks \"what could be animated here?\" or wants to \"make this feel more alive\". For fixing existing animations, use improve-animations or review-animations instead.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "improve-animations",
  "name": "improve-animations",
  "description": "Survey a codebase's animation and motion code as a senior motion advisor, then produce a prioritized audit and self-contained implementation plans for other agents (or cheaper models) to execute. Read-only on source code — it plans improvements, it does not apply them. Use when the user asks to \"improve the animations\", \"audit the motion\", \"make this app feel better\", or wants a roadmap of animation fixes rather than a review of a single diff.",
  "files": [
   "AUDIT.md",
   "PLAN-TEMPLATE.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "mobile-native",
  "name": "mobile-native",
  "description": "Make a web app feel native on a phone — the small CSS and meta-tag fixes that separate \"a website in a browser\" from something that feels installed. Covers sticky hover states, tap highlight flashes, the 100vh bug, inputs that zoom the page, laggy taps, pull-to-refresh hijacking scroll, content under the notch, long-press selecting button text, carousels that scroll the wrong way, mismatched status bars, and the rule that you test on real hardware. Use when a web app is being built for or reviewed on mobile, when something \"works in Chrome but feels wrong on my phone\", when building a PWA, a bottom sheet, a carousel, a full-screen layout, or any touch interaction. For motion itself use animate; for React Native use animate-expo.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "pick-ui-library",
  "name": "pick-ui-library",
  "description": "Pick the right library for a given frontend task from a curated, opinionated list — numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts, state, styling, and more. Only runs when explicitly invoked; it does not trigger on its own.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "prototype",
  "name": "prototype",
  "description": "Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual picker so you can flip through them live and promote the one that feels right. Only runs when explicitly invoked; it does not trigger on its own.",
  "files": [
   "PICKER.md",
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "review-animations",
  "name": "review-animations",
  "description": "Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering philosophy. Default to flagging; approval is earned.",
  "files": [
   "SKILL.md",
   "STANDARDS.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "write-swift",
  "name": "write-swift",
  "description": "How to write modern Swift well — modeling with value types, Swift 6 data-race safety and approachable concurrency (@concurrent, main-actor-by-default, actors, task groups), protocols and generics (some vs any), API design, performance and ARC, Swift Testing, macros, and the modern language features agents don't know about yet. Use when writing, reviewing, or migrating Swift, or when a concurrency error, a hang, a data race, a retain cycle, or a performance problem needs fixing.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "emilkowalski/skills"
 },
 {
  "id": "ian-xiaohei-illustrations",
  "name": "ian-xiaohei-illustrations",
  "description": "Generate Ian-style English article illustrations. Use for user requests that need weird, clean, hand-drawn body images, article illustrations, shot lists, or edit/remove-title tasks for English articles, posts, blogs, Notion docs, workflows, methods, structures, states, metaphors, or viewpoints. Default to the Xiaohei IP, pure white hand-drawn look, sparse red/orange/blue annotations, and a clean but imaginative visual style. Do not use for generic illustration, PPT, commercial brand art, children's cartoons, or non-Xiaohei image requests unless the user explicitly asks for Ian/Xiaohei style.",
  "files": [
   "MODEL-ADAPTERS.md",
   "SKILL.md",
   "agents/openai.yaml",
   "origin",
   "references/composition-patterns.md",
   "references/prompt-template.md",
   "references/qa-checklist.md",
   "references/style-dna.md",
   "references/xiaohei-ip.md"
  ],
  "origin": "tojileon/ian-xiaohei-illustrations-en"
 },
 {
  "id": "find-skills",
  "name": "find-skills",
  "description": "Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "vercel-labs/skills",
  "license": "MIT",
  "credit": "Vercel — the open agent skills tool (npx skills)"
 },
 {
  "id": "web-design-guidelines",
  "name": "web-design-guidelines",
  "description": "Review UI code for Web Interface Guidelines compliance. Use when asked to \"review my UI\", \"check accessibility\", \"audit design\", \"review UX\", or \"check my site against best practices\".",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "vercel-labs/agent-skills",
  "license": "MIT",
  "credit": "Vercel — Web Interface Guidelines"
 },
 {
  "id": "anti-ui-slop",
  "name": "anti-ui-slop",
  "description": "Stop coding agents from shipping generic UI. Use UIZZE's 800,000+ real web and iOS screens to build product-specific interfaces, define a design contract, cover required states, and run a hard finish gate. Use for web or iOS UI design, implementation, redesign, critique, and pre-ship review in Codex, Claude Code, Cursor, Copilot, and other coding agents.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "davepoon/buildwithclaude",
  "license": "MIT",
  "credit": "Dave Poon — buildwithclaude, anti-ui-slop"
 },
 {
  "id": "impeccable",
  "name": "impeccable",
  "description": "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.",
  "files": [
   "SKILL.md",
   "origin",
   "reference/hooks.md"
  ],
  "origin": "pbakaus/impeccable",
  "license": "Apache-2.0",
  "credit": "Paul Bakaus — Impeccable, the design language for AI harnesses"
 },
 {
  "id": "taste-skill",
  "name": "design-taste-frontend",
  "description": "Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "Leonxlnx/taste-skill",
  "license": "MIT",
  "credit": "Leonxlnx — taste-skill"
 },
 {
  "id": "trojan-detector",
  "name": "trojan-detector",
  "description": "Scan a file for hidden instructions aimed at an AI before any model reads it. Finds text a person cannot see (white on white, zero-width characters, HTML comments, one-pixel fonts) and sentences that order a model to ignore its rules, reveal secrets, or send data off the machine. Use when importing a skill, opening an untrusted document, or before letting a model read a file you did not write.",
  "files": [
   "SKILL.md",
   "origin"
  ],
  "origin": "chen.media",
  "license": "MIT",
  "credit": "Chen Media — the /trojan detector guide (chen.media)"
 }
]
