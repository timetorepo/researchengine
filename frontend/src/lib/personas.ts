import { PERSONAS_MANIFEST, type PersonaEntry } from '@/content/personas/manifest'

/**
 * Persona library: the manifest names every prompt in the upstream archive;
 * the vendored ones lazy-load their full text as raw chunks so the 1.5 MB of
 * flagship prompts never lands in the main bundle.
 */

const mods = import.meta.glob('/src/content/personas/text/*.md', { query: '?raw', import: 'default' })

export { PERSONAS_MANIFEST }
export type { PersonaEntry }

export const personaBySlug = (slug: string): PersonaEntry | undefined =>
  PERSONAS_MANIFEST.find((p) => p.slug === slug)

export async function personaText(slug: string): Promise<string | null> {
  const load = mods[`/src/content/personas/text/${slug}.md`]
  if (!load) return null
  try { return (await load()) as string } catch { return null }
}

/** The default voice for coding sessions, per the Codex look-and-feel work. */
export const CODING_PERSONA_SLUG = 'openai-codex-gpt-6-astra'
