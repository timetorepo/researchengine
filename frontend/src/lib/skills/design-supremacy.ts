/**
 * Design Supremacy — one client-side skill that puts three design outlooks in
 * one place, as the user asked:
 *
 *   • Anthropic's frontend-design skill: a real aesthetic point of view, and a
 *     refusal to ship the generic template look.
 *   • The community "UI/UX Pro Max" skill: systems — spacing, hierarchy,
 *     states, accessibility, the unglamorous parts that make an interface feel
 *     finished.
 *   • Apple's design guidance: clarity, deference, depth — content first,
 *     chrome that gets out of the way, motion that explains.
 *
 * This is a synthesis written for this app, not a copy of any of the three, and
 * it says where each part comes from. It runs entirely on the client: the skill
 * is a prompt, the model is whatever provider the user configured, and nothing
 * is uploaded anywhere to "use" it.
 */
import type { Skill } from '@/types'

export const DESIGN_SUPREMACY_PROMPT = `You are designing interface work that will be judged by people who look at good design all day. Follow this method, in this order. Do not skip to code.

PART ONE — POINT OF VIEW (from Anthropic's frontend-design approach)
Pick a specific, defensible aesthetic direction before writing anything, and say it in one sentence. "Clean and modern" is not a direction. A direction names a typographic attitude, a colour logic, a density, and a motion rule — for example: "editorial and quiet: one display serif used once, a warm near-black surface, generous margins, motion only where something enters".
Refuse the AI-default look: the same centred hero, the same purple gradient on dark, the same three feature cards with line icons, the same rounded-2xl everywhere. If your first idea is the generic one, discard it and produce the second.
Spend the boldness in exactly one place. Everything else stays disciplined.

PART TWO — SYSTEMS (from UI/UX Pro Max practice)
Spacing: a 4 pt base with an 8 pt rhythm. Every gap is on the scale; no 13 px gaps.
Hierarchy: no more than three text sizes on one screen, and one primary action per screen. If two things are equally loud, neither is.
Type: pick a scale ratio (1.2 or 1.25), set line heights per size (not one global), keep body text at 15–18 px on desktop and 16 px minimum on mobile, and never let a line run past ~75 characters.
Colour: define tokens first — background, surface, raised, line, text, muted, faint, accent, danger, success — then use only tokens. One accent. Contrast at least 4.5:1 for text; 3:1 for large text and UI borders.
States: design the empty state, the loading state, the error state and the disabled state for every component you ship. A component with only a "happy path" is half-built.
Accessibility: real focus rings, labels on every control, keyboard order that matches the visual order, target sizes at least 44×44 px, and a reduced-motion path that keeps the meaning and drops the movement.
Data: numbers right-align, tabular figures for anything that changes, and a unit on every measurement.

PART THREE — RESTRAINT (from Apple's design guidance)
Clarity: the content is the interface. Remove chrome until removing more would hurt.
Deference: navigation and controls stay out of the way until they are needed; the interface never competes with what the user came for.
Depth: layers and motion communicate where things come from and where they go — never decoration.
Motion: 90 ms for state changes, 160 ms for a panel, 240 ms for a screen. Enter and exit are not symmetric — exits are faster. Everything is interruptible. Animate transform and opacity; never animate layout.
Materials: translucency and blur only where they carry meaning (a floating bar over content). Everything else is a solid surface with a clean border.

PART FOUR — PIXEL DETAIL
Check alignment on both axes, optical centring (a circle inside a square looks centred only when it is optically nudged), consistent icon stroke widths, image aspect ratios that never stretch, text that truncates cleanly with two lines and an ellipsis, and hover/press states that do not shift layout by a single pixel.
Verify at 390 px, 834 px, 1280 px and 1920 px wide before saying it is done.

PART FIVE — THE DELIVERABLE
Report in this shape, briefly:
Direction — one sentence.
Type — the pairing and the scale.
Palette — the tokens, with values.
Motion — the rule.
States — what was designed beyond the happy path.
Checked — the widths and interactions you verified.
Known — anything you deliberately left, and why.

Never describe a screenshot you did not see. Never claim a state you did not build. If something is unverified, write "unverified" next to it.`

export const designSupremacySkill: Skill = {
  id: 'sk-design-supremacy',
  name: 'Design Supremacy',
  builtin: true,
  category: 'Design',
  icon: 'palette',
  description: 'One skill that merges Anthropic frontend-design, UI/UX Pro Max and Apple design guidance into a single method for building interfaces.',
  promptTemplate: `${DESIGN_SUPREMACY_PROMPT}\n\n---\n\nTHE TASK\n{{task}}\n\nCONTEXT\nThe brief, the references and the components to use:\n{{context}}`,
  params: [
    { name: 'task', type: 'string', description: 'What to design or build' },
    { name: 'context', type: 'string', description: 'The design brief and any references, pasted or summarised', default: 'No brief yet — ask for one before designing.' },
  ],
  outputFormat: 'natural',
}

/**
 * The three sources, named honestly, for the Skills tab and the About notes.
 * Attribution only — none of their text is reproduced in this file.
 */
export const DESIGN_SUPREMACY_SOURCES = [
  { name: 'frontend-design', by: 'Anthropic (skill)', contributes: 'Aesthetic point of view; refusing the generic AI look.' },
  { name: 'UI/UX Pro Max', by: 'community skill', contributes: 'Systems: spacing, hierarchy, states, accessibility.' },
  { name: 'Apple Design', by: 'Apple design guidance', contributes: 'Clarity, deference, depth; motion that explains.' },
]
