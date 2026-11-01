/**
 * Skin helpers — the shared vocabulary the Watermelon/Cult/Refero-derived
 * components draw with.
 *
 * Refero's DESIGN.md files are readable maps of real products' token systems;
 * the useful part for us is not copying a palette but *deriving* every surface
 * from the palette the user already chose. So these helpers never hardcode a
 * colour: they read the app's own CSS variables, which means a card looks right
 * in Light, Catppuccin, Solarized or any theme, including the light ones where
 * a fixed dark card would be unreadable.
 *
 * The pure helpers (`shuffled`, `flattenTags`, `clampText`) carry no styling
 * and are covered by tests.
 */

export type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'text'

const TOKEN: Record<Tone, string> = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  text: 'var(--text-2)',
}

/** A theme-matched gradient — the same trick as the share card. */
export function themeGradient(tone: Tone = 'primary', angle = 135): string {
  const a = TOKEN[tone]
  return `linear-gradient(${angle}deg, color-mix(in srgb, ${a} 78%, transparent), color-mix(in srgb, ${a} 34%, var(--secondary)))`
}

/** A translucent wash of one tone, for chips and quiet panels. */
export function toneWash(tone: Tone = 'primary', pct = 12): string {
  return `color-mix(in srgb, ${TOKEN[tone]} ${pct}%, transparent)`
}

/** A hairline that takes on the tone — used for "this one is special" borders. */
export function toneBorder(tone: Tone = 'primary', pct = 45): string {
  return `1px solid color-mix(in srgb, ${TOKEN[tone]} ${pct}%, var(--surface-border))`
}

/**
 * Deterministic shuffle. `seed` makes a shuffle reproducible: the same seed and
 * input always give the same order, so a re-render never reshuffles a list
 * under the user's pointer (the failure mode a `Math.random()` shuffle has).
 */
export function shuffled<T>(items: readonly T[], seed = 1): T[] {
  const out = [...items]
  let s = Math.abs(Math.floor(seed)) || 1
  for (let i = out.length - 1; i > 0; i--) {
    // mulberry32 — small, fast, and stable across engines.
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    const j = Math.floor(r * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Split a comma/space separated tag string into clean, unique tags. */
export function flattenTags(input: string | string[] | undefined, limit = 12): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/[,\n]/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of raw) {
    const t = tag.trim().replace(/\s+/g, ' ')
    if (!t || t.length > 24) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= limit) break
  }
  return out
}

/** One-line clamp without CSS (used where a line-clamp is not available). */
export function clampText(text: string, max = 120): string {
  const t = String(text ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Initials for an avatar fallback: "dnishh" → "D", "Ada Lovelace" → "AL". */
export function initials(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
