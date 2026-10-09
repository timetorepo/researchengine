/**
 * Persona text, loaded on demand. The manifest of every prompt in the archive
 * lives in content/personas and is imported only by the library tab, so the
 * chat path never pays for it.
 */
const mods = import.meta.glob('/src/content/personas/text/*.md', { query: '?raw', import: 'default' })

/** The default voice for coding sessions: the Codex astra prompt. */
export const CODING_PERSONA_SLUG = 'openai-codex-gpt-6-astra'

export async function personaText(slug: string): Promise<string | null> {
  const load = mods[`/src/content/personas/text/${slug}.md`]
  if (!load) return null
  try { return (await load()) as string } catch { return null }
}
