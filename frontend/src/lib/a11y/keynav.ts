/**
 * Focus rings only for keyboard browsing.
 *
 * The app hides focus outlines by default (see globals.css). An arrow key sets
 * `data-keynav="true"` on <html>, which brings the rings back so the user can see
 * where they are. A pointer press turns them off again. Tab alone does not change
 * the state, so keyboard users who only tab keep the default look until they use
 * an arrow key.
 */
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function installKeyboardNav(root: HTMLElement = document.documentElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (ARROWS.has(e.key)) root.setAttribute('data-keynav', 'true')
  }
  const onPointer = () => root.removeAttribute('data-keynav')
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('pointerdown', onPointer, true)
  return () => {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('pointerdown', onPointer, true)
  }
}
