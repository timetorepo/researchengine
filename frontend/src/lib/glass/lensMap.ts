/**
 * The displacement map behind Liquid Glass refraction.
 *
 * An SVG `feDisplacementMap` moves each pixel of what is behind a surface by an
 * amount read from a picture: red sets the horizontal move, green the vertical,
 * and 128 means "no move". This module draws that picture as a lens: flat in the
 * middle and bending hard within a rim of the edges, so what is behind the glass
 * curves at its border the way light does through a convex pane.
 *
 * It is computed once and cached as a PNG data URL. The filter is only rendered
 * after the map exists (App.tsx), so the first paint never shifts the page.
 */

/** Size of the map in pixels. It is stretched over each surface, so a small map is enough. */
export const LENS_SIZE = 192

/** Width of the bending rim as a share of the surface (0–0.5). */
const RIM = 0.24

/**
 * Red and green values for one pixel of the lens, as bytes. Pure: no DOM, so it
 * can be tested in Node.
 */
export function lensPixel(u: number, v: number, rim = RIM): [number, number] {
  // Distance to the nearest edge, on each axis, as a share of the surface.
  const dx = Math.min(u, 1 - u)
  const dy = Math.min(v, 1 - v)
  const bend = (d: number) => {
    if (d >= rim) return 0
    const t = 1 - d / rim // 0 at the rim's inner edge, 1 at the border
    return t * t * (3 - 2 * t) // smoothstep: no visible ridge where the bend starts
  }
  // Pull samples toward the centre near each edge, so the border looks convex.
  const nx = -(2 * u - 1) * bend(dx)
  const ny = -(2 * v - 1) * bend(dy)
  const to8 = (n: number) => Math.max(0, Math.min(255, Math.round(128 + 127 * n)))
  return [to8(nx), to8(ny)]
}

/** The full RGBA buffer for a `w × h` lens (alpha is always opaque). */
export function lensPixels(w = LENS_SIZE, h = LENS_SIZE): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = h > 1 ? y / (h - 1) : 0.5
    for (let x = 0; x < w; x++) {
      const u = w > 1 ? x / (w - 1) : 0.5
      const [r, g] = lensPixel(u, v)
      const i = (y * w + x) * 4
      out[i] = r
      out[i + 1] = g
      out[i + 2] = 128
      out[i + 3] = 255
    }
  }
  return out
}

let cached: string | null | undefined

/**
 * The lens as a PNG data URL, or null where no canvas is available (tests, or a
 * very old engine). Cached after the first call.
 */
export function lensMapDataUrl(): string | null {
  if (cached !== undefined) return cached
  try {
    if (typeof document === 'undefined') { cached = null; return cached }
    const canvas = document.createElement('canvas')
    canvas.width = LENS_SIZE
    canvas.height = LENS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) { cached = null; return cached }
    const pixels = lensPixels()
    ctx.putImageData(new ImageData(pixels as unknown as Uint8ClampedArray<ArrayBuffer>, LENS_SIZE, LENS_SIZE), 0, 0)
    cached = canvas.toDataURL('image/png')
  } catch {
    cached = null
  }
  return cached
}

/**
 * Whether this engine can bend the backdrop with `backdrop-filter: url(#…)`.
 * Chromium-based windows can (Chrome, Edge, the Windows desktop app). Safari,
 * Firefox and WebKitGTK (the Linux desktop app) cannot, and show the same glass
 * as a frosted blur instead.
 */
export function refractionSupported(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /\b(Chrome|Chromium|Edg|OPR)\//.test(ua)
}
