/** Upstream skill packs vendored verbatim, plus the cross-model adapter. */
export type SkillPack = { id: string; name: string; description: string; files: string[]; origin: string }
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
 }
]
