// The nearest ancestor that actually scrolls, or the window. Several app
// surfaces scroll inside their own pane rather than the page. Written without
// referring to the `Window` global, which is absent in some test harnesses.
export function findScroller(el: Element | null): HTMLElement | Window {
  let n: HTMLElement | null = el?.parentElement ?? null
  while (n) {
    const oy = typeof getComputedStyle === 'function' ? getComputedStyle(n).overflowY : ''
    if (oy === 'auto' || oy === 'scroll') return n
    n = n.parentElement
  }
  return window
}

/** Whether the scroller is the page itself (the window) rather than an element. */
export function isPage(s: HTMLElement | Window): s is Window {
  return s === window
}

export function scrollTopOf(s: HTMLElement | Window): number {
  return isPage(s) ? (window.scrollY || document.documentElement.scrollTop || 0) : s.scrollTop
}
