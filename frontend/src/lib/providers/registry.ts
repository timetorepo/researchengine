import type { ProviderId } from '@/types'

/**
 * Provider metadata only. Model lists are NEVER hardcoded here — they are
 * fetched live from each provider's API (via the backend proxy) and cached
 * in settings.providerModels.
 */
export interface ProviderMeta {
  id: ProviderId
  name: string
  kind: 'openai' | 'anthropic' | 'ollama' | 'compatible'
  baseUrl: string
  needsKey: boolean
  hint?: string
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', needsKey: true,
  },
  {
    id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', needsKey: true,
  },
  {
    id: 'groq', name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true,
  },
  {
    id: 'ollama', name: 'Ollama', kind: 'ollama', baseUrl: 'http://localhost:11434',
    needsKey: false, hint: 'Auto-detects local models via /api/tags',
  },
  {
    id: 'nim', name: 'NVIDIA NIM', kind: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1',
    needsKey: true, hint: 'OpenAI-compatible — use your NVIDIA API key',
  },
  {
    id: 'together', name: 'Together', kind: 'openai', baseUrl: 'https://api.together.xyz/v1', needsKey: true,
  },
  {
    id: 'mistral', name: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', needsKey: true,
  },
  {
    id: 'lmstudio', name: 'LM Studio', kind: 'openai', baseUrl: 'http://localhost:1234/v1',
    needsKey: false, hint: 'Local server — start it in LM Studio',
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: 'http://localhost:5000/v1',
    needsKey: false, hint: 'text-generation-webui, LocalAI, vLLM…',
  },
]

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id)
