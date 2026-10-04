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

type ModuleLoader = () => Promise<Record<string, any>>

const smooth = (load: ModuleLoader, props?: Record<string, any>, children?: React.ReactNode): LiveDemo => ({
  load,
  pick: (m) => m.default,
  props,
  children,
})

const acet = (load: ModuleLoader, named: string, props?: Record<string, any>, children?: React.ReactNode): LiveDemo => ({
  load,
  pick: (m) => m[named],
  props,
  children,
})

/** `provider:item` → a demo, for exactly the vendored set. */
const DEMOS: Record<string, LiveDemo> = {
  // ---- SmoothUI, the app's own design system -------------------------------
  'smoothui:smooth-button': smooth(() => import('../../components/smoothui/smooth-button/index.tsx'), { variant: 'solid' }, 'Save design'),
  'smoothui:ai-message': smooth(() => import('../../components/smoothui/ai-message/index.tsx')),
  'smoothui:ai-prompt-input': smooth(() => import('../../components/smoothui/ai-prompt-input/index.tsx')),
  'smoothui:ai-reasoning': smooth(() => import('../../components/smoothui/ai-reasoning/index.tsx')),
  'smoothui:ai-task-list': smooth(() => import('../../components/smoothui/ai-task-list/index.tsx')),
  'smoothui:ai-tool-call': smooth(() => import('../../components/smoothui/ai-tool-call/index.tsx')),
  'smoothui:ai-sources': smooth(() => import('../../components/smoothui/ai-sources/index.tsx')),
  'smoothui:ai-loader': smooth(() => import('../../components/smoothui/ai-loader/index.tsx')),
  'smoothui:ai-diff': smooth(() => import('../../components/smoothui/ai-diff/index.tsx')),
  'smoothui:ai-context-meter': smooth(() => import('../../components/smoothui/ai-context-meter/index.tsx'), { used: 41_000, limit: 128_000 }),
  'smoothui:animated-tags': smooth(() => import('../../components/smoothui/animated-tags/index.tsx')),
  'smoothui:typewriter-text': smooth(() => import('../../components/smoothui/typewriter-text/index.tsx'), {}, 'Design is how it works.'),
  'smoothui:mac-terminal': smooth(() => import('../../components/smoothui/mac-terminal/index.tsx')),
  'smoothui:notification-badge': smooth(() => import('../../components/smoothui/notification-badge/index.tsx'), { count: 3 }, <span style={{ fontSize: 12 }}>Inbox</span>),
  'smoothui:github-stars-animation': smooth(() => import('../../components/smoothui/github-stars-animation/index.tsx')),
  'smoothui:stagger-from-edges': smooth(() => import('../../components/smoothui/stagger-from-edges/index.tsx')),
  'smoothui:social-hover-card': smooth(() => import('../../components/smoothui/social-hover-card/index.tsx')),
  'smoothui:folder-reveal': smooth(() => import('../../components/smoothui/folder-reveal/index.tsx'), { size: 96, spread: 26 }),

  // ---- Aceternity pieces this app ships ------------------------------------
  'aceternity:aurora-background': acet(() => import('../../components/ui/aceternity/AuroraBackground.tsx'), 'AuroraBackground', {}, <span style={{ fontSize: 12 }}>Aurora</span>),
  'aceternity:spotlight': acet(() => import('../../components/ui/aceternity/SpotlightCard.tsx'), 'SpotlightCard', {}, <span style={{ padding: 18, display: 'block', fontSize: 12 }}>Spotlight card</span>),
  'aceternity:following-pointer': acet(() => import('../../components/ui/aceternity/FollowingPointer.tsx'), 'FollowingPointer'),
  'aceternity:link-preview': acet(() => import('../../components/ui/aceternity/LinkPreview.tsx'), 'LinkPreview'),
  'aceternity:images-badge': acet(() => import('../../components/ui/aceternity/ImagesBadge.tsx'), 'ImagesBadge'),
  'aceternity:moving-border': acet(() => import('../../components/ui/aceternity/MovingBorder.tsx'), 'MovingBorder', {}, <span style={{ padding: '8px 14px', fontSize: 12 }}>Moving border</span>),
  'aceternity:multi-step-loader': acet(() => import('../../components/ui/aceternity/MultiStepLoader.tsx'), 'MultiStepLoader'),
  'aceternity:placeholders-and-vanish-input': acet(() => import('../../components/ui/aceternity/PlaceholdersAndVanishInput.tsx'), 'PlaceholdersAndVanishInput'),
  'aceternity:text-generate-effect': acet(() => import('../../components/ui/aceternity/TextGenerateEffect.tsx'), 'TextGenerateEffect', { text: 'Words materialize with blur and rise, one at a time.' }),
  'aceternity:tooltip-card': acet(() => import('../../components/ui/aceternity/TooltipCard.tsx'), 'TooltipCard'),
}

/** The live demo for a catalog hit, when one is vendored. */
export const liveDemoFor = (provider: string, item: string): LiveDemo | null =>
  DEMOS[`${provider}:${item}`] ?? null

/** Every key the demo registry knows — the test suite walks all of them. */
export const liveDemoKeys = (): string[] => Object.keys(DEMOS)
