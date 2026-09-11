import type { ProviderId } from '@/types'

export interface ProviderMeta {
  id: ProviderId
  name: string
  kind: 'openai' | 'anthropic' | 'ollama' | 'compatible'
  baseUrl: string
  defaultModels: string[]
  needsKey: boolean
  hint?: string
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'gpt-3.5-turbo'], needsKey: true,
  },
  {
    id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307'], needsKey: true,
  },
  {
    id: 'groq', name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], needsKey: true,
  },
  {
    id: 'ollama', name: 'Ollama', kind: 'ollama', baseUrl: 'http://localhost:11434',
    defaultModels: [], needsKey: false, hint: 'Auto-detects local models via /api/tags',
  },
  {
    id: 'nim', name: 'NVIDIA NIM', kind: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModels: ['meta/llama-3.1-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'],
    needsKey: true, hint: 'OpenAI-compatible — use your NVIDIA API key',
  },
  {
    id: 'together', name: 'Together', kind: 'openai', baseUrl: 'https://api.together.xyz/v1',
    defaultModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'], needsKey: true,
  },
  {
    id: 'mistral', name: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['mistral-large-latest', 'open-mistral-nemo'], needsKey: true,
  },
  {
    id: 'lmstudio', name: 'LM Studio', kind: 'openai', baseUrl: 'http://localhost:1234/v1',
    defaultModels: [], needsKey: false, hint: 'Local server — start it in LM Studio',
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: 'http://localhost:5000/v1',
    defaultModels: [], needsKey: false, hint: 'text-generation-webui, LocalAI, vLLM…',
  },
]

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id)
