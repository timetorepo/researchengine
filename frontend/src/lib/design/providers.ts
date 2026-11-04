/**
 * The UI component providers — 30 of them, and the command that actually
 * installs a component from each.
 *
 * Three ways a component library is consumed in 2026, and the hub only claims a
 * command when that provider really publishes one:
 *
 *   • `namespace`  — a shadcn CLI community registry: `npx shadcn@latest add
 *                    @<registry>/<component>`. The CLI has these built in, so
 *                    there is nothing to configure before the command works.
 *   • `url`        — a registry served from the vendor's own host, added by URL.
 *   • `package`    — an ordinary npm package; the box emits the right install
 *                    line per package manager.
 *   • `copy`       — the library is copy-paste only. No command is invented for
 *                    it; the hub says "open the site" and, where the components
 *                    need real packages to run, those go in the box.
 *
 * `search` is only present where the provider publishes one (the shadcn CLI can
 * search namespaced registries: `npx shadcn@latest search @<ns> -q "..."`).
 */
export type ProviderKind = 'namespace' | 'url' | 'package' | 'copy'
export type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface UiProvider {
  id: string
  name: string
  kind: ProviderKind
  /** Homepage. */
  url: string
  /** Namespaced registry id, without the @, for `kind: 'namespace'`. */
  ns?: string
  /** URL registry base, for `kind: 'url'`. */
  registry?: string
  /** npm package name, for `kind: 'package'`. */
  pkg?: string
  /** Packages the copy-paste libraries require at runtime. */
  needs?: string[]
  /** One line, the provider's own character. */
  what: string
  free: boolean
  /** The thing to know before installing: licence, paid tier, peer deps. */
  note?: string
}

export const UI_PROVIDERS: UiProvider[] = [
  // ---- namespaced shadcn registries (nothing to configure) ------------------
  {
    id: 'shadcn', name: 'shadcn/ui', kind: 'namespace', ns: 'shadcn', url: 'https://ui.shadcn.com',
    what: 'The base every other registry here builds on: form controls, overlays, layout, charts.', free: true,
    note: 'Components are copied into your project as source — you own and edit them.',
  },
  {
    id: 'shadcnspace', name: 'shadcnspace', kind: 'namespace', ns: 'shadcn-space', url: 'https://shadcnspace.com',
    what: 'Blocks and micro-interactions: animated lists, rolling numbers, hold-to-confirm buttons.', free: true,
    note: 'Already wired into this repo\'s components.json as @shadcn-space.',
  },
  {
    id: 'bklit', name: 'Bklit UI', kind: 'namespace', ns: 'bklit', url: 'https://bklit.com',
    what: 'Composable chart components — line, bar, area, pie — installed as source.', free: true,
    note: 'Charts arrive as composable pieces (root, grid, series, axes, tooltip), not one blob.',
  },
  {
    id: 'skiper-ui', name: 'Skiper UI', kind: 'namespace', ns: 'skiper-ui', url: 'https://skiper-ui.com',
    what: 'Uncommon animated components — card swipers, marquees, clipped reveals.', free: true,
    note: 'Free with attribution to Skiper UI; a paid tier removes the attribution.',
  },
  {
    id: 'react-bits', name: 'ReactBits', kind: 'namespace', ns: 'react-bits', url: 'https://reactbits.dev',
    what: 'Animated text, backgrounds and interactive components, from glitch text to particles.', free: true,
  },
  {
    id: 'magicui', name: 'Magic UI', kind: 'namespace', ns: 'magicui', url: 'https://magicui.design',
    what: 'Landing-page energy: beams, marquees, docks, orbiting circles, number tickers.', free: true,
  },
  {
    id: 'tailark', name: 'Tailark', kind: 'namespace', ns: 'tailark', url: 'https://tailark.com',
    what: 'Marketing blocks — heroes, pricing, stats, testimonials, FAQ, footers.', free: true,
  },
  {
    id: 'soundcn', name: 'soundcn', kind: 'namespace', ns: 'soundcn', url: 'https://soundcn.xyz',
    what: 'Interface sound effects: clicks, pops, toggles, retro and game sounds.', free: true,
    note: 'Sound is off by default in this app — this is here for the projects you build.',
  },
  {
    id: 'intentui', name: 'Intent UI', kind: 'namespace', ns: 'intentui', url: 'https://intentui.com',
    what: 'An accessible React component library you copy and own.', free: true,
  },
  {
    id: 'uiable', name: 'uiable', kind: 'namespace', ns: 'uiable', url: 'https://uiable.com',
    what: 'Free open-source blocks built on Next.js, React 19 and Tailwind v4.', free: true,
  },
  {
    id: 'ns-ui', name: 'ns-ui', kind: 'namespace', ns: 'ns-ui', url: 'https://design.helpmarq.com',
    what: 'A large animated set — hundreds of components with a CLI and an MCP server.', free: true,
  },
  {
    id: 'lucide-animated', name: 'lucide-animated', kind: 'namespace', ns: 'lucide-animated', url: 'https://lucide-animated.com',
    what: 'Lucide icons that move — smooth animated variants of the icon set.', free: true,
  },
  {
    id: 'atomloader', name: 'atomloader', kind: 'namespace', ns: 'atomloader', url: 'https://atomloader.roothq.tech',
    what: 'Lightweight CSS-animated loaders.', free: true,
  },
  {
    id: 'prosekit', name: 'ProseKit', kind: 'namespace', ns: 'prosekit', url: 'https://prosekit.dev',
    what: 'A rich text editor for React, Vue, Preact, Svelte and Solid.', free: true,
  },

  // ---- registries served by URL --------------------------------------------
  {
    id: 'aceternity', name: 'Aceternity UI', kind: 'url', registry: 'https://ui.aceternity.com/r', url: 'https://ui.aceternity.com',
    what: 'The dramatic ones: aurora backgrounds, spotlights, bento grids, tracing beams, 3D cards.', free: true,
    note: 'Fetched from their own host by URL, so the CLI needs network access when you install.',
  },
  {
    id: 'smoothui', name: 'SmoothUI', kind: 'url', registry: 'https://smoothui.dev/r', url: 'https://smoothui.dev',
    what: 'Motion-first components with a soft, springy feel — the set this app itself uses.', free: true,
    note: 'Same registry the app vendors from (see components.json → @smoothui), so the command is exactly the one that works here.',
  },
  {
    id: 'watermelon', name: 'Watermelon UI', kind: 'copy', url: 'https://watermelon.shadcn.com',
    what: 'Warm, rounded, shadcn-compatible components.', free: true, needs: ['motion'],
    note: 'Copy-paste library — open the site and copy the file, or use the registry command shown there.',
  },
  {
    id: 'cult-ui', name: 'Cult UI', kind: 'copy', url: 'https://cult-ui.com',
    what: 'Considered, slightly odd components with real polish.', free: true, needs: ['motion'],
  },
  {
    id: 'kokonut', name: 'Kokonut UI', kind: 'copy', url: 'https://kokonutui.com',
    what: 'Small, sharp animated pieces — buttons, cards, inputs, loaders.', free: true, needs: ['motion'],
  },
  {
    id: 'eldora', name: 'Eldora UI', kind: 'copy', url: 'https://eldora-ui.vercel.app',
    what: 'Animated marketing and app components, copy-paste.', free: true, needs: ['motion', 'clsx', 'tailwind-merge'],
  },
  {
    id: 'originui', name: 'Origin UI', kind: 'copy', url: 'https://originui.com',
    what: 'A very large set of clean, plain form and app components.', free: true,
  },

  // ---- ordinary packages ---------------------------------------------------
  {
    id: 'heroui', name: 'HeroUI', kind: 'package', pkg: '@heroui/react', url: 'https://heroui.com',
    what: 'Accessible React components — this app already uses its Modal and Tabs.', free: true,
    note: 'v2 ships styles as class names and expects a Tailwind plugin; check your Tailwind version.',
  },
  {
    id: 'mantine', name: 'Mantine', kind: 'package', pkg: '@mantine/core', url: 'https://mantine.dev',
    what: 'A complete component library with hooks and a large app-grade surface.', free: true,
  },
  {
    id: 'chakra', name: 'Chakra UI', kind: 'package', pkg: '@chakra-ui/react', url: 'https://chakra-ui.com',
    what: 'Composable, accessible components with a strong theming system.', free: true,
  },
  {
    id: 'mui', name: 'Material UI', kind: 'package', pkg: '@mui/material', url: 'https://mui.com',
    what: 'Google Material Design for React, with the widest component coverage.', free: true,
    note: 'Free core; MUI X (data grid, date pickers) has paid tiers.',
  },
  {
    id: 'antd', name: 'Ant Design', kind: 'package', pkg: 'antd', url: 'https://ant.design',
    what: 'The enterprise standard: dense tables, forms, date pickers, everything.', free: true,
  },
  {
    id: 'radix', name: 'Radix Primitives', kind: 'package', pkg: 'radix-ui', url: 'https://radix-ui.com',
    what: 'Unstyled, accessible primitives — what shadcn/ui is built on.', free: true,
  },
  {
    id: 'headlessui', name: 'Headless UI', kind: 'package', pkg: '@headlessui/react', url: 'https://headlessui.com',
    what: 'Unstyled, accessible primitives from the Tailwind team.', free: true,
  },
  {
    id: 'base-ui', name: 'Base UI', kind: 'package', pkg: '@base-ui-components/react', url: 'https://base-ui.com',
    what: 'The next-generation unstyled primitives — the successor to Radix.', free: true,
  },
  {
    id: 'daisyui', name: 'DaisyUI', kind: 'package', pkg: 'daisyui', url: 'https://daisyui.com',
    what: 'Tailwind CSS components as plain class names — no React needed.', free: true,
    note: 'A Tailwind plugin: add it to the CSS entry, then it is classes only.',
  },
]

/* ------------------------------ the commands ------------------------------ */

/** Run the shadcn CLI with the right runner for the manager in use. */
const shadcn = (m: Manager) => ({
  npm: 'npx shadcn@latest',
  pnpm: 'pnpm dlx shadcn@latest',
  yarn: 'yarn dlx shadcn@latest',
  bun: 'bunx --bun shadcn@latest',
}[m])

/** The install line for a *package*, per manager. */
export function packageCommand(pkg: string, m: Manager): string {
  switch (m) {
    case 'pnpm': return `pnpm add ${pkg}`
    case 'yarn': return `yarn add ${pkg}`
    case 'bun': return `bun add ${pkg}`
    default: return `npm i ${pkg}`
  }
}

export interface DepLine {
  /** What goes in the box, and what the clipboard gets. */
  command: string
  /** Which manager this line is for. */
  manager: Manager
  /** Which provider it came from. */
  provider: string
  /** The component or package it installs. */
  item: string
}

/**
 * Every command a component needs, for one manager. A shadcn component is one
 * line; a package is one line; a copy-paste library is its runtime packages
 * (because there is nothing to fetch — the code is copied by hand).
 */
export function commandsFor(provider: UiProvider, item: string | null, m: Manager): DepLine[] {
  const out: DepLine[] = []
  const name = item ?? ''
  if (provider.kind === 'namespace' && provider.ns) {
    out.push({ command: `${shadcn(m)} add @${provider.ns}/${name}`, manager: m, provider: provider.id, item: name })
  } else if (provider.kind === 'url' && provider.registry) {
    out.push({ command: `${shadcn(m)} add ${provider.registry}/${name}.json`, manager: m, provider: provider.id, item: name })
  } else if (provider.kind === 'package' && provider.pkg) {
    out.push({ command: packageCommand(provider.pkg, m), manager: m, provider: provider.id, item: provider.pkg })
  } else if (provider.kind === 'copy') {
    for (const pkg of provider.needs ?? []) {
      out.push({ command: packageCommand(pkg, m), manager: m, provider: provider.id, item: pkg })
    }
  }
  return out
}

/** The provider's own search command, when it publishes one. */
export function searchCommandFor(provider: UiProvider, query: string, m: Manager): string | null {
  if (provider.kind !== 'namespace' || !provider.ns) return null
  const q = query.trim()
  return `${shadcn(m)} search @${provider.ns}${q ? ` -q "${q}"` : ''}`
}

/** The `npx shadcn@latest init` line, for a project that has never had it. */
export const initCommand = (m: Manager) => `${shadcn(m)} init`

/** The package managers the box speaks. Order is the order in the UI. */
export const MANAGERS: { id: Manager; label: string }[] = [
  { id: 'npm', label: 'npm' },
  { id: 'pnpm', label: 'pnpm' },
  { id: 'yarn', label: 'yarn' },
  { id: 'bun', label: 'bun' },
]

export const uiProviderById = (id: string) => UI_PROVIDERS.find((p) => p.id === id) ?? null
