/**
 * What the providers actually offer, as a searchable list.
 *
 * Registries publish their own indexes, but not one of them offers a search
 * endpoint the app can call from the browser without a server in the middle —
 * and half of them would be unreachable from a phone on a train. So the catalog
 * is local, instant, and offline: names you can search, each one carrying the
 * provider it belongs to and the command that installs it. The providers' own
 * sites are one click away for the current version of anything.
 *
 * The rule for this file: only list a component whose name is the real registry
 * item. A made-up name would produce a command that fails, which is worse than
 * not listing it.
 */

import { scoreItem } from '@/lib/design/patterns'

export interface CatalogItem {
  id: string
  provider: string
  name: string
  what: string
  /** Words that are not in the name, so search finds it by intent. */
  tags: string[]
}

type Raw = [name: string, what: string, tags?: string]

const RAW: Record<string, Raw[]> = {
  shadcn: [
    ['button', 'The button, with variants and sizes.', 'action primary'],
    ['card', 'A surface with header, content and footer.', 'panel container'],
    ['dialog', 'A modal dialog over the page.', 'modal popup'],
    ['sheet', 'A panel that slides in from an edge.', 'drawer side panel'],
    ['tabs', 'Tabbed sections with keyboard support.', 'navigation segments'],
    ['command', 'A command palette with search and groups.', 'palette cmdk search'],
    ['table', 'A data table with sorting and pagination.', 'datagrid rows'],
    ['chart', 'Recharts-based charts themed with your tokens.', 'graph analytics'],
    ['carousel', 'An embla carousel with arrows and keyboard.', 'slider gallery'],
    ['form', 'React Hook Form fields wired to validation.', 'validation input'],
    ['sidebar', 'A collapsible app sidebar with keyboard shortcuts.', 'navigation layout'],
    ['calendar', 'A date picker built on react-day-picker.', 'date schedule'],
    ['toast', 'Stacked toasts with actions.', 'notification snackbar'],
    ['combobox', 'Search inside a select.', 'autocomplete select'],
    ['data-table', 'The full table recipe: sort, filter, paginate.', 'datagrid'],
    ['hover-card', 'A card that appears on hover.', 'preview tooltip'],
  ],
  shadcnspace: [
    ['animated-list-02', 'A loading sequence that walks through real stages.', 'loading steps progress'],
    ['badge-13', 'A number that rolls over when it changes.', 'counter numberflow streak'],
    ['button-28', 'Hold-to-confirm button for irreversible actions.', 'destructive confirm hold'],
    ['button-group-12', 'A primary button with a chevron of secondary actions.', 'toolbar split'],
    ['button-group-10', 'A rich-text toolbar over a real editable surface.', 'editor bold italic'],
    ['testimonial-04', 'Quotes laid out in a quiet grid.', 'social proof'],
    ['stats-06', 'Metric cards with a sparkline.', 'dashboard numbers'],
  ],
  bklit: [
    ['line-chart', 'A composable line chart.', 'graph trend analytics'],
    ['bar-chart', 'A composable bar chart.', 'graph bars analytics'],
    ['area-chart', 'A stacked area chart.', 'graph volume analytics'],
    ['pie-chart', 'A pie or donut chart.', 'graph donut'],
    ['radar-chart', 'A radar chart for multi-axis comparison.', 'graph spider'],
    ['scatter-chart', 'A scatter plot with a trend line.', 'graph correlation'],
    ['chart-tooltip', 'The shared tooltip for every chart above.', 'hover readout'],
  ],
  smoothui: [
    ['smooth-button', 'A springy button with a soft press.', 'button action'],
    ['ai-message', 'A chat message with streaming-aware layout.', 'chat bubble conversation'],
    ['ai-prompt-input', 'A prompt box with attachments and a send state.', 'composer input'],
    ['ai-reasoning', 'A collapsible reasoning trace.', 'thinking chain'],
    ['ai-task-list', 'A task list that fills in as steps complete.', 'checklist progress'],
    ['ai-tool-call', 'A tool call with its arguments and result.', 'function call'],
    ['ai-sources', 'A source list with favicons.', 'citations references'],
    ['ai-loader', 'A loader for an in-flight model call.', 'spinner loading'],
    ['ai-diff', 'A before/after diff view.', 'changes code'],
    ['ai-context-meter', 'A meter that shows how full the context is.', 'tokens budget'],
    ['animated-tags', 'Tags that animate in on mount.', 'chips labels'],
    ['typewriter-text', 'Text typed one character at a time.', 'typing effect'],
    ['mac-terminal', 'A macOS-style terminal window.', 'cli shell'],
    ['notification-badge', 'An animated count badge.', 'bell unread'],
    ['github-stars-animation', 'A star count that animates on change.', 'repo stars'],
    ['stagger-from-edges', 'Children that stagger in from the edges.', 'reveal list'],
    ['social-hover-card', 'A hover card with a social profile.', 'profile hover'],
    ['folder-reveal', 'A folder that opens to reveal its contents.', 'files tree'],
  ],
  'skiper-ui': [
    ['skiper54', 'A clip-path image carousel with autoplay.', 'carousel gallery images'],
    ['skiper1', 'An animated hero block.', 'hero'],
    ['skiper19', 'A stack of cards that fans out.', 'cards stack'],
    ['skiper24', 'A marquee that reacts to scroll velocity.', 'marquee scroll'],
    ['skiper36', 'A magnetic button that follows the pointer.', 'magnet cursor'],
    ['skiper48', 'A text reveal that slides in line by line.', 'text reveal'],
    ['skiper60', 'A docked navigation with a moving highlight.', 'dock nav'],
  ],
  'react-bits': [
    ['SplitText', 'Text that splits and animates per character.', 'text animation'],
    ['GlitchText', 'Glitchy text with scanline noise.', 'text animation'],
    ['CountUp', 'A number that counts up when it enters view.', 'stat counter'],
    ['Dock', 'A macOS-style dock that magnifies on approach.', 'nav magnify'],
    ['Particles', 'A particle field background.', 'background canvas'],
    ['Ballpit', 'Physics balls that collide in a box.', 'background physics'],
    ['Aurora', 'A moving aurora gradient background.', 'background gradient'],
    ['SpotlightCard', 'A card with a pointer-tracked spotlight.', 'card hover glow'],
    ['ImageTrail', 'Images that trail behind the pointer.', 'cursor gallery'],
    ['ScrollReveal', 'Content that reveals as it scrolls in.', 'scroll animation'],
    ['Magnet', 'An element pulled toward the pointer.', 'cursor magnet'],
    ['PixelCard', 'A pixel-grid card that animates on hover.', 'card pixels'],
    ['VariableProximity', 'Text weight that responds to pointer distance.', 'text variable font'],
    ['Ribbons', 'Flowing ribbon trails.', 'background motion'],
  ],
  magicui: [
    ['shimmer-button', 'A button with a shimmer sweep.', 'action loading'],
    ['border-beam', 'A travelling light along a border.', 'card glow'],
    ['animated-gradient-text', 'A gradient that moves through the text.', 'headline'],
    ['marquee', 'An infinite scrolling row.', 'logos ticker'],
    ['dock', 'A magnifying dock.', 'nav'],
    ['bento-grid', 'A bento layout with hover cells.', 'features layout'],
    ['number-ticker', 'Rolling digits for live numbers.', 'counter stats'],
    ['orbiting-circles', 'Icons orbiting a centre.', 'integration logos'],
    ['animated-beam', 'A beam connecting two elements.', 'pipeline integration'],
    ['terminal', 'A typing terminal window.', 'console code'],
    ['meteors', 'Meteors falling across a background.', 'background'],
    ['retro-grid', 'An 80s perspective grid.', 'background'],
    ['blur-fade', 'Content that unblurs as it enters.', 'reveal'],
    ['file-tree', 'A file tree with expansions.', 'code explorer'],
    ['icon-cloud', 'A rotating cloud of icons.', 'skills logos'],
    ['scroll-progress', 'A reading progress bar.', 'progress'],
  ],
  tailark: [
    ['hero', 'A centred hero with product shot.', 'landing header'],
    ['features', 'A feature grid with icons.', 'landing sections'],
    ['pricing', 'Pricing cards with a highlighted plan.', 'plans billing'],
    ['stats', 'A band of numbers.', 'metrics'],
    ['testimonials', 'Quote cards.', 'social proof'],
    ['faq', 'An accordion of questions.', 'accordion questions'],
    ['cta', 'A closing call to action.', 'conversion'],
    ['footer', 'A multi-column footer.', 'links legal'],
  ],
  soundcn: [
    ['click', 'A soft interface click.', 'ui sound'],
    ['pop', 'A short pop for toggles.', 'ui sound'],
    ['swoosh', 'A swoosh for transitions.', 'ui sound'],
    ['toggle', 'A two-state switch sound.', 'ui sound'],
    ['success', 'A rising confirmation.', 'ui sound'],
    ['error', 'A dull refusal.', 'ui sound'],
  ],
  intentui: [
    ['button', 'Accessible button.', 'action'],
    ['modal', 'Accessible modal.', 'dialog'],
    ['select', 'Accessible select.', 'dropdown'],
    ['table', 'Accessible table.', 'data'],
    ['date-field', 'Accessible date entry.', 'calendar'],
    ['toast', 'Accessible toasts.', 'notification'],
  ],
  uiable: [
    ['hero-section', 'A hero block.', 'landing'],
    ['pricing-table', 'A pricing comparison.', 'plans'],
    ['bento-features', 'A bento of features.', 'landing layout'],
    ['navbar', 'A responsive navbar.', 'navigation'],
    ['footer-section', 'A footer block.', 'links'],
    ['auth-form', 'A sign-in form.', 'login'],
  ],
  'ns-ui': [
    ['animated-button', 'A button with a moving fill.', 'action animation'],
    ['morph-card', 'A card that morphs on hover.', 'card'],
    ['loading-orbit', 'An orbiting loader.', 'spinner'],
    ['text-reveal', 'A line-by-line reveal.', 'animation text'],
    ['glass-panel', 'A frosted panel.', 'glass surface'],
    ['gradient-border', 'A border with a moving gradient.', 'glow'],
  ],
  'lucide-animated': [
    ['settings', 'A cog that turns when it appears.', 'icon gear'],
    ['search', 'A magnifier with a sweep.', 'icon find'],
    ['bell', 'A bell that rings.', 'icon notification alert'],
    ['check', 'A check that draws itself.', 'icon success'],
    ['loader', 'A spinner icon.', 'icon loading'],
    ['heart', 'A heart that beats.', 'icon like'],
    ['trash', 'A bin with a lid.', 'icon delete'],
  ],
  atomloader: [
    ['orbit-loader', 'Points orbiting a centre.', 'spinner loading'],
    ['pulse-loader', 'A pulsing dot.', 'spinner loading'],
    ['grid-loader', 'A grid of fading squares.', 'spinner loading'],
    ['bar-loader', 'Bars that rise and fall.', 'spinner loading'],
  ],
  prosekit: [
    ['editor', 'A headless rich text editor.', 'wysiwyg writing'],
    ['toolbar', 'A formatting toolbar.', 'bold italic'],
    ['mention', 'An @-mention extension.', 'autocomplete'],
    ['code-block', 'A code block with highlighting.', 'syntax'],
    ['table', 'An editable table.', 'grid'],
  ],
  aceternity: [
    ['aurora-background', 'An aurora that washes a hero.', 'hero background'],
    ['spotlight', 'A spotlight cone on a surface.', 'hero lighting'],
    ['3d-card', 'A card with real perspective.', 'card tilt'],
    ['bento-grid', 'A bento layout of feature cells.', 'features layout'],
    ['infinite-moving-cards', 'Rows of cards scrolling forever.', 'marquee testimonials'],
    ['text-generate-effect', 'Text that fades in word by word.', 'reveal headline'],
    ['background-beams', 'Beams sweeping a background.', 'hero background'],
    ['card-hover-effect', 'Cards where hover shifts the spotlight.', 'features hover'],
    ['floating-dock', 'A magnifying dock bound to the bottom.', 'nav dock'],
    ['following-pointer', 'A pointer that carries a name and avatar.', 'cursor presence'],
    ['link-preview', 'A hover card that shows a page preview.', 'tooltip link'],
    ['meteors', 'Meteors across a section.', 'background'],
    ['moving-border', 'A border light that travels around a card.', 'glow card'],
    ['sparkles', 'Sparkle particles behind content.', 'background'],
    ['tracing-beam', 'A progress line that traces a long article.', 'reading scroll'],
    ['typewriter-effect', 'Text typed out with a cursor.', 'hero typing'],
    ['images-badge', 'A badge of stacked images that opens on hover.', 'gallery stack'],
    ['container-scroll-animation', 'A screen that tilts up as you scroll.', '3d scroll'],
    ['multi-step-loader', 'A stepped loader with real stages.', 'loading progress'],
    ['placeholders-and-vanish-input', 'An input whose placeholder scrambles away.', 'search input'],
    ['compare-slider', 'A before/after slider.', 'image compare'],
    ['github-globe', 'Arcs across a globe.', 'map network'],
    ['hero-highlight', 'A highlighter stroke behind words.', 'headline emphasis'],
    ['hero-parallax', 'A parallax hero of scrolling product cards.', 'hero scroll'],
    ['lamp', 'A lamp that lights a headline.', 'hero'],
    ['layout-grid', 'A grid that highlights cells on hover.', 'background grid'],
    ['timeline', 'A vertical timeline of events.', 'history steps'],
    ['tooltip-card', 'A tool card that appears at the pointer.', 'hover tool'],
    ['vortex', 'A vortex that swallows content.', 'background'],
    ['wavy-background', 'A wavy line field.', 'background'],
    ['world-map', 'A dotted world map with pins.', 'geography network'],
  ],
  watermelon: [
    ['warm-button', 'A soft, rounded button.', 'action'],
    ['soft-card', 'A card with a warm shadow.', 'surface'],
    ['pill-tabs', 'Rounded segmented tabs.', 'segments'],
  ],
  'cult-ui': [
    ['texture-card', 'A card with a paper texture.', 'surface'],
    ['gradient-heading', 'A heading with a considered gradient.', 'title'],
    ['dock', 'A dock with a spring.', 'nav'],
    ['popover-form', 'A popover that holds a small form.', 'inline form'],
  ],
  kokonut: [
    ['action-button', 'A compact action button.', 'action'],
    ['smooth-tab', 'A tab bar with a sliding indicator.', 'segments'],
    ['dynamic-text', 'Text that swaps with a mask.', 'headline'],
    ['pricing-card', 'A pricing card.', 'plans'],
    ['file-upload', 'A drag-and-drop upload zone.', 'upload dropzone'],
    ['loader', 'A minimal loader.', 'spinner'],
  ],
  eldora: [
    ['hero-banner', 'A banner hero with motion.', 'landing'],
    ['testimonial-card', 'A quote card with an avatar.', 'social proof'],
    ['feature-grid', 'A grid of features.', 'landing'],
    ['newsletter', 'A subscribe field with a confirmation.', 'email'],
    ['marquee', 'A scrolling row.', 'ticker'],
  ],
  originui: [
    ['input', 'A plain input with states.', 'form field'],
    ['select', 'A select with search.', 'dropdown'],
    ['checkbox-group', 'A grouped checkbox set.', 'form'],
    ['radio-group', 'A radio set.', 'form'],
    ['date-picker', 'A date picker.', 'calendar'],
    ['stepper', 'A numbered stepper.', 'wizard'],
    ['avatar', 'An avatar with fallback.', 'profile'],
    ['badge', 'A status badge.', 'label'],
  ],
  heroui: [
    ['modal', 'The modal — used in this app for updates.', 'dialog popup'],
    ['tabs', 'The tabs — used in this app for Chats.', 'segments'],
    ['table', 'A sortable table.', 'data'],
    ['select', 'An accessible select.', 'dropdown'],
    ['date-picker', 'A date picker.', 'calendar'],
    ['autocomplete', 'A searchable select.', 'combobox'],
  ],
  mantine: [
    ['AppShell', 'An application shell with header and nav.', 'layout'],
    ['DataTable', 'A data grid.', 'table'],
    ['Notifications', 'A notification system.', 'toast'],
    ['DatePicker', 'A date picker.', 'calendar'],
    ['RichTextEditor', 'A rich text editor.', 'writing'],
    ['Spotlight', 'A command palette.', 'search commands'],
  ],
  chakra: [
    ['Provider', 'The theme provider.', 'setup'],
    ['Dialog', 'A modal dialog.', 'popup'],
    ['Menu', 'A dropdown menu.', 'actions'],
    ['Tabs', 'Tabs.', 'segments'],
    ['Table', 'A table.', 'data'],
    ['Toast', 'Toasts.', 'notification'],
  ],
  mui: [
    ['DataGrid', 'A serious data grid.', 'table enterprise'],
    ['Autocomplete', 'A searchable select.', 'combobox'],
    ['DatePicker', 'A date picker.', 'calendar'],
    ['Dialog', 'A modal.', 'popup'],
    ['Stepper', 'A step wizard.', 'wizard'],
    ['Chart', 'Charts themed by MUI.', 'graph'],
  ],
  antd: [
    ['Table', 'A dense data table.', 'datagrid enterprise'],
    ['Form', 'A form with validation.', 'validation'],
    ['DatePicker', 'A date range picker.', 'calendar'],
    ['Tree', 'A tree control.', 'hierarchy'],
    ['Upload', 'An upload control.', 'files'],
    ['Descriptions', 'A key-value description list.', 'detail'],
  ],
  radix: [
    ['Dialog', 'An unstyled accessible dialog.', 'modal primitive'],
    ['DropdownMenu', 'An unstyled menu.', 'primitive'],
    ['Tooltip', 'An unstyled tooltip.', 'primitive'],
    ['Toast', 'Unstyled toasts.', 'primitive'],
    ['Select', 'An unstyled select.', 'primitive'],
    ['Slider', 'An unstyled slider.', 'primitive'],
  ],
  headlessui: [
    ['Dialog', 'An accessible dialog.', 'modal'],
    ['Disclosure', 'An expandable disclosure.', 'accordion'],
    ['Menu', 'A dropdown menu.', 'actions'],
    ['Listbox', 'A select with options.', 'dropdown'],
    ['Switch', 'A toggle switch.', 'boolean'],
    ['Combobox', 'A searchable select.', 'autocomplete'],
  ],
  'base-ui': [
    ['Dialog', 'An unstyled dialog primitive.', 'modal'],
    ['Popover', 'An unstyled popover.', 'floating'],
    ['Select', 'An unstyled select.', 'dropdown'],
    ['Slider', 'An unstyled slider.', 'range'],
    ['Tooltip', 'An unstyled tooltip.', 'hover'],
    ['Menu', 'An unstyled menu.', 'actions'],
  ],
  daisyui: [
    ['btn', 'A class-based button.', 'action'],
    ['card', 'A class-based card.', 'surface'],
    ['modal', 'A class-based modal.', 'dialog'],
    ['tabs', 'Class-based tabs.', 'segments'],
    ['table', 'A class-based table.', 'data'],
    ['dock', 'A class-based bottom dock.', 'mobile nav'],
  ],
}

export const CATALOG: CatalogItem[] = Object.entries(RAW).flatMap(([provider, items]) =>
  items.map(([name, what, tags]) => ({
    id: `${provider}:${name}`,
    provider,
    name,
    what,
    tags: (tags ?? '').split(/\s+/).filter(Boolean),
  })),
)

/**
 * Search the catalog: name, description, tags, provider, all in one pass — and
 * the screen vocabulary of `patterns.ts`, so typing "empty state" or "onboarding"
 * in the hub finds the components that build it.
 */
export function searchCatalog(query: string, providers: string[] | null): CatalogItem[] {
  const q = query.trim()
  const pool = providers?.length ? CATALOG.filter((i) => providers.includes(i.provider)) : CATALOG
  if (!q) return pool.slice(0, 60)
  return pool
    .map((item) => ({ item, score: scoreItem(q, item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
}
