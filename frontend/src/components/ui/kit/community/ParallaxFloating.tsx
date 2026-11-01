/**
 * Parallax floating: children sit at different depths and drift toward the
 * pointer by an amount set by their depth, so near items move more than far
 * ones. It follows the pointer over the frame, and is still under reduced motion.
 */
import { createContext, useContext, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { useReducedMotion } from 'motion/react'

const Ctx = createContext<{ x: number; y: number; on: boolean }>({ x: 0, y: 0, on: false })

export function ParallaxFloating({ children, sensitivity = 1, className = '' }: { children: ReactNode; sensitivity?: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState({ x: 0, y: 0 })
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setP({ x: ((e.clientX - r.left) / r.width - 0.5) * sensitivity, y: ((e.clientY - r.top) / r.height - 0.5) * sensitivity })
  }
  return (
    <Ctx.Provider value={{ ...p, on: !reduce }}>
      <div ref={ref} onPointerMove={onMove} onPointerLeave={() => setP({ x: 0, y: 0 })} className={`relative overflow-hidden ${className}`}>
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function FloatingItem({ depth = 1, className = '', children }: { depth?: number; className?: string; children: ReactNode }) {
  const { x, y, on } = useContext(Ctx)
  return (
    <div
      className={`absolute transition-transform duration-500 ease-out ${className}`}
      style={{ transform: on ? `translate3d(${-x * depth * 28}px, ${-y * depth * 28}px, 0)` : undefined }}
    >
      {children}
    </div>
  )
}
