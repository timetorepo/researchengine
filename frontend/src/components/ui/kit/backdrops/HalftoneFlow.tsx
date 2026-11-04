/**
 * Halftone flow: a grid of dots whose size follows a travelling wave, fading
 * out toward the right so the text side stays calm. Drawn from the look of the
 * reference (a dot column that brightens and drifts), not from any source code.
 */
import { CanvasBackdrop, type FrameFn } from './CanvasBackdrop'

const STEP = 14

const draw: FrameFn = (ctx, w, h, t, ink) => {
  const cols = Math.ceil(w / STEP) + 1
  const rows = Math.ceil(h / STEP) + 1
  for (let j = 0; j < rows; j++) {
    const y = j * STEP + STEP / 2
    for (let i = 0; i < cols; i++) {
      const x = i * STEP + STEP / 2
      const nx = x / w
      // Left-weighted falloff: the field is strongest near the left edge.
      const fade = Math.max(0, 1 - nx * 1.35)
      if (fade <= 0.01) continue
      const wave = 0.5 + 0.5 * Math.sin(x * 0.011 - t * 0.9 + Math.sin(y * 0.02 + t * 0.4) * 1.3)
      const r = 0.6 + 4.2 * fade * wave
      const a = (0.1 + 0.55 * fade * wave) * 0.9
      ctx.beginPath()
      ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function HalftoneFlow({ className }: { className?: string }) {
  return <CanvasBackdrop draw={draw} className={className} />
}
