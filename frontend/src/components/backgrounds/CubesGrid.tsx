/**
 * Cubes grid background — an isometric field of cubes that ripples.
 *
 * The behaviour and prop names follow Aceternity UI's free "Background Cubes
 * Grid" (isometric variant): a flat field of cubes, a wave that runs out from
 * wherever the pointer moves, and random ripples once the pointer goes idle.
 * The drawing code here is this app's own; the upstream registry was not
 * reachable when it was written, so the source was not copied.
 *
 * Cost, kept small on purpose:
 * - one 2D canvas, sized to the parent and capped at 1.5× device pixels;
 * - frames capped at 30 fps, and no drawing while the element is off screen;
 * - no allocation per frame beyond the cube list, and at most 8 live ripples.
 */
import { useEffect, useRef } from 'react'
import { mixVec3, type BgThemeProps, type Vec3 } from '@/lib/backgrounds/themeProps'

export interface CubesGridProps {
  theme: BgThemeProps
  /** Strength of the glow on the wave crests, 0 to 1. */
  intensity?: number
  /** On-screen width of one cube, in pixels. */
  cellSize?: number
  /** Seam between cubes, as a fraction of a cell. */
  gap?: number
  /** Wave height, in cells. */
  amplitude?: number
  /** Seconds the grid stays calm before random ripples start. */
  idleDelay?: number
  className?: string
}

interface Ripple { x: number; y: number; t0: number; strength: number }

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5
const MAX_RIPPLES = 8
const FRAME_MS = 1000 / 30
const SPEED = 7 // cells per second
const DAMPING = 0.55 // per second

const rgb = (v: Vec3) => `rgb(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)})`

export function CubesGrid({
  theme,
  intensity = 0.6,
  cellSize = 84,
  gap = 0.04,
  amplitude = 0.55,
  idleDelay = 1.5,
  className = '',
}: CubesGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let dpr = 1
    let G = 0 // world cells per side, sized to cover the viewport
    let ox = 0
    let oy = 0
    let visible = true
    let raf = 0
    let last = 0
    const ripples: Ripple[] = []
    let lastInput = performance.now()
    let nextIdle = 0
    let lastSpawn = 0
    let pointer: { x: number; y: number } | null = null

    const bg = theme.bg
    const top0 = mixVec3(bg, theme.primary, 0.1)
    const glow = mixVec3(bg, theme.primary, 0.55 * intensity)
    const black: Vec3 = [0, 0, 0]

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      G = Math.ceil(Math.hypot(w, h) / cellSize) + 4
      ox = w / 2
      oy = h / 2 - G * SIN30 * cellSize
    }

    // Screen position of a point in world cells, lifted by a height in cells.
    const proj = (x: number, y: number, z: number): [number, number] => [
      ox + (x - y) * COS30 * cellSize,
      oy + (x + y) * SIN30 * cellSize - z * cellSize,
    ]

    // Inverse of proj at z = 0, to turn a screen point into a world cell.
    const toWorld = (sx: number, sy: number): [number, number] => {
      const px = (sx - ox) / cellSize
      const py = (sy - oy) / cellSize
      return [(px / COS30 + py / SIN30) / 2, (py / SIN30 - px / COS30) / 2]
    }

    const spawn = (x: number, y: number, strength: number, now: number) => {
      if (ripples.length >= MAX_RIPPLES) ripples.shift()
      ripples.push({ x, y, t0: now, strength })
    }

    // Height of the field at a cell, in cells.
    const heightAt = (x: number, y: number, now: number) => {
      let z = 0.08 * Math.sin(x * 0.35 + now * 0.6) * Math.cos(y * 0.3 - now * 0.4)
      for (const r of ripples) {
        const age = now - r.t0
        const d = Math.hypot(x - r.x, y - r.y)
        const front = age * SPEED
        const ring = Math.abs(d - front)
        if (ring > 3.2) continue
        // A crest that travels out and decays, so each ripple dies down on its own.
        z += r.strength * Math.cos(ring * 1.6) * Math.exp(-age * DAMPING) * (1 - ring / 3.2)
      }
      return amplitude * z + amplitude * 0.5
    }

    const faces = (
      x0: number, y0: number, x1: number, y1: number, H: number,
    ) => {
      const t = [proj(x0, y0, H), proj(x1, y0, H), proj(x1, y1, H), proj(x0, y1, H)]
      const left = [proj(x0, y1, H), proj(x1, y1, H), proj(x1, y1, 0), proj(x0, y1, 0)]
      const right = [proj(x1, y0, H), proj(x1, y1, H), proj(x1, y1, 0), proj(x1, y0, 0)]
      return { t, left, right }
    }

    const fillPoly = (pts: [number, number][], color: string) => {
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const half = Math.floor(G / 2)
      const seam = gap
      for (let s = 0; s < G * 2 - 1; s++) {
        // Walk diagonals from back to front so nearer cubes overdraw farther ones.
        for (let i = Math.max(0, s - G + 1); i <= Math.min(G - 1, s); i++) {
          const j = s - i
          const x0 = i - half + seam
          const y0 = j - half + seam
          const x1 = i - half + 1 - seam
          const y1 = j - half + 1 - seam
          const H = heightAt(i - half + 0.5, j - half + 0.5, now)
          const { t, left, right } = faces(x0, y0, x1, y1, H)
          // Cull cubes that fall outside the canvas.
          const sx = t[0][0]
          const sy = t[0][1]
          if (sx < -cellSize * 3 || sx > w + cellSize * 3 || sy < -cellSize * 3 || sy > h + cellSize * 3) continue
          const crest = Math.max(0, Math.min(1, (H - amplitude * 0.5) / (amplitude * 0.9 + 1e-6)))
          const topC = mixVec3(top0, glow, crest * intensity * 0.75)
          fillPoly(left, rgb(mixVec3(topC, black, 0.2 + 0.05 * crest)))
          fillPoly(right, rgb(mixVec3(topC, black, 0.32 + 0.05 * crest)))
          fillPoly(t, rgb(topC))
        }
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      if (now - last < FRAME_MS) return
      last = now
      const t = now / 1000
      // Idle ripples: once the pointer has been still for a while, drop one now and then.
      if (performance.now() - lastInput > idleDelay * 1000 && t > nextIdle) {
        const [x, y] = toWorld(w * (0.2 + Math.random() * 0.6), h * (0.2 + Math.random() * 0.6))
        spawn(x, y, 0.9, t)
        nextIdle = t + 2.5 + Math.random() * 2
      }
      draw(t)
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      lastInput = performance.now()
      const moved = pointer ? Math.hypot(x - pointer.x, y - pointer.y) : 999
      pointer = { x, y }
      const t = performance.now() / 1000
      // Throttle ripples so a fast pointer does not flood the buffer.
      if (moved > 24 && t - lastSpawn > 0.28) {
        const [wx, wy] = toWorld(x, y)
        spawn(wx, wy, 0.9, t)
        lastSpawn = t
      }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: 0 })
    io.observe(canvas)
    window.addEventListener('pointermove', onMove, { passive: true })
    nextIdle = 0
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [theme, cellSize, gap, amplitude, idleDelay, intensity])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  )
}

export default CubesGrid
