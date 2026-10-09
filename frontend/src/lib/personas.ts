/**
 * Persona text, loaded on demand. The manifest of every prompt in the archive
 * lives in content/personas and is imported only by the library tab, so the
 * chat path never pays for it.
 */
// Vite resolves these globs at build time. Under plain node (the test runner)
// there is no bundler, so the map stays empty there.
let mods: Record<string, () => Promise<unknown>> = {}
try {
  mods = import.meta.glob('/src/content/personas/text/*.md', { query: '?raw', import: 'default' }) as typeof mods
} catch { /* no bundler: nothing to load */ }

/** The default voice for coding sessions: the Codex astra prompt. */
export const CODING_PERSONA_SLUG = 'openai-codex-gpt-6-astra'

export async function personaText(slug: string): Promise<string | null> {
  const load = mods[`/src/content/personas/text/${slug}.md`]
  if (!load) return null
  try { return (await load()) as string } catch { return null }
}
