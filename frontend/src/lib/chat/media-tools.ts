/**
 * Multi-modal output: the model can make an image or a spoken clip when a person
 * asks for one, and it appears under the answer.
 *
 * Both tools are offered only when the model can call tools (see
 * activeModelCanCallTools) and the provider is set up for them. Nothing is sent
 * anywhere the person has not already configured: images use the image model on
 * the active provider (lib/images/generate.ts), and speech uses OpenAI's speech
 * endpoint with the OpenAI key they saved. VoiceStudio, when set up, takes
 * precedence for speech through the existing voice_speak tool.
 */
import { useStore } from '@/stores/useStore'
import { generateImage, imageModelFor, imageProviderId, imageSizeFor } from '@/lib/images/generate'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { serviceReady } from '@/lib/services/config'
import type { ToolContext, ToolDef } from './tools'

const opt = (type: string, description: string) => ({ type, description })

/**
 * Chat models that cannot take a tool list. Tools are withheld from them, so the
 * request never fails for a reason the person cannot see. Kept short on purpose:
 * unknown models get tools, and a provider error still shows as an error.
 */
const NO_TOOLS = /^(o1-mini|o1-preview|gpt-3\.5-turbo-instruct|davinci|babbage|text-)/i

export function activeModelCanCallTools(): boolean {
  const model = (useStore.getState().settings.defaultModel ?? '').split(':').slice(1).join(':')
  return !NO_TOOLS.test(model)
}

const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
const SPEECH_MODEL = 'gpt-4o-mini-tts'
/** Larger than this would bloat the saved chat, so the clip is refused rather than kept. */
const MAX_AUDIO_BYTES = 4_000_000

function appendMedia(ctx: ToolContext, item: { kind: 'image' | 'audio'; src: string; alt: string }) {
  const msg = useStore.getState().chats.find((c) => c.id === ctx.chatId)?.messages.find((m) => m.id === ctx.asstId)
  useStore.getState().updateMessage(ctx.chatId, ctx.asstId, { media: [...(msg?.media ?? []), item] })
}

function openaiKeyPresent(): boolean {
  return !!useStore.getState().settings.providers?.openai?.apiKey
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error ?? new Error('could not read the audio'))
  reader.readAsDataURL(blob)
})

export const MEDIA_TOOLS: ToolDef[] = [
  {
    name: 'generate_image',
    description: 'Generate one image from a written description with the image model on the active provider, and show it under your answer. Use it only when the person asks for a picture, illustration, logo or similar. Describe the subject, style, composition and colours in detail.',
    parameters: {
      type: 'object',
      properties: {
        prompt: opt('string', 'A detailed description of the image to make'),
        aspect: opt('string', 'Shape of the image: "1:1" (square), "3:2" (landscape) or "2:3" (portrait)'),
      },
      required: ['prompt'],
    },
    when: () => activeModelCanCallTools() && !!imageModelFor(imageProviderId()),
    run: async (args, ctx) => {
      const prompt = String(args?.prompt ?? '').trim()
      if (!prompt) return 'Describe the image to generate.'
      const size = imageSizeFor(String(args?.aspect ?? '1:1').replace(':', '/'))
      const img = await generateImage({ prompt, size })
      appendMedia(ctx, { kind: 'image', src: img.src, alt: (img.alt || prompt).slice(0, 160) })
      return 'Made the image and showed it under your answer. In a sentence, say what it shows. Do not repeat any image data.'
    },
  },
  {
    name: 'generate_audio',
    description: 'Turn a short passage into a spoken audio clip and play it under your answer. Use it only when the person asks to hear something read aloud. Keep it under about 800 characters.',
    parameters: {
      type: 'object',
      properties: {
        text: opt('string', 'What the voice should say'),
        voice: opt('string', `One of: ${OPENAI_VOICES.join(', ')}. Defaults to alloy.`),
      },
      required: ['text'],
    },
    when: () => activeModelCanCallTools() && openaiKeyPresent() && !serviceReady('voicestudio'),
    run: async (args, ctx) => {
      const text = String(args?.text ?? '').trim().slice(0, 1000)
      if (!text) return 'Give the text to speak.'
      const requested = String(args?.voice ?? 'alloy').toLowerCase()
      const voice = OPENAI_VOICES.includes(requested) ? requested : 'alloy'
      const conf = useStore.getState().settings.providers?.openai
      const key = await usableKey(conf?.apiKey)
      const base = (conf?.baseUrl || providerById('openai')?.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
      const res = await fetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: SPEECH_MODEL, voice, input: text, response_format: 'mp3' }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return `Speech failed (${res.status}). ${detail.slice(0, 200)}`.trim()
      }
      const blob = await res.blob()
      if (blob.size > MAX_AUDIO_BYTES) return 'The clip is too long to keep in the chat. Ask for a shorter passage.'
      appendMedia(ctx, { kind: 'audio', src: await blobToDataUrl(blob), alt: text.slice(0, 120) })
      return `Made a spoken clip with the “${voice}” voice. It plays under your answer.`
    },
  },
]
