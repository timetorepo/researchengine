import type { ProviderId } from '@/types'

/**
 * Provider metadata only. Model lists are NEVER hardcoded here — they are
 * fetched live from each provider's API (via the backend proxy) and cached
 * in settings.providerModels.
 */
export interface ProviderMeta {
  id: ProviderId
  name: string
  kind: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'compatible'
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
    id: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true, hint: 'Google AI Studio key — starts with AIza',
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
    id: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true, hint: 'One OpenAI-compatible key for many model providers',
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
    id: 'mercury', name: 'Inception · Mercury', kind: 'openai', baseUrl: 'https://api.inceptionlabs.ai/v1',
    needsKey: true, hint: 'Diffusion LLM (Mercury 2 / Mercury Edit) — OpenAI-compatible, very fast',
  },
  {
    id: 'grok', name: 'xAI · Grok', kind: 'openai', baseUrl: 'https://api.x.ai/v1',
    needsKey: true, hint: 'xAI key from console.x.ai',
  },
  {
    id: 'deepseek', name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1',
    needsKey: true, hint: 'platform.deepseek.com — /models auto-detects (deepseek-v4-*)',
  },
  {
    id: 'kimi', name: 'Moonshot · Kimi', kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1',
    needsKey: true, hint: 'platform.moonshot.ai — kimi-k3 and code models',
  },
  {
    id: 'glm', name: 'Z.ai · GLM', kind: 'openai', baseUrl: 'https://api.z.ai/api/paas/v4',
    needsKey: true, hint: 'GLM-4.7-Flash / 4.5-Flash are free; GLM-5 for the heavy work',
  },
  {
    id: 'minimax', name: 'MiniMax', kind: 'openai', baseUrl: 'https://api.minimax.io/v1',
    needsKey: true, hint: 'MiniMax-M3 — enter the model id manually, /models is not exposed',
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: 'http://localhost:5000/v1',
    needsKey: false, hint: 'text-generation-webui, LocalAI, vLLM…',
  },
]

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id)
