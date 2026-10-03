/**
 * The Design Hub's memory.
 *
 * Three things live here, and they are the three things a person builds up over
 * an afternoon and would be furious to lose:
 *
 *   • the box — dependencies saved from any provider, waiting to be copied all
 *     at once. Saving is instant and removing is one click; nothing is ever
 *     cleared behind the user's back.
 *   • the brief — what "premium" means to this person, answered once and then
 *     attached to every design prompt.
 *   • the board — directions, with their type, palette and components, plus the
 *     references they were drawn from.
 *
 * Persisted, because a cart that empties on reload is not a cart.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Manager } from '@/lib/design/providers'
import { commandsFor, uiProviderById } from '@/lib/design/providers'

export interface BoxEntry {
  id: string
  /** Which provider it came from (a provider id). */
  provider: string
  /** The component name, or the package name for package providers. */
  item: string
  /** The one-line description, kept for the box's list. */
  what: string
  addedAt: number
  /** True when the entry is a package rather than a registry component. */
  isPackage?: boolean
}

export interface BriefAnswers {
  /** What kind of site or app this is. */
  subject: string
  /** Who it is for. */
  audience: string
  /** SaaS / unique / editorial / playful — the question that matters. */
  style: string
  /** How dense the screens should feel. */
  density: string
  /** How much motion. */
  motion: string
  /** Light, dark, or both. */
  theme: 'light' | 'dark' | 'both' | ''
  /** Type personality. */
  type: string
  /** What the one accent colour is allowed to be. */
  accent: string
  /** The references they gave, one per line. */
  references: string
  /** Anything that must be on the first screen. */
  mustHave: string
  /** What to avoid. */
  avoid: string
}

export const emptyBrief: BriefAnswers = {
  subject: '', audience: '', style: '', density: '', motion: '', theme: '',
  type: '', accent: '', references: '', mustHave: '', avoid: '',
}

export interface Direction {
  id: string
  title: string
  style: string
  /** One sentence the card leads with. */
  idea: string
  type: string
  palette: string[]
  motion: string
  components: string[]
  createdAt: number
  /** Set when it becomes the one to build. */
  chosen?: boolean
}

export interface Inspiration {
  id: string
  source: 'awwwards' | 'dribbble' | 'unicorn' | 'refero' | 'other'
  title: string
  url: string
  note: string
  palette?: string[]
  addedAt: number
}

interface DesignState {
  manager: Manager
  box: BoxEntry[]
  brief: BriefAnswers
  directions: Direction[]
  inspirations: Inspiration[]

  setManager: (m: Manager) => void

  /** Add a dependency. Same command twice is a no-op, so the box never lies. */
  addToBox: (e: Omit<BoxEntry, 'id' | 'addedAt'>) => void
  addManyToBox: (entries: Omit<BoxEntry, 'id' | 'addedAt'>[]) => void
  removeFromBox: (id: string) => void
  clearBox: () => void

  setBrief: (patch: Partial<BriefAnswers>) => void
  resetBrief: () => void

  addDirection: (d: Omit<Direction, 'id' | 'createdAt'>) => void
  chooseDirection: (id: string) => void
  removeDirection: (id: string) => void

  addInspiration: (i: Omit<Inspiration, 'id' | 'addedAt'>) => void
  removeInspiration: (id: string) => void
}

const uid = () => `dx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

export const useDesign = create<DesignState>()(
  persist(
    (set, get) => ({
      manager: 'npm',
      box: [],
      brief: emptyBrief,
      directions: [],
      inspirations: [],

      setManager: (manager) => set({ manager }),

      addToBox: (e) => {
        const { box } = get()
        if (box.some((b) => b.provider === e.provider && b.item === e.item)) return
        set({ box: [...box, { ...e, id: uid(), addedAt: Date.now() }] })
      },
      addManyToBox: (entries) => {
        const { box } = get()
        const have = new Set(box.map((b) => `${b.provider}:${b.item}`))
        const fresh = entries
          .filter((e) => !have.has(`${e.provider}:${e.item}`))
          .map((e) => ({ ...e, id: uid(), addedAt: Date.now() }))
        if (fresh.length) set({ box: [...box, ...fresh] })
      },
      removeFromBox: (id) => set({ box: get().box.filter((b) => b.id !== id) }),
      clearBox: () => set({ box: [] }),

      setBrief: (patch) => set({ brief: { ...get().brief, ...patch } }),
      resetBrief: () => set({ brief: emptyBrief }),

      addDirection: (d) => set({ directions: [...get().directions, { ...d, id: uid(), createdAt: Date.now() }] }),
      chooseDirection: (id) => set({
        directions: get().directions.map((d) => ({ ...d, chosen: d.id === id })),
      }),
      removeDirection: (id) => set({ directions: get().directions.filter((d) => d.id !== id) }),

      addInspiration: (i) => set({ inspirations: [...get().inspirations, { ...i, id: uid(), addedAt: Date.now() }] }),
      removeInspiration: (id) => set({ inspirations: get().inspirations.filter((i) => i.id !== id) }),
    }),
    { name: 're.design.hub' },
  ),
)

/** The exact command lines for this box, for the manager in use right now. */
export function boxLines(box: BoxEntry[], manager: Manager): { provider: string; item: string; command: string }[] {
  const out: { provider: string; item: string; command: string }[] = []
  for (const e of box) {
    const provider = uiProviderById(e.provider)
    if (!provider) continue
    // A package entry installs its package; a component entry asks the provider
    // how to add that component. Either way the line is derived here, so
    // switching package manager never leaves a stale command in the box.
    const lines = e.isPackage
      ? commandsFor({ ...provider, kind: 'package', pkg: e.item }, null, manager)
      : commandsFor(provider, e.item, manager)
    for (const l of lines) out.push({ provider: provider.name, item: e.item, command: l.command })
  }
  return out
}

export const boxCount = (box: BoxEntry[]) => box.length

/** The whole box as one block, grouped by provider, ready for a terminal. */
export function boxAsScript(box: BoxEntry[], manager: Manager): string {
  const lines = boxLines(box, manager)
  if (!lines.length) return ''
  const byProvider = new Map<string, string[]>()
  for (const l of lines) {
    const list = byProvider.get(l.provider) ?? []
    list.push(l.command)
    byProvider.set(l.provider, list)
  }
  const head = [
    `# Research Engine — dependency box`,
    `# ${lines.length} command${lines.length === 1 ? '' : 's'} · package manager: ${manager}`,
    '# Paste this whole block into a terminal inside your project.',
    '',
  ]
  const body: string[] = []
  for (const [provider, commands] of byProvider) {
    body.push(`# ${provider}`)
    body.push(...commands)
    body.push('')
  }
  return [...head, ...body].join('\n').trimEnd() + '\n'
}
