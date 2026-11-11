/**
 * A full-bleed canvas behind the chat, drawn by a frame function. It sizes to
 * its box, follows the device pixel ratio, and pauses while the tab is hidden.
 * With reduced motion it draws one still frame instead of animating.
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

export type FrameFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ink: string) => void

export function CanvasBackdrop({ draw, ink = '255,255,255', className = '' }: { draw: FrameFn; ink?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = 0
    let h = 0
    const size = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, r.width)
      h = Math.max(1, r.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null
    ro?.observe(canvas)
    const start = performance.now()
    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      draw(ctx, w, h, reduce ? 0 : (now - start) / 1000, ink)
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [draw, ink, reduce])
  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 w-full h-full ${className}`} />
}
