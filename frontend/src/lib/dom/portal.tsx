import React from 'react'
import { createPortal } from 'react-dom'

/**
 * Render `children` into `document.body` — or nowhere at all when there is no
 * document.
 *
 * Floating UI here (the dock's name label, the Chats cube, the scroll indicator)
 * is drawn in a portal precisely so that no ancestor's overflow, transform or
 * stacking context can swallow it. Reading `document.body` directly at render
 * time is fine in the browser but throws the moment the same component tree is
 * rendered anywhere else — a server pass, a static build, a headless render
 * used to prove a change — which makes those components impossible to test.
 * One guarded portal keeps the behaviour and removes the crash.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined' || !document.body) return null
  return createPortal(children, document.body)
}
