/**
 * Local models, from the browser: search Hugging Face (through our server, so the
 * browser never needs Hugging Face's CORS headers), pull a GGUF into Ollama with
 * live progress, list what is installed, and remove a model.
 *
 * Nothing here runs a model. Ollama does that on this machine.
 */
import type { Quant } from './fit'

export type LocalCategory = 'official' | 'abliterated' | 'optimized'

export const CATEGORIES: { id: LocalCategory; label: string; blurb: string; caution?: string }[] = [
  { id: 'official', label: 'Official', blurb: 'Published by the lab that made the model.' },
  {
    id: 'abliterated',
    label: 'Abliterated',
    blurb: 'Community variants with refusals removed.',
    caution: 'These models answer requests the official versions decline. You are responsible for how you use them.',
  },
  { id: 'optimized', label: 'Optimized', blurb: 'Quantised re-uploads from people who make local models fast and small.' },
]

export interface HfModel {
  repo: string
  author: string
  downloads: number
  likes: number
  paramsB: number | null
}

export interface InstalledModel { name: string; size: number }

export async function searchLocalModels(category: LocalCategory, q: string): Promise<HfModel[]> {
  const params = new URLSearchParams({ category, q: q.trim() })
  const res = await fetch(`/api/ollama/hf-search?${params}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Search failed (${res.status}).`)
  return Array.isArray(body?.models) ? body.models : []
}

/** The name Ollama uses for a Hugging Face GGUF at a given quantisation. */
export function ollamaNameFor(repo: string, quant: Quant): string {
  return `hf.co/${repo}:${quant}`
}

export interface PullProgress { status: string; completed?: number; total?: number }

/**
 * Pull a model and report each progress frame. Resolves when Ollama says success;
 * rejects with Ollama's own message if the download fails.
 */
export async function pullLocalModel(name: string, onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/ollama/pull', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
    signal,
  })
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `The download did not start (${res.status}).`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  while (!done) {
    const { value, done: finished } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let frame: any
      try { frame = JSON.parse(line) } catch { continue }
      if (frame.error) throw new Error(String(frame.error))
      onProgress({ status: String(frame.status ?? ''), completed: frame.completed, total: frame.total })
      if (frame.status === 'success') done = true
    }
    if (finished) break
  }
  if (!done) throw new Error('The download stopped before Ollama finished. Try again.')
}

/** Null when Ollama cannot be reached; an empty list when it is running with nothing installed. */
export async function installedLocalModels(): Promise<InstalledModel[] | null> {
  try {
    const res = await fetch('/api/ollama/tags')
    if (!res.ok) return null
    const body = await res.json()
    return Array.isArray(body?.models) ? body.models.map((m: any) => ({ name: String(m.name), size: Number(m.size ?? 0) })) : []
  } catch {
    return null
  }
}

export async function removeLocalModel(name: string): Promise<void> {
  const res = await fetch('/api/ollama/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Could not remove it (${res.status}).`)
  }
}
