/**
 * Which *family* is a model from?
 *
 * Model lists are fetched live from providers and never hardcoded, so this is
 * pattern matching over ids, not a catalogue. Two rules keep it honest:
 *
 *   • a family is only recognised when the id says so (`llama-3.3-70b`,
 *     `qwen2.5-coder`, `deepseek-v4`, `glm-4.7-flash`, …);
 *   • anything unrecognised falls back to the **provider's** mark, which is what
 *     the user asked for on niche models — no invented logos, no guessing.
 *
 * The marks themselves live in `components/shared/ModelLogo.tsx`. Families we
 * can draw faithfully get a real mark; the rest get a monogram tile in a stable
 * hue, which reads as deliberate rather than broken.
 */

export interface Family {
  id: string
  label: string
  /** The pattern that identifies the family from a model id. */
  match: RegExp
  /** Which mark to draw. `mono` renders the letters in a tinted tile. */
  mark: string
  mono?: string
  /** Hue used for the tile / accent (0-360). */
  hue: number
}

/**
 * Order matters: the first match wins, so specific families come before the
 * generic ones (`gemma` before `gemini`, `mimo` before a bare `mi`).
 */
export const FAMILIES: Family[] = [
  { id: 'llama', label: 'Llama', match: /(^|[/_-])llama/i, mark: 'llama', hue: 217 },
  { id: 'qwen', label: 'Qwen', match: /(^|[/_-])(qwen|qwq|qwen3|qwen2)/i, mark: 'qwen', hue: 268 },
  { id: 'deepseek', label: 'DeepSeek', match: /deepseek/i, mark: 'deepseek', hue: 214 },
  { id: 'gemma', label: 'Gemma', match: /gemma/i, mark: 'gemma', hue: 199 },
  { id: 'gemini', label: 'Gemini', match: /gemini/i, mark: 'gemini', hue: 220 },
  { id: 'claude', label: 'Claude', match: /claude/i, mark: 'claude', hue: 24 },
  { id: 'gpt-oss', label: 'GPT-OSS', match: /gpt[-_]oss/i, mark: 'mono', mono: 'OSS', hue: 158 },
  { id: 'gpt', label: 'GPT', match: /(^|[/_-])(gpt|o[134]-|chatgpt)/i, mark: 'gpt', hue: 160 },
  { id: 'grok', label: 'Grok', match: /grok/i, mark: 'grok', hue: 0 },
  { id: 'mistral', label: 'Mistral', match: /(mistral|mixtral|magistral|codestral|devstral|pixtral)/i, mark: 'mistral', hue: 28 },
  { id: 'glm', label: 'GLM', match: /(^|[/_-])(glm|chatglm)/i, mark: 'glm', hue: 194 },
  { id: 'kimi', label: 'Kimi', match: /(kimi|moonshot)/i, mark: 'kimi', hue: 285 },
  { id: 'minimax', label: 'MiniMax', match: /(minimax|abab)/i, mark: 'mono', mono: 'MM', hue: 340 },
  // Xiaomi's MiMo. Its own entry, before the bucket below used to swallow it.
  { id: 'mimo', label: 'MiMo · Xiaomi', match: /(^|[/_-])(mimo|xiaomi|xmp)/i, mark: 'mono', mono: 'Mi', hue: 16 },
  { id: 'mercury', label: 'Mercury', match: /(mercury|inception)/i, mark: 'mercury', hue: 258 },
  { id: 'nemotron', label: 'Nemotron', match: /nemotron/i, mark: 'nemotron', hue: 96 },
  { id: 'phi', label: 'Phi', match: /(^|[/_-])phi[-_0-9]/i, mark: 'mono', mono: 'φ', hue: 205 },
  { id: 'olmo', label: 'OLMo', match: /olmo/i, mark: 'mono', mono: 'OL', hue: 42 },
  { id: 'hermes', label: 'Hermes', match: /hermes/i, mark: 'mono', mono: 'H', hue: 320 },
  { id: 'yi', label: 'Yi', match: /(^|[/_-])yi[-_0-9]/i, mark: 'mono', mono: 'Yi', hue: 172 },
  { id: 'command', label: 'Command', match: /command[-_a-z0-9]*/i, mark: 'command', hue: 152 },
  { id: 'mixtral-free', label: 'Mixtral', match: /mixtral/i, mark: 'mistral', hue: 28 },
  { id: 'sarvam', label: 'Sarvam', match: /sarvam/i, mark: 'mono', mono: 'Sa', hue: 18 },
  { id: 'nova', label: 'Nova', match: /(amazon\.)?nova/i, mark: 'mono', mono: 'N', hue: 40 },
  { id: 'gpt-oss-small', label: 'GPT-OSS', match: /(^|[/_-])(muse|spark|big-pickle|ling|nemotron-3-ultra)/i, mark: 'mono', mono: '★', hue: 260 },
]

export function modelFamily(model: string): Family | null {
  const id = String(model ?? '')
  if (!id) return null
  // Strip a provider path (`meta-llama/Llama-3.3-70B-Instruct` → the tail is what
  // we match on, but the whole id is checked so `meta-llama` still matches).
  const probe = id.replace(/^[^/]+\//, '')
  for (const f of FAMILIES) {
    if (f.match.test(probe) || f.match.test(id)) return f
  }
  return null
}

/** Two letters for the fallback tile, when a model has no family. */
export function monogramFor(model: string): string {
  const clean = String(model ?? '').split(/[/:]/).pop() ?? ''
  const word = clean.replace(/[^a-z0-9]/gi, '')
  if (!word) return '?'
  return word.slice(0, 2).toUpperCase()
}
