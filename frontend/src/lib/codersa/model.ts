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

const SUPPORTED_KINDS = new Set(['openai', 'compatible'])

/** Whether the settings can drive a turn. Reads only; it decrypts nothing. */
export function describeModel(settings: Settings = useStore.getState().settings): ModelInfo {
  const [providerId, model = ''] = (settings.defaultModel ?? '').split(':')
  if (!providerId || !model) {
    return { ok: false, reason: 'Pick a model in the top bar first. Codersa uses the same model as your chats.' }
  }
  const meta = providerById(providerId)
  if (!meta) return { ok: false, reason: 'The selected model’s provider is not set up. Reconnect it under Settings → Providers.' }
  if (!SUPPORTED_KINDS.has(meta.kind)) {
    return { ok: false, reason: `${meta.name} does not offer the chat protocol Codersa uses. Pick an OpenAI-compatible model in the top bar.` }
  }
  const conf = settings.providers[providerId]
  const base = (conf?.baseUrl || meta.baseUrl || '').replace(/\/+$/, '')
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
