/**
 * Keep a container still while its content changes.
 *
 * The Library's own scroller is a div, not the app frame, so the frame pin in
 * `lib/dom/scroll.ts` never touches it — and neither does any of the app's
 * scoped scroll helpers, because nothing called them here.
 *
 * The reported bug was exactly this shape: "opening a folder makes the page
 * reload and go all the way up". It was not a reload — every result was still on
 * screen when the reader landed at the top, and no component in the app calls
 * scrollTo(0) on this route. What fits that evidence is a layout clamp: choosing
 * a folder removes rows from the saved panel, the page gets shorter, and when it
 * ends up shorter than the viewport the browser's own clamp target is zero. That
 * mechanism could not be reproduced in this environment (there is no browser
 * here), so this hook does not depend on it being the only one: whatever the
 * offset was, after a content change it is put back.
 *
 * The recording is continuous, so a scroll the reader made is never undone. The
 * restore is clamped to what the container can hold now, which is the honest
 * answer when the content really did get shorter — and the Library also holds
 * the height of the folder shelf and the save list, so in practice there is
 * nothing to clamp against.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'

export function useScrollKeeper<T extends HTMLElement>(token: unknown) {
  const ref = useRef<T | null>(null)
  const last = useRef(0)
  const prevToken = useRef(token)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const record = () => { last.current = el.scrollTop }
    record()
    el.addEventListener('scroll', record, { passive: true })
    return () => el.removeEventListener('scroll', record)
  }, [])

  useLayoutEffect(() => {
    if (prevToken.current === token) return
    prevToken.current = token
    const el = ref.current
    if (!el) return
    const wanted = last.current
    if (wanted <= 0) return
    // Clamp against the container's own size — but only when it has one. A
    // container that reports no height (hidden, not laid out yet, or a test
    // environment without a layout engine) must not be read as "the page is 0px
    // tall, put the reader at the top": asking for the old offset is a no-op
    // there, and the browser clamps it for real when there is something to
    // clamp against.
    const measured = el.clientHeight > 0 && el.scrollHeight > 0
    const max = measured ? Math.max(0, el.scrollHeight - el.clientHeight) : wanted
    const next = Math.min(wanted, max)
    if (Math.abs(el.scrollTop - next) > 1) {
      el.scrollTop = next
      last.current = next
    }
  }, [token])

  return ref
}

export default useScrollKeeper
