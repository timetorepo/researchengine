/**
 * Which model Codersa talks to, taken from the person's own settings: the
 * default model in the top bar, its provider's base URL, and its key. The key
 * is decrypted only when a turn is sent, and is never stored by Codersa.
 *
 * The harness speaks the OpenAI chat-completions protocol, so only providers
 * that offer it can run a turn. Others get a plain reason, not a silent failure.
 */
import { useStore } from '@/stores/useStore'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import type { Settings } from '@/types'

export interface CodersaTarget { base: string; model: string; key: string; label: string }
export type ModelInfo = { ok: true; base: string; model: string; label: string; needsKey: boolean; keyOnFile: boolean } | { ok: false; reason: string }

/**
 * Providers whose native protocol differs but which also serve the OpenAI
 * chat-completions protocol. Codersa uses that route for them:
 *  - Gemini: Google's OpenAI-compatible endpoint sits under /v1beta/openai.
 *  - Ollama: serves /v1/chat/completions beside its native /api routes.
 * Anthropic is left out: its compatibility route wants a different auth header.
 */
const OPENAI_ROUTE: Record<string, (base: string) => string> = {
  gemini: (b) => (b.endsWith('/openai') ? b : `${b.replace(/\/v1beta$/, '')}/v1beta/openai`),
  ollama: (b) => (b.endsWith('/v1') ? b : `${b}/v1`),
}

const SUPPORTED_KINDS = new Set(['openai', 'compatible', ...Object.keys(OPENAI_ROUTE)])

/** The OpenAI-compatible base for a provider, given its configured or default base URL. */
export function openAiBaseFor(kind: string, base: string): string {
  const b = base.replace(/\/+$/, '')
  return OPENAI_ROUTE[kind]?.(b) ?? b
}

/** Whether the settings can drive a turn. Reads only; it decrypts nothing. */
export function describeModel(settings: Settings = useStore.getState().settings): ModelInfo {
  const [providerId, model = ''] = (settings.defaultModel ?? '').split(':')
  if (!providerId || !model) {
    return { ok: false, reason: 'Pick a model in the top bar first. Codersa uses the same model as your chats.' }
  }
  const meta = providerById(providerId)
  if (!meta) return { ok: false, reason: 'The selected model’s provider is not set up. Reconnect it under Settings → Providers.' }
  if (!SUPPORTED_KINDS.has(meta.kind)) {
    return { ok: false, reason: `${meta.name} does not offer the chat protocol Codersa uses. Pick a model from OpenAI, Gemini, Ollama, LM Studio or llama.cpp in the top bar.` }
  }
  const conf = settings.providers[providerId]
  const base = openAiBaseFor(meta.kind, (conf?.baseUrl || meta.baseUrl || '').replace(/\/+$/, ''))
  if (!base) return { ok: false, reason: `${meta.name} has no base URL. Set one under Settings → Providers.` }
  return { ok: true, base, model, label: `${meta.name} · ${model}`, needsKey: meta.needsKey, keyOnFile: !!conf?.apiKey }
}

/** The target for one turn. This is the only place the key is decrypted. */
export async function resolveTarget(): Promise<{ ok: true; target: CodersaTarget } | { ok: false; reason: string }> {
  const settings = useStore.getState().settings
  const info = describeModel(settings)
  if (!info.ok) return info
  let key = ''
  if (info.needsKey) {
    try {
      key = await usableKey(settings.providers[(settings.defaultModel ?? '').split(':')[0]]?.apiKey)
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Could not unlock the API key.' }
    }
    if (!key) return { ok: false, reason: `Add the key for ${info.label.split(' · ')[0]} under Settings → Providers.` }
  }
  return { ok: true, target: { base: info.base, model: info.model, key, label: info.label } }
}
