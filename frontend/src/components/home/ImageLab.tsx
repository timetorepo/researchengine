import React, { useState } from 'react'
import { useStore } from '@/stores/useStore'
import ImageGenerationPanel, { type ImageGenerationImage } from '@/components/smoothui/image-generation-panel'
import { generateImage, imageModelFor, imageProviderId, imageSizeFor } from '@/lib/images/generate'
import { PROVIDERS } from '@/lib/providers/registry'

/**
 * The one card on the home screen that makes something new.
 *
 * It is a widget like the others (off until Home → widgets is on), and it uses
 * the provider you already configured — OpenAI-compatible `/images/generations`.
 * Images stay in this session: they are far too big to write into local storage,
 * and a picture you did not ask to keep is not one to keep.
 */
export function ImageLab() {
  const providerId = imageProviderId()
  const providerName = PROVIDERS.find((p) => p.id === providerId)?.name ?? 'your provider'
  const model = imageModelFor(providerId, (useStore.getState().settings.defaultModel ?? '').split(':')[1])
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('1 / 1')
  const [status, setStatus] = useState<'idle' | 'queued' | 'generating' | 'done' | 'error'>('idle')
  const [images, setImages] = useState<ImageGenerationImage[]>([])
  const [error, setError] = useState<string | undefined>()

  const run = async (text: string) => {
    const p = (text || prompt).trim()
    if (!p || status === 'generating') return
    setStatus('generating')
    setError(undefined)
    try {
      const image = await generateImage({ prompt: p, size: imageSizeFor(ratio) })
      setImages((prev) => [{ ...image, preview: image.src, seed: image.seed }, ...prev])
      setStatus('done')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }

  return (
    <div className="surface p-3">
      <ImageGenerationPanel
        aspectRatio={ratio}
        className="border-0 bg-transparent"
        error={error}
        images={images}
        model={model ?? `${providerName} · no image model`}
        onAspectRatioChange={(v) => setRatio(v)}
        onGenerate={(text) => { void run(String(text ?? '')) }}
        onPromptChange={setPrompt}
        onRetry={() => { void run(prompt) }}
        prompt={prompt}
        status={status}
      />
      {!model && (
        <p className="px-2 pb-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          {providerName} has no image model in the list this app discovered. Settings → Providers: add its key, refresh its
          models, and this card will use whatever image model it offers.
        </p>
      )}
    </div>
  )
}
