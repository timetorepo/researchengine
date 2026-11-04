/**
 * Recursive erosion: contour lines of a slowly moving field, drawn as thin
 * strokes. It is a generative look modelled on the name, not a port of any source.
 */
import { CanvasBackdrop, type FrameFn } from './CanvasBackdrop'

function field(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.012 + t * 0.35) * 0.5 +
    Math.sin(y * 0.017 - t * 0.27) * 0.5 +
    Math.sin((x + y) * 0.008 + t * 0.19) * 0.6 +
    Math.sin(Math.hypot(x - 300, y - 200) * 0.018 - t * 0.5) * 0.4
  )
}

const draw: FrameFn = (ctx, w, h, t, ink) => {
  const cell = 10
  const levels = [-0.9, -0.45, 0, 0.45, 0.9]
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(${ink},0.14)`
  for (const level of levels) {
    ctx.beginPath()
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const v = field(x, y, t) - level
        const vx = field(x + cell, y, t) - level
        const vy = field(x, y + cell, t) - level
        // Mark the cell edges that cross the level, so the lines stay continuous.
        if (v * vx < 0) { const k = v / (v - vx); ctx.moveTo(x + k * cell, y); ctx.lineTo(x + k * cell + 0.5, y + 0.5) }
        if (v * vy < 0) { const k = v / (v - vy); ctx.moveTo(x, y + k * cell); ctx.lineTo(x + 0.5, y + k * cell + 0.5) }
      }
    }
    ctx.stroke()
  }
}

export function RecursiveErosion({ className }: { className?: string }) {
  return <CanvasBackdrop draw={draw} className={className} />
}
