import React, { useEffect, useRef } from 'react'
import type { BgThemeProps } from '@/lib/backgrounds/themeProps'

/**
 * ShapeGrid — a slowly drifting field of small geometric shapes.
 * Neutral tones only by design: grays with low alpha, never theme accents
 * colors, so it stays crisp and readable under every theme. Light themes
 * get dark-gray shapes, dark themes light-gray ones.
 */
export default function ShapeGrid({ theme, intensity = 0.6 }: { theme: BgThemeProps; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const CELL = 56
    let raf = 0
    let running = true
    let w = 0, h = 0, cols = 0, rows = 0
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / CELL) + 1
      rows = Math.ceil(h / CELL) + 1
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // deterministic hash so the field is stable across frames
    const hash = (x: number, y: number) => {
      let n = x * 374761393 + y * 668265263
      n = (n ^ (n >> 13)) * 1274126177
      return ((n ^ (n >> 16)) >>> 0) / 4294967295
    }

    const stroke = theme.isLight ? '32, 32, 38' : '235, 235, 240'
    const alphaBase = 0.05 + intensity * 0.1

    const drawShape = (type: number, x: number, y: number, s: number, rot: number, alpha: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = `rgb(${stroke})`
      ctx.lineWidth = 1
      ctx.beginPath()
      if (type < 0.28) {
        // square
        ctx.rect(-s / 2, -s / 2, s, s)
      } else if (type < 0.5) {
        // triangle
        ctx.moveTo(0, -s / 2)
        ctx.lineTo(s / 2, s / 2)
        ctx.lineTo(-s / 2, s / 2)
        ctx.closePath()
      } else if (type < 0.72) {
        // circle
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2)
      } else if (type < 0.88) {
        // plus
        ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0)
        ctx.moveTo(0, -s / 2); ctx.lineTo(0, s / 2)
      } else {
        // diamond
        ctx.moveTo(0, -s / 2)
        ctx.lineTo(s / 2, 0)
        ctx.lineTo(0, s / 2)
        ctx.lineTo(-s / 2, 0)
        ctx.closePath()
      }
      ctx.stroke()
      ctx.restore()
    }

    let start = performance.now()
    const frame = (now: number) => {
      if (!running) return
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, w, h)
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const r = hash(gx, gy)
          if (r > 0.62) continue // sparse field
          const type = hash(gx * 7 + 13, gy * 5 + 71)
          const phase = r * Math.PI * 2
          const drift = 3.5 + r * 3
          const x = gx * CELL + CELL / 2 + Math.sin(t * 0.22 + phase) * drift
          const y = gy * CELL + CELL / 2 + Math.cos(t * 0.17 + phase * 1.3) * drift
          const rot = t * (0.05 + r * 0.06) * (r > 0.5 ? 1 : -1) + phase
          const size = 9 + hash(gx * 3 + 5, gy * 11 + 3) * 9
          const alpha = alphaBase * (0.5 + 0.5 * Math.sin(t * 0.3 + phase * 2))
          drawShape(type, x, y, size, rot, Math.max(0.015, alpha))
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onVis = () => {
      // pause work entirely while the tab is hidden
      if (document.visibilityState === 'hidden') {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        start = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [theme.isLight, intensity])

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden="true" />
}
