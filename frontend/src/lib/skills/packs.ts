import { SKILL_PACKS, type SkillPack } from '@/content/skills/catalog'

/**
 * Vendored upstream skill packs (emilkowalski/skills in full, plus the
 * ian-xiaohei illustration pack with its cross-model adapter). A chat can
 * attach any of them; the pack's SKILL.md then rides along in the system
 * context, capped so a design essay never eats the whole window.
 */
export { SKILL_PACKS }
export type { SkillPack }

// Vite resolves these globs at build time; under plain node they stay empty.
let mods: Record<string, () => Promise<unknown>> = {}
let refs: Record<string, () => Promise<unknown>> = {}
try {
  mods = import.meta.glob('/src/content/skills/upstream/*/SKILL.md', { query: '?raw', import: 'default' }) as typeof mods
  refs = import.meta.glob('/src/content/skills/upstream/ian-xiaohei-illustrations/MODEL-ADAPTERS.md', { query: '?raw', import: 'default' }) as typeof refs
} catch { /* no bundler: nothing to load */ }

export const packById = (id: string) => SKILL_PACKS.find((p) => p.id === id)

export async function packText(id: string, cap = 5000): Promise<string | null> {
  const load = mods[`/src/content/skills/upstream/${id}/SKILL.md`]
  if (!load) return null
  let text = (await load()) as string
  if (id === 'ian-xiaohei-illustrations') {
    const adapter = refs['/src/content/skills/upstream/ian-xiaohei-illustrations/MODEL-ADAPTERS.md']
    if (adapter) text += `\n\n${await adapter()}`
  }
  return text.length > cap ? `${text.slice(0, cap)}\n\n(pack truncated at ${cap} chars)` : text
}
