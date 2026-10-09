/**
 * Live demos for the component hub's preview stage.
 *
 * The hub searches thirty providers' registries, but a search hit is only a
 * name and an install line. For the components this app actually vendors —
 * SmoothUI's set and the Aceternity pieces it ships — the preview can do the
 * honest thing and render the component itself, right here, on a stage with
 * its own light/dark switch. Everything else gets the metadata card: the real
 * install command and the provider's page, and a line that says a live demo
 * is not vendored rather than pretending a screenshot is one.
 *
 * The rule: only map a catalog name that resolves to a vendored module. A
 * demo that 404s its import would be a lie with a spinner.
 */
import React from 'react'

export interface LiveDemo {
  load: () => Promise<Record<string, any>>
  /** Pick the component out of the module (default or named export). */
  pick: (mod: any) => React.ComponentType<any>
  props?: Record<string, any>
  children?: React.ReactNode
}

const smooth = (dir: string, props?: Record<string, any>, children?: React.ReactNode): LiveDemo => ({
  load: () => import(`../../components/smoothui/${dir}/index`),
  pick: (m) => m.default,
  props,
  children,
})

const acet = (file: string, named: string, props?: Record<string, any>, children?: React.ReactNode): LiveDemo => ({
  load: () => import(`../../components/ui/aceternity/${file}`),
  pick: (m) => m[named],
  props,
  children,
})

/** `provider:item` → a demo, for exactly the vendored set. */
const DEMOS: Record<string, LiveDemo> = {
  // ---- SmoothUI, the app's own design system -------------------------------
  'smoothui:smooth-button': smooth('smooth-button', { variant: 'solid' }, 'Save design'),
  'smoothui:ai-message': smooth('ai-message'),
  'smoothui:ai-prompt-input': smooth('ai-prompt-input'),
  'smoothui:ai-reasoning': smooth('ai-reasoning'),
  'smoothui:ai-task-list': smooth('ai-task-list'),
  'smoothui:ai-tool-call': smooth('ai-tool-call'),
  'smoothui:ai-sources': smooth('ai-sources'),
  'smoothui:ai-loader': smooth('ai-loader'),
  'smoothui:ai-diff': smooth('ai-diff'),
  'smoothui:ai-context-meter': smooth('ai-context-meter', { used: 41_000, limit: 128_000 }),
  'smoothui:animated-tags': smooth('animated-tags'),
  'smoothui:typewriter-text': smooth('typewriter-text', {}, 'Design is how it works.'),
  'smoothui:mac-terminal': smooth('mac-terminal'),
  'smoothui:notification-badge': smooth('notification-badge', { count: 3 }, <span style={{ fontSize: 12 }}>Inbox</span>),
  'smoothui:github-stars-animation': smooth('github-stars-animation'),
  'smoothui:stagger-from-edges': smooth('stagger-from-edges'),
  'smoothui:social-hover-card': smooth('social-hover-card'),
  'smoothui:folder-reveal': smooth('folder-reveal', { size: 96, spread: 26 }),

  // ---- Aceternity pieces this app ships ------------------------------------
  'aceternity:aurora-background': acet('AuroraBackground', 'AuroraBackground', {}, <span style={{ fontSize: 12 }}>Aurora</span>),
  'aceternity:spotlight': acet('SpotlightCard', 'SpotlightCard', {}, <span style={{ padding: 18, display: 'block', fontSize: 12 }}>Spotlight card</span>),
  'aceternity:following-pointer': acet('FollowingPointer', 'FollowingPointer'),
  'aceternity:link-preview': acet('LinkPreview', 'LinkPreview'),
  'aceternity:images-badge': acet('ImagesBadge', 'ImagesBadge'),
  'aceternity:moving-border': acet('MovingBorder', 'MovingBorder', {}, <span style={{ padding: '8px 14px', fontSize: 12 }}>Moving border</span>),
  'aceternity:multi-step-loader': acet('MultiStepLoader', 'MultiStepLoader'),
  'aceternity:placeholders-and-vanish-input': acet('PlaceholdersAndVanishInput', 'PlaceholdersAndVanishInput'),
  'aceternity:text-generate-effect': acet('TextGenerateEffect', 'TextGenerateEffect', { text: 'Words materialize with blur and rise, one at a time.' }),
  'aceternity:tooltip-card': acet('TooltipCard', 'TooltipCard'),
}

/** The live demo for a catalog hit, when one is vendored. */
export const liveDemoFor = (provider: string, item: string): LiveDemo | null =>
  DEMOS[`${provider}:${item}`] ?? null

/** Every key the demo registry knows — the test suite walks all of them. */
export const liveDemoKeys = (): string[] => Object.keys(DEMOS)
