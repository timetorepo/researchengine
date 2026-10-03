// Thin client over the backend preview endpoints.

export interface PreviewState {
  running: boolean
  project: string
  kind?: string
  command?: string
  port?: number
  internalPort?: number | null
  url?: string
  startedAt?: number
  ready?: boolean
  error?: string | null
  logs?: string[]
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any)?.error ?? `Preview request failed (${res.status})`)
  return json as T
}

export async function previewStatus(project: string): Promise<PreviewState> {
  try {
    const res = await fetch(`/api/ide/preview/status?project=${encodeURIComponent(project)}`)
    return await res.json()
  } catch {
    return { running: false, project }
  }
}

export async function startPreview(project: string, restart = false): Promise<PreviewState> {
  return await post<PreviewState>('/api/ide/preview/start', { project, restart })
}

export async function stopPreview(project: string): Promise<void> {
  await post('/api/ide/preview/stop', { project })
}

export async function reloadPreview(project: string): Promise<PreviewState> {
  return await post<PreviewState>('/api/ide/preview/reload', { project })
}

/** Poll until the dev server reports ready (or give up). */
export async function waitForServer(project: string, timeoutMs = 45_000): Promise<PreviewState> {
  const deadline = Date.now() + timeoutMs
  let last: PreviewState = await previewStatus(project)
  while (Date.now() < deadline) {
    if (last.running && last.ready) return last
    if (last.running && last.error) return last
    if (!last.running) return last
    await new Promise((r) => setTimeout(r, 800))
    last = await previewStatus(project)
  }
  return last
}

/** Start (or restart) the preview and wait for the server to answer. */
export async function ensurePreviewServer(project: string, restart = false): Promise<PreviewState> {
  const current = await previewStatus(project)
  if (current.running && current.ready && !restart) return current
  const started = await startPreview(project, restart || current.running)
  if (started.ready && !started.error) return started
  return await waitForServer(project)
}

/**
 * The sizes Design Mode checks. Phones, tablets, laptops, TV — the four the
 * user asked for, with the large variants that actually catch layout bugs
 * (a 320 px phone and a 4K television both break things a 390 px phone does
 * not).
 */
export const DEVICE_PRESETS = [
  { id: 'phone-sm', label: 'Phone S', w: 320, h: 568, icon: 'smartphone' },
  { id: 'phone', label: 'Phone', w: 390, h: 844, icon: 'smartphone' },
  { id: 'phone-lg', label: 'Phone L', w: 430, h: 932, icon: 'smartphone' },
  { id: 'tablet', label: 'Tablet', w: 834, h: 1112, icon: 'tablet' },
  { id: 'tablet-lg', label: 'Tablet L', w: 1024, h: 1366, icon: 'tablet' },
  { id: 'laptop', label: 'Laptop', w: 1280, h: 800, icon: 'monitor' },
  { id: 'desktop', label: 'Desktop', w: 1440, h: 900, icon: 'monitor' },
  { id: 'desktop-lg', label: 'Desktop L', w: 1920, h: 1200, icon: 'monitor' },
  { id: 'tv', label: 'TV', w: 1920, h: 1080, icon: 'tv' },
  { id: 'tv-4k', label: 'TV 4K', w: 3840, h: 2160, icon: 'tv' },
  { id: 'fill', label: 'Fill pane', w: 0, h: 0, icon: 'maximize' },
] as const

export type DeviceId = typeof DEVICE_PRESETS[number]['id']
