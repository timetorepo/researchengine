import type { ProviderId } from '@/types'

/**
 * Provider metadata only. Model lists are NEVER hardcoded here — they are
 * fetched live from each provider's API (via the backend proxy) and cached
 * in settings.providerModels.
 */
export interface ProviderMeta {
  id: ProviderId
  name: string
  /**
   * `decision` is Jev: a typed decision model, not a chat model. It takes
   * `state` plus `questions` and returns answers with probabilities, so it
   * cannot be driven by the chat streaming path and is called through its own
   * route instead.
   */
  kind: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'compatible' | 'decision'
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
    id: 'kilocode', name: 'Kilo Code', kind: 'openai', baseUrl: 'https://api.kilo.ai/api/gateway',
    needsKey: true, hint: 'Kilo Code gateway key, from the Kilo dashboard — one key for many models',
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
    // llama.cpp's own server. Often the fastest local option on a CPU or a
    // single GPU, and it speaks the OpenAI wire format, so it reuses the same
    // adapter. Start it with `llama-server -m model.gguf --port 8080`.
    id: 'llamacpp', name: 'llama.cpp', kind: 'openai', baseUrl: 'http://localhost:8080/v1',
    needsKey: false, hint: 'llama-server on port 8080 — the models it loaded appear automatically',
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
    id: 'mimo', name: 'Xiaomi · MiMo', kind: 'openai', baseUrl: 'https://api.xiaomimimo.com/v1',
    needsKey: true, hint: 'MiMo open platform key (sk-…, or tp-… from a Token Plan) — /models auto-detects mimo-v2.6-pro, flash and the TTS models',
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: 'http://localhost:5000/v1',
    needsKey: false, hint: 'text-generation-webui, LocalAI, vLLM…',
  },
  {
    id: 'typesafe', name: 'TypeSafe AI (Jev)', kind: 'decision',
    baseUrl: 'https://api.typesafe.ai', needsKey: true,
    hint: 'A decision model, not a chat model: POST /v1/systemone with state and typed questions',
  },
]

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id)
