/**
 * One image, through the provider you already configured.
 *
 * `/images/generations` is the shape OpenAI and its compatible clones share;
 * whatever the server answers with — including a refusal — is what the panel
 * shows. Nothing here is mocked: with no image model on the active provider the
 * caller gets an error that says exactly that.
 */
import { PROVIDERS } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'

export interface GeneratedImage {
  alt: string
  id: string
  seed?: string
  src: string
}

/** Model ids that are actually image models — matched against the provider's own list. */
const IMAGE_MODEL_RE = /(dall-?e|gpt-image|imagen|flux|stable-?diffusion|sdxl|seedream|qwen-image|recraft|image-preview)/i

/** Long enough for a slow render, short enough not to hang the panel forever. */
const TIMEOUT_MS = 120_000

export function imageProviderId(): string {
  return (useStore.getState().settings.defaultModel ?? '').split(':')[0] || 'openai'
}

/**
 * The image model this provider actually offers, from the list it discovered —
 * never a hardcoded id, because those are exactly what goes stale.
 */
export function imageModelFor(providerId: string, fallbackModel?: string): string | undefined {
  const models = useStore.getState().settings.providerModels?.[providerId] ?? []
  return models.find((m) => IMAGE_MODEL_RE.test(m))
    ?? (fallbackModel && IMAGE_MODEL_RE.test(fallbackModel) ? fallbackModel : undefined)
}

/** A CSS aspect ratio back to the sizes these APIs accept. */
export function imageSizeFor(value: string): string {
  const [w, h] = value.split('/').map((n) => Number(n.trim()))
  if (!w || !h) return '1024x1024'
  if (Math.abs(w / h - 1) < 0.05) return '1024x1024'
  return w > h ? '1536x1024' : '1024x1536'
}

export async function generateImage({ prompt, size = '1024x1024' }: { prompt: string; size?: string }): Promise<GeneratedImage> {
  const settings = useStore.getState().settings
  const [configuredId, configuredModel] = (settings.defaultModel ?? '').split(':')
  const provider = PROVIDERS.find((p) => p.id === configuredId) ?? PROVIDERS.find((p) => p.id === 'openai')
  if (!provider) throw new Error('No provider is configured yet — add one in Settings → Providers.')

  const model = imageModelFor(provider.id, configuredModel)
  if (!model) throw new Error(`${provider.name} lists no image model. Add its key in Settings → Providers and refresh its model list.`)

  const conf = (settings.providers ?? {})[provider.id]
  const baseUrl = (conf?.baseUrl || provider.baseUrl || '').replace(/\/+$/, '')
  const key = await usableKey(conf?.apiKey)

  // Per-request timeout, on the client, the same way chat requests do it.
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'b64_json' }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      throw new Error(`${provider.name} refused the request (${res.status})${detail ? ` — ${detail}` : ''}`)
    }
    const data = await res.json().catch(() => null)
    const first = data?.data?.[0]
    const src: string | undefined = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url
    if (!src) throw new Error('The provider answered without an image.')
    return { id: `img-${Date.now().toString(36)}`, alt: prompt.slice(0, 80), src, seed: first?.seed != null ? String(first.seed) : undefined }
  } finally {
    window.clearTimeout(timer)
  }
}
