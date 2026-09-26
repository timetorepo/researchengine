/**
 * The quiz share card: drawn, not screenshotted.
 *
 * The old share was a gradient with text stamped on it. This module renders a
 * real composition to a canvas — layered type, a score dial, stat cells, the
 * quiz name, the maker's mark — in one of four finished looks:
 *
 *   liquid  — frosted glass panels over a soft, colour-bled wash
 *   gradient — a clean diagonal wash with the score reversed out of it
 *   solid    — flat colour, generous type, nothing competing
 *   image    — your own picture behind a scrim that keeps the text readable
 *
 * Everything is a pure function of (data, options), so the preview and the
 * downloaded file are the same pixels — no "the preview looked better" gap.
 */
import type { QuizQuestion } from '@/types'

export type ShareStyleId = 'liquid' | 'gradient' | 'solid' | 'image'

export interface ShareOptions {
  style: ShareStyleId
  /** Accent pair used by every style (the theme's primary/secondary by default). */
  from: string
  to: string
  /** Whether the card carries the quiz name. */
  showTitle: boolean
  showSource: boolean
  showStreak: boolean
  showMaker: boolean
  /** One line of your own. */
  caption: string
  /** Data-URL of the background picture, for style "image". */
  imageDataUrl?: string | null
}

export interface ShareData {
  title: string
  source?: string
  pct: number
  correct: number
  total: number
  streakBest: number
}

export const SHARE_W = 1080
export const SHARE_H = 1350 // 4:5 — fits every feed without cropping

export const SHARE_STYLES: { id: ShareStyleId; label: string; blurb: string }[] = [
  { id: 'liquid', label: 'Liquid glass', blurb: 'Frosted panels over a colour-bled wash' },
  { id: 'gradient', label: 'Gradient', blurb: 'Clean diagonal wash, score reversed out' },
  { id: 'solid', label: 'Solid', blurb: 'Flat colour, big type, nothing else' },
  { id: 'image', label: 'Custom image', blurb: 'Your picture behind a readable scrim' },
]

/* ---------------- colour helpers ---------------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6) || '6c8eef', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
/** Pick black or white text for a background, by perceived luminance. */
export function readableOn(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.62 ? '#0B0D12' : '#FFFFFF'
}

/** The grade a score earns — used for the ring, the chip and the caption. */
export function grade(pct: number) {
  if (pct >= 90) return { label: 'Outstanding', tone: '#34D399' }
  if (pct >= 80) return { label: 'Excellent', tone: '#22D3EE' }
  if (pct >= 60) return { label: 'Solid work', tone: '#FBBF24' }
  if (pct >= 40) return { label: 'Getting there', tone: '#FB923C' }
  return { label: 'Worth another pass', tone: '#F87171' }
}

/* ---------------- drawing pieces ---------------- */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function glassPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, light: boolean) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = light ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.10)'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = light ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.22)'
  ctx.stroke()
  // The top-edge sheen that makes a panel read as glass rather than a box.
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.5)
  sheen.addColorStop(0, 'rgba(255,255,255,0.16)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = sheen
  ctx.fill()
}

/** Breaks a word that is wider than the whole line (a URL, a hash, a filename). */
function breakLongWord(ctx: CanvasRenderingContext2D, word: string, maxW: number) {
  const parts: string[] = []
  let chunk = ''
  for (const ch of word) {
    if (chunk && ctx.measureText(chunk + ch).width > maxW) { parts.push(chunk); chunk = ch }
    else chunk += ch
  }
  if (chunk) parts.push(chunk)
  return parts
}

/**
 * Wraps a line of text to `maxW`, returning the lines it broke into.
 *
 * A single token longer than the line used to be pushed through untouched — and
 * a caption is exactly where a URL ends up, so the text ran straight off the
 * card. Anything that cannot fit is now broken mid-word.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean).flatMap((w) => (ctx.measureText(w).width > maxW ? breakLongWord(ctx, w, maxW) : [w]))
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = w } else line = next
    if (lines.length === maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines) {
    // Ellipsise the tail rather than cutting a word in half.
    let last = lines[maxLines - 1]
    while (last.length > 4 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    const joined = words.join(' ')
    if (joined.length > lines.join(' ').length) lines[maxLines - 1] = `${last}…`
  }
  return lines
}

/** Draws the score ring; returns nothing — the caller places the numbers. */
function scoreRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pct: number, track: string, fill: string) {
  ctx.lineWidth = 18
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = track
  ctx.stroke()
  const end = -Math.PI / 2 + (Math.PI * 2 * Math.min(100, Math.max(0, pct))) / 100
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  grad.addColorStop(0, fill)
  grad.addColorStop(1, mix(fill, '#FFFFFF', 0.35))
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, end)
  ctx.strokeStyle = grad
  ctx.stroke()
}

const FONT = (weight: number, size: number, mono = false) =>
  `${weight} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Inter, -apple-system, "Segoe UI", system-ui, sans-serif'}`

/**
 * Paint the whole card. `image` is an already-decoded HTMLImageElement (or
 * null) — decoding is the caller's job so this stays synchronous and testable.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareData,
  opts: ShareOptions,
  image: HTMLImageElement | null = null,
): void {
  const W = SHARE_W, H = SHARE_H
  const g = grade(data.pct)
  const dark = opts.style === 'image' || opts.style === 'liquid'
  const ink = dark ? '#FFFFFF' : readableOn(opts.from)
  const inkSoft = dark ? 'rgba(255,255,255,0.72)' : rgba(ink === '#FFFFFF' ? '#FFFFFF' : '#0B0D12', 0.66)
  const panelLight = false

  ctx.save()
  ctx.clearRect(0, 0, W, H)

  /* ---- background per style ---- */
  if (opts.style === 'image' && image) {
    // Cover-fit the picture, then a scrim heavy enough for black-on-white text
    // anywhere on the card — a shared card has to be readable at thumbnail size.
    const scale = Math.max(W / image.width, H / image.height)
    const dw = image.width * scale, dh = image.height * scale
    ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh)
    const scrim = ctx.createLinearGradient(0, 0, 0, H)
    scrim.addColorStop(0, 'rgba(6,8,14,0.55)')
    scrim.addColorStop(0.45, 'rgba(6,8,14,0.72)')
    scrim.addColorStop(1, 'rgba(6,8,14,0.88)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, W, H)
    // A whisper of the accent so the card still belongs to the app.
    const tint = ctx.createLinearGradient(0, 0, W, H)
    tint.addColorStop(0, rgba(opts.from, 0.30))
    tint.addColorStop(1, rgba(opts.to, 0.22))
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, W, H)
  } else if (opts.style === 'solid') {
    ctx.fillStyle = opts.from
    ctx.fillRect(0, 0, W, H)
    // Two soft radial lifts keep flat colour from looking dead.
    const lift = ctx.createRadialGradient(180, 120, 20, 180, 120, 900)
    lift.addColorStop(0, rgba('#FFFFFF', 0.16))
    lift.addColorStop(1, rgba('#FFFFFF', 0))
    ctx.fillStyle = lift
    ctx.fillRect(0, 0, W, H)
  } else {
    // gradient + the base of liquid
    ctx.fillStyle = mix('#0B0D12', opts.from, 0.35)
    ctx.fillRect(0, 0, W, H)
    const wash = ctx.createLinearGradient(0, 0, W, H)
    wash.addColorStop(0, opts.from)
    wash.addColorStop(0.55, mix(opts.from, opts.to, 0.6))
    wash.addColorStop(1, opts.to)
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, W, H)
    if (opts.style === 'liquid') {
      // Colour blobs under frosted panels — the "liquid" part.
      const blob = (cx: number, cy: number, r: number, colour: string, a: number) => {
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        rg.addColorStop(0, rgba(colour, a))
        rg.addColorStop(1, rgba(colour, 0))
        ctx.fillStyle = rg
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      }
      blob(140, 220, 520, '#ffffff', 0.28)
      blob(W - 120, 420, 620, opts.to, 0.5)
      blob(260, H - 180, 620, opts.from, 0.45)
      blob(W - 200, H - 60, 380, '#ffffff', 0.16)
      // A fine grain so the wash has texture instead of banding.
      ctx.globalAlpha = 0.05
      for (let i = 0; i < 2400; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#000'
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
      }
      ctx.globalAlpha = 1
    }
  }

  const M = 84 // margin
  let y = M + 6

  /* ---- header ---- */
  ctx.textBaseline = 'alphabetic'
  ctx.font = FONT(700, 26)
  const brand = 'RESEARCH ENGINE'
  const brandW = ctx.measureText(brand).width
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.92)' : rgba(ink, 0.9)
  ctx.fillText(brand, M, y + 26)
  ctx.font = FONT(600, 24)
  const gradeText = g.label.toUpperCase()
  const gradeW = ctx.measureText(gradeText).width
  const chipW = gradeW + 40
  const chipX = W - M - chipW
  if (opts.style === 'liquid' || opts.style === 'image') {
    glassPanel(ctx, chipX, y, chipW, 44, 22, panelLight)
  } else {
    roundRect(ctx, chipX, y, chipW, 44, 22)
    ctx.fillStyle = rgba(g.tone, 0.20)
    ctx.fill()
  }
  ctx.fillStyle = opts.style === 'gradient' || opts.style === 'solid' ? ink : g.tone
  ctx.fillText(gradeText, chipX + 20, y + 31)
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : rgba(ink, 0.22)
  ctx.fillRect(M, y + 62, W - M * 2, 1)
  y += 62 + 74

  /* ---- score block ---- */
  const star = dark ? 'rgba(255,255,255,0.20)' : rgba(ink, 0.18)
  const pctText = `${data.pct}%`
  ctx.textAlign = 'center'
  if (opts.style === 'liquid' || opts.style === 'image') {
    glassPanel(ctx, M, y - 20, W - M * 2, 380, 40, panelLight)
  }
  scoreRing(ctx, W / 2, y + 150, 128, data.pct, star, dark ? '#FFFFFF' : mix(opts.from, '#FFFFFF', 0.35))
  ctx.fillStyle = ink
  ctx.font = FONT(800, 150)
  ctx.fillText(pctText, W / 2, y + 205)
  ctx.font = FONT(500, 30)
  ctx.fillStyle = inkSoft
  ctx.fillText(`${data.correct} of ${data.total} correct`, W / 2, y + 268)
  ctx.textAlign = 'left'
  y += (opts.style === 'liquid' || opts.style === 'image') ? 400 : 356

  /* ---- stat cells ---- */
  const cells: { k: string; v: string }[] = []
  if (opts.showStreak) cells.push({ k: 'BEST STREAK', v: `${data.streakBest}` })
  cells.push({ k: 'ACCURACY', v: `${data.pct}%` })
  cells.push({ k: 'QUESTIONS', v: `${data.total}` })
  const gap = 20
  const cw = (W - M * 2 - gap * (cells.length - 1)) / cells.length
  const ch = 132
  cells.forEach((c, i) => {
    const x = M + i * (cw + gap)
    if (opts.style === 'liquid' || opts.style === 'image') glassPanel(ctx, x, y, cw, ch, 28, panelLight)
    else {
      roundRect(ctx, x, y, cw, ch, 28)
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.10)' : rgba(ink, 0.08)
      ctx.fill()
    }
    ctx.fillStyle = ink
    ctx.font = FONT(700, 40)
    ctx.fillText(c.v, x + 26, y + 66)
    ctx.font = FONT(600, 18)
    ctx.fillStyle = inkSoft
    ctx.fillText(c.k, x + 26, y + 100)
  })
  y += ch + 56

  /* ---- title + source ---- */
  if (opts.showTitle) {
    ctx.fillStyle = ink
    ctx.font = FONT(650, 44)
    for (const line of wrap(ctx, data.title || 'Quiz', W - M * 2, 2)) {
      ctx.fillText(line, M, y + 34)
      y += 56
    }
  }
  if (opts.showSource && data.source) {
    ctx.font = FONT(500, 24)
    ctx.fillStyle = inkSoft
    y += 10
    ctx.fillText(`from ${data.source}`.slice(0, 72), M, y)
  }

  /* ---- caption ---- */
  if (opts.caption.trim()) {
    ctx.font = FONT(500, 26)
    ctx.fillStyle = inkSoft
    const lines = wrap(ctx, opts.caption.trim(), W - M * 2, 2)
    for (const line of lines) { y += 40; ctx.fillText(line, M, y) }
  }

  /* ---- footer ---- */
  const footY = H - M + 6
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.30)' : rgba(ink, 0.24)
  ctx.fillRect(M, footY - 52, W - M * 2, 1)
  if (opts.showMaker) {
    ctx.font = FONT(600, 24)
    ctx.fillStyle = ink
    ctx.fillText('dnishh', M, footY)
    ctx.font = FONT(500, 22)
    ctx.fillStyle = inkSoft
    ctx.fillText('Research Engine · on-device research', M + 106, footY)
  }
  ctx.textAlign = 'right'
  ctx.font = FONT(500, 22, true)
  ctx.fillStyle = inkSoft
  ctx.fillText(new Date().toLocaleDateString(), W - M, footY)
  ctx.textAlign = 'left'

  ctx.restore()
}
