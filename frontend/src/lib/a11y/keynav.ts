/**
 * Focus rings only for keyboard browsing.
 *
 * Tab and arrow navigation restore visible focus. Pointer presses leave the
 * keyboard mode; a subsequent Tab (including Shift+Tab) must restore it.
 */
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function installKeyboardNav(root: HTMLElement = document.documentElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (NAV_KEYS.has(e.key)) root.setAttribute('data-keynav', 'true')
  }
  const onPointer = () => root.removeAttribute('data-keynav')
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('pointerdown', onPointer, true)
  return () => {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('pointerdown', onPointer, true)
  }
}
