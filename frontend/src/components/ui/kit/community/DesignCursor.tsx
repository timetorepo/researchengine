/**
 * A design-mode cursor: a ring with a dot that follows the pointer inside its
 * parent, replacing the system pointer there. It hides when the pointer leaves,
 * and it grows over anything clickable. Off under reduced motion (the system
 * pointer stays, so nothing is lost for those users).
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export function DesignCursor() {
  const reduce = useReducedMotion()
  const dot = useRef<HTMLDivElement>(null)
  const [inside, setInside] = useState(false)
  const [hot, setHot] = useState(false)
  useEffect(() => {
    const host = dot.current?.parentElement
    if (!host || reduce) return
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      if (dot.current) dot.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0) translate(-50%, -50%)`
      const el = e.target as HTMLElement | null
      setHot(!!el?.closest('button, a, [role="button"], input, select, textarea, [role="combobox"], [role="option"]'))
    }
    const enter = () => setInside(true)
    const leave = () => setInside(false)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointerleave', leave)
    host.classList.add('design-cursor-host')
    return () => {
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerenter', enter)
      host.removeEventListener('pointerleave', leave)
      host.classList.remove('design-cursor-host')
    }
  }, [reduce])
  if (reduce) return null
  return (
    <>
      <style>{'.design-cursor-host, .design-cursor-host *:not(input):not(textarea):not(select) { cursor: none !important; }'}</style>
      <div ref={dot} aria-hidden className="pointer-events-none absolute left-0 top-0 z-[60] flex items-center justify-center rounded-full transition-[width,height,opacity] duration-150"
        style={{
          width: hot ? 34 : 18, height: hot ? 34 : 18, opacity: inside ? 1 : 0,
          border: '1.5px solid var(--primary)', background: hot ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent',
          mixBlendMode: 'difference',
        }}>
        <span className="rounded-full" style={{ width: 4, height: 4, background: 'var(--primary)' }} />
      </div>
    </>
  )
}
