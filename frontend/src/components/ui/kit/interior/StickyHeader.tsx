// Interior-style sticky header: sticks to the top of its scroll pane and gains
// a hairline and blur once the content underneath starts to scroll.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { findScroller, scrollTopOf } from './scroller'

export function StickyHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const scroller = findScroller(ref.current)
    const read = () => setStuck(scrollTopOf(scroller) > 4)
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    return () => scroller.removeEventListener('scroll', read)
  }, [])
  return (
    <div ref={ref} className={`sticky top-0 z-10 transition-[box-shadow,background] duration-200 ${className}`}
      style={{ background: stuck ? 'color-mix(in srgb, var(--bg) 82%, transparent)' : 'transparent', backdropFilter: stuck ? 'blur(10px)' : 'none', boxShadow: stuck ? '0 1px 0 var(--surface-border)' : 'none' }}>
      {children}
    </div>
  )
}
