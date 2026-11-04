/**
 * Hover image link — a link that shows the page it points to.
 *
 * The interaction follows Aceternity UI's "Hover Image Links" micro-interaction:
 * a tile about 320×200 follows the cursor on a spring (stiffness 160, damping
 * 22), tilts a little with horizontal speed (up to 10°), and scales its image in
 * when it appears. The implementation here is this app's own; the upstream
 * source is a Pro download and was not copied.
 *
 * The image is the page's own `og:image`, fetched through `/api/link/preview`,
 * which checks robots.txt first. If a site asks crawlers to stay out, or has no
 * image, the tile shows the favicon and domain instead, so it is never empty.
 *
 * Accessibility: the link stays a plain `<a>`, the tile is `aria-hidden` (its
 * title is already the link text), keyboard focus opens it too, and reduced
 * motion turns the spring and tilt off.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import { Globe, ImageOff, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LinkPreviewData } from '@/components/ui/aceternity/LinkPreview'

export interface HoverImageLinkProps {
  url: string
  children: React.ReactNode
  className?: string
  /** Tile size in pixels. */
  width?: number
  height?: number
  /** Spring stiffness and damping for the cursor follow. */
  stiffness?: number
  damping?: number
  /** Largest tilt, in degrees, reached at a fast horizontal move. */
  tilt?: number
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const CACHE_MAX = 200
const cache = new Map<string, Promise<LinkPreviewData>>()

function cachedPreview(url: string): Promise<LinkPreviewData> {
  const hit = cache.get(url)
  if (hit) return hit
  const p = fetch(`/api/link/preview?url=${encodeURIComponent(url)}`)
    .then((r) => r.json() as Promise<LinkPreviewData>)
    .catch(() => {
      cache.delete(url)
      return { ok: false, url, domain: domainOf(url), robots: 'unavailable' as const, favicon: '' }
    })
  cache.set(url, p)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return p
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function HoverImageLink({
  url,
  children,
  className,
  width = 320,
  height = 200,
  stiffness = 160,
  damping = 22,
  tilt = 10,
}: HoverImageLinkProps) {
  const reduce = useReducedMotion()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<LinkPreviewData | null>(null)
  const [imgFailed, setImgFailed] = useState(false)

  // Cursor position drives the tile through springs, so it trails the pointer.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: reduce ? 1000 : stiffness, damping: reduce ? 60 : damping, mass: 0.6 })
  const sy = useSpring(my, { stiffness: reduce ? 1000 : stiffness, damping: reduce ? 60 : damping, mass: 0.6 })

  // Horizontal speed of the cursor, mapped to a tilt that settles back to 0.
  const vx = useMotionValue(0)
  const lastX = useRef<number | null>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotateRaw = useTransform(vx, (v) => (reduce ? 0 : clamp(v * 0.35, -tilt, tilt)))
  const rotate = useSpring(rotateRaw, { stiffness: 120, damping: 14 })

  const place = useCallback((cx: number, cy: number) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = cx + 18
    let y = cy + 18
    if (x + width > vw - 12) x = cx - width - 18
    if (y + height > vh - 12) y = cy - height - 18
    mx.set(clamp(x, 8, vw - width - 8))
    my.set(clamp(y, 8, vh - height - 8))
  }, [height, width, mx, my])

  const onMove = (e: React.MouseEvent) => {
    place(e.clientX, e.clientY)
    if (lastX.current !== null) vx.set(e.clientX - lastX.current)
    lastX.current = e.clientX
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => vx.set(0), 90)
  }

  const show = useCallback(() => {
    setOpen(true)
    if (!data) void cachedPreview(url).then(setData)
  }, [data, url])

  const hide = useCallback(() => {
    setOpen(false)
    lastX.current = null
    if (settle.current) clearTimeout(settle.current)
  }, [])

  // Keyboard focus has no cursor, so the tile sits beside the link instead.
  const onFocus = () => {
    const el = anchorRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      place(r.left, r.bottom)
    }
    show()
  }

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current)
  }, [])

  useEffect(() => {
    setImgFailed(false)
  }, [data?.image])

  const domain = data?.domain ?? domainOf(url)
  const title = data?.title || domain
  const showImage = !!data?.image && !imgFailed
  const blocked = data?.robots === 'disallowed'

  return (
    <>
      <span
        ref={anchorRef}
        className={cn('relative inline', className)}
        onMouseEnter={(e) => { place(e.clientX, e.clientY); show() }}
        onMouseLeave={hide}
        onMouseMove={onMove}
        onFocus={onFocus}
        onBlur={hide}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="hover-image-link"
              aria-hidden="true"
              className="pointer-events-none fixed left-0 top-0 z-[90] flex flex-col overflow-hidden rounded-[14px] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)]"
              style={{
                x: sx,
                y: sy,
                rotate,
                width,
                height,
                transformOrigin: 'top left',
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
              }}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: 'var(--elevated)' }}>
                {showImage ? (
                  <motion.img
                    key={data?.image}
                    src={data?.image ?? undefined}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                    initial={{ scale: reduce ? 1 : 1.08 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT }}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
                    style={{ color: 'var(--text-3)' }}>
                    {blocked ? <ShieldOff size={22} /> : data ? <ImageOff size={20} /> : <Globe size={20} />}
                    <span className="text-[11.5px] leading-snug">
                      {blocked
                        ? 'This site asks crawlers to stay out, so there is no image.'
                        : data ? 'No image on this page.' : 'Loading…'}
                    </span>
                    {data?.favicon && (
                      <img src={data.favicon} alt="" className="h-6 w-6 rounded-[6px]" referrerPolicy="no-referrer" />
                    )}
                  </div>
                )}
              </div>
              <div className="flex h-[38px] shrink-0 items-center gap-2 px-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
                {data?.favicon && (
                  <img src={data.favicon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-[3px]" referrerPolicy="no-referrer" />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: 'var(--text)' }}>{title}</span>
                {title !== domain && (
                  <span className="shrink-0 text-[10.5px]" style={{ color: 'var(--text-3)' }}>{domain}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export default HoverImageLink
