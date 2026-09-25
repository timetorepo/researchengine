/**
 * Scoped scrolling.
 *
 * `element.scrollIntoView()` does not scroll "the list". It walks *every*
 * scrollable ancestor and scrolls each one as needed — and a box with
 * `overflow: hidden` still counts: the browser will scroll it (a focus or a
 * scroll request can move it) but the user cannot scroll it back, because it
 * has no scrollbar and ignores the wheel. That is exactly how the app frame
 * (`html` / `body` / `#root`) ended up parked 30-40px down after opening the
 * coding IDE or running a workflow: a chat-end marker or a log tail called
 * `scrollIntoView`, the hidden frame scrolled to reveal it, and the whole app
 * looked "loaded at the bottom" with the top bar clipped off.
 *
 * So: never ask the browser to scroll ancestors. Name the scroll container and
 * move *its* `scrollTop` — nothing above it can move.
 */

/** Smooth only where the browser agrees to it; the fallback is instant. */
function applyScroll(el: HTMLElement, top: number, smooth: boolean) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  const next = Math.max(0, Math.min(max, top))
  if (!smooth) { el.scrollTop = next; return }
  try {
    el.scrollTo({ top: next, behavior: 'smooth' })
    // A browser that ignores the options object leaves us at the old offset.
    if (Math.abs(el.scrollTop - next) > 2 && el.scrollTop === 0) el.scrollTop = next
  } catch {
    el.scrollTop = next
  }
}

/** Scroll a container to its end (chat transcripts, logs). */
export function scrollToEnd(el: HTMLElement | null, opts: { smooth?: boolean } = {}) {
  if (!el) return
  applyScroll(el, el.scrollHeight, opts.smooth ?? false)
}

/**
 * Bring a child into view *inside its own container only*. `block` mirrors the
 * two cases the app actually uses: keep a tab strip item visible (`nearest`),
 * or centre a paragraph (`center`).
 */
export function scrollChildIntoView(
  container: HTMLElement | null,
  child: HTMLElement | null,
  opts: { block?: 'nearest' | 'center'; smooth?: boolean } = {},
) {
  if (!container || !child) return
  const block = opts.block ?? 'nearest'
  const cRect = container.getBoundingClientRect()
  const chRect = child.getBoundingClientRect()
  if (!cRect.height && !chRect.height) { // no layout information (tests): go to the child's offset
    applyScroll(container, child.offsetTop, opts.smooth ?? false)
    return
  }
  const childTop = container.scrollTop + (chRect.top - cRect.top)
  if (block === 'center') {
    applyScroll(container, childTop - (container.clientHeight - chRect.height) / 2, opts.smooth ?? false)
    return
  }
  // nearest: only move when the child is actually outside the visible band.
  const top = container.scrollTop
  const bottom = top + container.clientHeight
  const margin = Math.min(48, container.clientHeight / 4)
  if (childTop - margin < top) applyScroll(container, childTop - margin, opts.smooth ?? false)
  else if (childTop + chRect.height + margin > bottom) {
    applyScroll(container, childTop + chRect.height + margin - container.clientHeight, opts.smooth ?? false)
  }
}

/** The elements that must never keep a scroll offset. */
function frameScrollBoxes(): HTMLElement[] {
  const list: HTMLElement[] = []
  const root = document.getElementById('root')
  if (root) list.push(root)
  if (document.scrollingElement instanceof HTMLElement) list.push(document.scrollingElement)
  if (document.documentElement) list.push(document.documentElement)
  if (document.body) list.push(document.body)
  return [...new Set(list)]
}

/**
 * Belt and braces for the bug above: if anything — our code, a library, the
 * browser resolving a focus — ever scrolls the app frame, put it straight back.
 * Views scroll inside their own containers, so a frame offset is always wrong.
 */
export function installFramePin(): () => void {
  const pin = () => {
    for (const el of frameScrollBoxes()) {
      if (el.scrollTop !== 0) el.scrollTop = 0
      if (el.scrollLeft !== 0) el.scrollLeft = 0
    }
  }
  pin()
  // `scroll` does not bubble, so listen on the window in the capture phase.
  window.addEventListener('scroll', pin, true)
  document.addEventListener('scroll', pin, true)
  window.addEventListener('focusin', pin, true)
  const iv = window.setInterval(pin, 1000)
  return () => {
    window.removeEventListener('scroll', pin, true)
    document.removeEventListener('scroll', pin, true)
    window.removeEventListener('focusin', pin, true)
    window.clearInterval(iv)
  }
}
