// The artifact currently open in the side panel. Not persisted: a preview is a
// view on one code block, not part of the chat history.
import { create } from 'zustand'

export interface OpenArtifact {
  title: string
  lang: string
  code: string
}

interface ArtifactState {
  current: OpenArtifact | null
  open: (a: OpenArtifact) => void
  close: () => void
}

export const useArtifacts = create<ArtifactState>((set) => ({
  current: null,
  open: (a) => set({ current: a }),
  close: () => set({ current: null }),
}))

/** Publish a preview document to the local backend and return its localhost URL. */
export async function publishPreview(html: string): Promise<{ url: string }> {
  const res = await fetch('/api/artifacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data?.url !== 'string') {
    throw new Error(data?.error ?? `The preview could not be started (${res.status}).`)
  }
  return { url: data.url as string }
}
