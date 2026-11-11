import type { Notice } from '@/stores/useUI'

/**
 * A one-line bridge between "something happened" and "show it".
 *
 * The UI store raises toasts; the renderer that draws them is a React component
 * (Sonner). Wiring them through this tiny sink keeps the store free of DOM, and
 * keeps every existing `ui.toast(...)` call — and the notice trail that records
 * it — working exactly as before, including in tests where no host is mounted.
 */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger'
export interface ToastRequest { id: string; title: string; body?: string; tone: ToastTone }
export type ToastSink = (t: ToastRequest) => void

let sink: ToastSink | null = null

export function setToastSink(next: ToastSink | null) { sink = next }

/** True when a toast host is mounted and will draw the message itself. */
export function hasToastSink() { return sink !== null }

export function notify(req: ToastRequest) {
  try { sink?.(req) } catch { /* a broken toast must never break the action */ }
}

/** Reading a notice back (used by the diagnostics card and tests). */
export type { Notice }
