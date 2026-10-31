// Reusable one-shot generation used by Agent Flood, synthesis and any future
// multi-agent flow. Runs the configured provider for real when credentials
// exist; otherwise falls back to the clearly-labeled on-device engine.
import { streamToCallback, ProviderError } from '@/lib/providers/stream'
import { providerById } from '@/lib/providers/registry'
import { demoAnswer } from '@/lib/providers/demo'
import { usableKey } from '@/lib/providers/keys'
import { estimateTokens } from '@/lib/flow/pruner'
import { useStore } from '@/stores/useStore'
import { shieldOutbound, recordScan } from '@/lib/privacy/shield'
import { assertBudget, recordTokens } from '@/lib/usage/guard'

export interface GenerateRequest {
  system: string
  prompt: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  temperature?: number
  maxTokens?: number
  modelOverride?: string // "provider:model"
  signal?: AbortSignal
  onChunk?: (text: string) => void
}

export interface GenerateResult {
  text: string
  promptTokens: number
  completionTokens: number
  provider: string
  model: string
  usedDemo: boolean
}

export async function generateText(req: GenerateRequest): Promise<GenerateResult> {
  const settings = useStore.getState().settings
  const [providerId, model] = (req.modelOverride ?? settings.defaultModel).split(':')
  const meta = providerById(providerId)

  const pconf = settings.providers[providerId]
  let apiKey = ''
  if (pconf?.apiKey) apiKey = await usableKey(pconf.apiKey)

  const useReal = !!meta && (!meta.needsKey || apiKey.length > 0)
  const shieldedSystem = shieldOutbound(req.system)
  const messages = [
    ...(req.history ?? []).map((m) => ({ ...m, content: shieldOutbound(m.content).text })),
    { role: 'user' as const, content: shieldOutbound(req.prompt).text },
  ]
  if (shieldedSystem.findings.length) recordScan(`generation system → ${meta?.name ?? 'provider'}`, shieldedSystem.findings)

  if (useReal) {
    assertBudget()
    useStore.getState().logConnection(meta!.baseUrl, `${meta!.name} · ${model}`, estimateTokens(req.prompt) * 4)
    let text = ''
    const res = await streamToCallback({
      providerId, model, apiKey,
      baseUrl: pconf?.baseUrl || undefined,
      system: shieldedSystem.text,
      messages,
      temperature: req.temperature ?? settings.modelDefaults[model]?.temperature ?? 0.7,
      maxTokens: Math.min(req.maxTokens ?? settings.modelDefaults[model]?.maxTokens ?? 900, 4000),
      signal: req.signal,
    }, (chunk) => {
      text += chunk
      req.onChunk?.(chunk)
    })
    recordTokens(res.promptEstimate + res.completionTokens)
    return {
      text,
      promptTokens: res.promptEstimate,
      completionTokens: res.completionTokens,
      provider: meta!.name, model, usedDemo: false,
    }
  }

  // On-device engine — real generation from the local model, clearly labeled.
  useStore.getState().logConnection('local://demo', 'on-device model', estimateTokens(req.prompt) * 4, 'local')
  const full = demoAnswer(req.prompt, {})
  let text = ''
  const words = full.split(/(?<=\s)/)
  for (let i = 0; i < words.length; i++) {
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    text += words[i]
    req.onChunk?.(words[i])
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 8))
  }
  return {
    text,
    promptTokens: estimateTokens(req.system + ' ' + req.prompt),
    completionTokens: estimateTokens(text),
    provider: 'Local engine', model: 'on-device', usedDemo: true,
  }
}

export { ProviderError }
