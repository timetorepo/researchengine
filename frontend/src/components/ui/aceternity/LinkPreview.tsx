/**
 * Link Preview — Aceternity UI, vendored (R17).
 *
 * Canonical install: `npx shadcn@latest add @aceternity/link-preview-demo`.
 * The registry is unreachable from the build machine, so this carries the
 * component as published in the `multi-ui-bundle` npm package (a copy of the
 * Aceternity set) with the parts that assume a hosted service replaced:
 *
 *   • Upstream asks Microlink for a screenshot on every hover, from the
 *     browser, with no regard for the site's rules. Here the hover calls
 *     `/api/link/preview` on the local server, which checks `robots.txt` first,
 *     reads the page's own Open Graph tags second, and only then falls back to
 *     a screenshot-service URL the browser loads. A site that disallows
 *     crawlers is never fetched, and the card says so instead of showing a
 *     screenshot.
 *   • `next/link` and Radix's HoverCard are gone: the card is positioned in
 *     viewport coordinates and rendered through a portal, so it cannot be
 *     clipped by an answer's own scroll box, and the link stays a plain `<a>`
 *     that this app's router already handles.
 *   • Three fallbacks, in order: the page's og:image, the screenshot service,
 *     then a tile built from the site's favicon and domain. A preview card is
 *     never blank.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Globe, ShieldOff, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LinkPreviewData {
  ok: boolean
  url: string
  domain: string
  robots: 'allowed' | 'disallowed' | 'unavailable'
  title?: string
  description?: string
  siteName?: string
  image?: string | null
  imageSource?: 'page' | 'screenshot-service' | null
  screenshot?: string | null
  favicon: string
  reason?: string
}

export function LinkPreview({
  url,
  children,
  className,
  width = 300,
  height = 170,
  isStatic = false,
  imageSrc = '',
  title: titleOverride,
  description: descriptionOverride,
}: {
  url: string
  children: React.ReactNode
  className?: string
  width?: number
  height?: number
  isStatic?: boolean
  imageSrc?: string
  title?: string
  description?: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<LinkPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<'page' | 'service' | 'favicon'>('page')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (data || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/link/preview?url=${encodeURIComponent(url)}`)
      const json = (await res.json()) as LinkPreviewData
      setData(json)
      setStage(json.image ? 'page' : json.screenshot ? 'service' : 'favicon')
    } catch {
      setData({ ok: false, url, domain: safeDomain(url), robots: 'unavailable', favicon: faviconFor(url), reason: 'The local server did not answer.' })
    } finally {
      setLoading(false)
    }
  }, [data, loading, url])

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(width + 24, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
    // Prefer above the link; flip below when there is no room.
    const above = r.top > height + 40
    const top = above ? r.top - height - 26 : r.bottom + 14
    setPos({ left, top: Math.max(12, Math.min(top, window.innerHeight - height - 20)) })
  }, [height, width])

  const enter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => {
      place()
      setOpen(true)
      void load()
    }, 220)
  }
  const leave = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 160)
  }

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (openTimer.current) clearTimeout(openTimer.current)
  }, [])

  const resolved: LinkPreviewData | null = isStatic
    ? { ok: true, url, domain: safeDomain(url), robots: 'allowed', image: imageSrc, imageSource: 'page', favicon: faviconFor(url), title: titleOverride, description: descriptionOverride }
    : data

  const img = stage === 'page' ? resolved?.image : stage === 'service' ? resolved?.screenshot : null

  return (
    <>
      <span
        ref={anchorRef}
        className={cn('relative inline', className)}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={enter}
        onBlur={leave}>
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.99 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={enter}
              onMouseLeave={leave}
              className="fixed z-[90] rounded-[14px] overflow-hidden pointer-events-auto"
              style={{ left: pos.left, top: pos.top, width, background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 18px 50px -18px rgba(0,0,0,0.55)' }}>
              {loading && !resolved ? (
                <div className="flex flex-col gap-2 p-3" style={{ height }}>
                  <div className="w-full animate-pulse rounded-[10px]" style={{ height: height - 62, background: 'var(--elevated)' }} />
                  <div className="h-2.5 w-2/3 rounded-full animate-pulse" style={{ background: 'var(--elevated)' }} />
                  <div className="h-2.5 w-1/3 rounded-full animate-pulse" style={{ background: 'var(--elevated)' }} />
                </div>
              ) : resolved && !resolved.ok ? (
                <div className="p-3.5" style={{ minHeight: 96 }}>
                  <div className="flex items-center gap-2 text-[12px] font-medium mb-1">
                    {resolved.robots === 'disallowed' ? <ShieldOff size={13} style={{ color: 'var(--warning, #FBBF24)' }} /> : <Globe size={13} style={{ color: 'var(--text-3)' }} />}
                    <span className="truncate">{resolved.domain}</span>
                  </div>
                  <p className="text-[11.5px] leading-snug" style={{ color: 'var(--text-2)' }}>
                    {resolved.robots === 'disallowed'
                      ? 'No preview: this site asks crawlers to stay out of that page (robots.txt), so nothing was fetched.'
                      : resolved.reason ?? 'No preview available for this link.'}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-3)' }}>The link itself still works.</p>
                </div>
              ) : resolved ? (
                <div>
                  <div className="relative w-full overflow-hidden" style={{ height: height - 4, background: 'var(--elevated)' }}>
                    {img ? (
                      <img
                        src={img}
                        alt={resolved.title ?? resolved.domain}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setStage(stage === 'page' ? 'service' : 'favicon')}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
                        {resolved.favicon
                          ? <img src={resolved.favicon} alt="" className="w-8 h-8 rounded-[8px]" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          : <ImageOff size={18} style={{ color: 'var(--text-3)' }} />}
                        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{resolved.domain}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[12px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>
                      {resolved.title || resolved.siteName || resolved.domain}
                    </div>
                    {resolved.description && (
                      <p className="text-[11px] mt-1 leading-snug line-clamp-2" style={{ color: 'var(--text-2)' }}>{resolved.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                      {resolved.favicon && <img src={resolved.favicon} alt="" className="w-3 h-3 rounded-[3px]" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      <span className="truncate">{resolved.domain}</span>
                      {resolved.imageSource === 'screenshot-service' && <span>· screenshot service</span>}
                      {resolved.imageSource === 'page' && <span>· from the page</span>}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function safeDomain(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function faviconFor(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64` } catch { return '' }
}
