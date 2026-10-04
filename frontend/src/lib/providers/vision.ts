import type { ProviderMeta } from './registry'

/** Best-effort vision capability for the provider adapters used by Research Engine. */
export function modelSupportsVision(kind: ProviderMeta['kind'] | undefined, model = ''): boolean {
  if (kind === 'openai' || kind === 'compatible' || kind === 'anthropic' || kind === 'gemini') return true
  if (kind !== 'ollama') return false
  return /(llava|bakllava|moondream|qwen(?:2|2\.5|3)[-_. ]?vl|llama(?:3(?:\.2)?|4)[-_. ]?vision|gemma3|granite(?:3)?[-_. ]?vision|minicpm[-_. ]?v|internvl|pixtral)/i.test(model)
}
