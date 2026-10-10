/**
 * Share studio — the results card, yours.
 *
 * Opens with a live preview of the actual canvas the download will produce
 * (same draw call, scaled down), four finished looks, the accent pair the card
 * inherits from your theme, a picture for the Custom image style, and toggles
 * for what the card carries. Copy-to-clipboard uses the real PNG, so pasting
 * anywhere gives the card rather than a screenshot of the page.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Download, Copy, Check, ImagePlus, Palette, Type, Trash2, Loader2 } from 'lucide-react'
import { SHARE_STYLES, SHARE_W, SHARE_H, drawShareCard, type ShareOptions, type ShareStyleId, type ShareData } from '@/lib/quiz/shareCard'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

const TONES = ['#6C8EEF', '#22D3EE', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#FB7185', '#0EA5E9']

export function ShareStudio({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const theme = useStore((s) => s.settings.theme)
  const ui = useUI()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // The card starts in the app's own colours — a shared result should look like
  // it came from this app, not from a template.
  const [opts, setOpts] = useState<ShareOptions>(() => {
    const css = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null
    const from = css?.getPropertyValue('--primary')?.trim() || '#6C8EEF'
    const to = css?.getPropertyValue('--secondary')?.trim() || '#22D3EE'
    return {
      style: 'liquid',
      from: from.startsWith('#') ? from : '#6C8EEF',
      to: to.startsWith('#') ? to : '#22D3EE',
      showTitle: true,
      showSource: true,
      showStreak: true,
      showMaker: true,
      caption: '',
      imageDataUrl: null,
    }
  })

  const set = <K extends keyof ShareOptions>(k: K, v: ShareOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  // Redraw whenever anything changes: the preview IS the file.
  //
  // The draw used to happen only on the image branch — every other style set the
  // canvas size and then drew nothing, so the preview stayed blank and Copy put a
  // blank PNG on the clipboard. One paint path, used by every style, is the fix;
  // the `cancelled` flag stops a slow image decode from painting over a style you
  // have already switched away from.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    cv.width = SHARE_W
    cv.height = SHARE_H
    const ctx = cv.getContext('2d')
    if (!ctx) return

    let cancelled = false
    const paint = (image: HTMLImageElement | null) => {
      if (cancelled) return
      try {
        drawShareCard(ctx, data, opts, image)
      } catch (e) {
        // A picture that cannot be decoded must not take the whole studio with
        // it: fall back to the gradient look and say why.
        drawShareCard(ctx, data, { ...opts, style: 'liquid' }, null)
        ui.toast('That picture could not be drawn', 'The card fell back to the gradient look.', 'warning')
        console.warn('[share] draw failed', e)
      }
    }

    if (opts.style === 'image' && opts.imageDataUrl) {
      loadImage(opts.imageDataUrl).then(paint).catch(() => paint(null))
    } else {
      paint(null)
    }
    return () => { cancelled = true }
  }, [opts, data, ui])

  const pickFile = (f: File | undefined) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      setOpts((o) => ({ ...o, style: 'image', imageDataUrl: url }))
    }
    reader.readAsDataURL(f)
  }

  // `toBlob` is the cheap path; a canvas the browser refuses to encode (or a
  // zero-sized one) falls back to the data-URL form, and both are checked for
  // actually carrying pixels before anything is saved or copied.
  const toBlob = () => new Promise<Blob | null>((resolve) => {
    const cv = canvasRef.current
    if (!cv || !cv.width || !cv.height) { resolve(null); return }
    if (typeof cv.toBlob !== 'function') { resolve(dataUrlToBlob(cv.toDataURL('image/png'))); return }
    cv.toBlob((b) => resolve(b ?? dataUrlToBlob(cv.toDataURL('image/png'))), 'image/png')
  })

  const save = async () => {
    setSaving(true)
    try {
      const blob = await toBlob()
      if (!blob || blob.size === 0) throw new Error('the canvas came back empty')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `research-engine-${data.pct}pct.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      ui.toast('Card saved', `${SHARE_W}×${SHARE_H} PNG — ready to post.`, 'success')
    } catch {
      ui.toast('Could not save the card', 'Your browser refused the download. Try Copy instead.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    try {
      const blob = await toBlob()
      if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      ui.toast('Clipboard blocked', 'This browser will not let the app copy an image — use Save instead.', 'info')
    }
  }

  const previewScale = 300 / SHARE_W

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" role="dialog" aria-label="Share your result">
      <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, #000 55%, transparent)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="relative w-full max-w-[860px] max-h-[92vh] overflow-hidden rounded-[18px] flex flex-col surface-elevated"
        style={{ boxShadow: '0 40px 90px -30px rgba(0,0,0,0.7)' }}
      >
        <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <Palette size={15} style={{ color: 'var(--primary)' }} />
          <span className="text-[13.5px] font-semibold flex-1">Share your result</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--elevated)]" aria-label="Close"><X size={15} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid md:grid-cols-[300px_1fr] gap-5 p-4">
            {/* live preview */}
            <div className="flex flex-col items-start gap-2">
              <div className="re-share-frame" style={{ width: 300, height: 300 / (SHARE_W / SHARE_H) }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
              <div className="text-[10.5px] tabular-nums px-1" style={{ color: 'var(--text-3)' }}>
                {SHARE_W} × {SHARE_H} · the preview is the file
              </div>
              <div className="flex gap-1.5 w-full">
                <button onClick={() => void save()} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] text-[12.5px] font-medium"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Save PNG
                </button>
                <button onClick={() => void copy()} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] text-[12.5px]"
                  style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                  {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* controls */}
            <div className="min-w-0 space-y-5">
              <section>
                <div className="re-share-label"><Palette size={11} /> Look</div>
                <div className="grid grid-cols-2 gap-2">
                  {SHARE_STYLES.map((s) => (
                    <button key={s.id} onClick={() => { set('style', s.id as ShareStyleId); if (s.id === 'image' && !opts.imageDataUrl) fileRef.current?.click() }}
                      className="re-share-style" data-active={opts.style === s.id}>
                      <span className="re-share-swatch" data-style={s.id} style={{ background: `linear-gradient(135deg, ${opts.from}, ${opts.to})` }} />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium truncate">{s.label}</span>
                        <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{s.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {opts.style === 'image' && (
                <section>
                  <div className="re-share-label"><ImagePlus size={11} /> Your picture</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px]"
                      style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                      <ImagePlus size={13} /> {opts.imageDataUrl ? 'Replace image' : 'Choose image'}
                    </button>
                    {opts.imageDataUrl && (
                      <button onClick={() => setOpts((o) => ({ ...o, imageDataUrl: null, style: 'liquid' }))}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-[10px] text-[12px]" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                </section>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />

              <section>
                <div className="re-share-label"><Type size={11} /> Accent</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TONES.map((c) => (
                    <button key={c} onClick={() => set('from', c)} aria-label={`Accent ${c}`}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, outline: opts.from === c ? '2px solid var(--text)' : 'none', outlineOffset: 2 }} />
                  ))}
                  <span className="text-[11px] mx-1" style={{ color: 'var(--text-3)' }}>pair</span>
                  {TONES.map((c) => (
                    <button key={`b${c}`} onClick={() => set('to', c)} aria-label={`Second accent ${c}`}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, outline: opts.to === c ? '2px solid var(--text)' : 'none', outlineOffset: 2 }} />
                  ))}
                  <button onClick={() => {
                    // Back to whatever the active theme uses.
                    const css = getComputedStyle(document.documentElement)
                    set('from', css.getPropertyValue('--primary').trim() || '#6C8EEF')
                    set('to', css.getPropertyValue('--secondary').trim() || '#22D3EE')
                  }} className="text-[11px] ml-1 px-2 py-1 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
                    Theme ({theme})
                  </button>
                </div>
              </section>

              <section>
                <div className="re-share-label"><Type size={11} /> On the card</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    ['showTitle', 'Quiz name'],
                    ['showSource', 'Source file'],
                    ['showStreak', 'Best streak'],
                    ['showMaker', 'Maker mark'],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] cursor-pointer" style={{ background: 'var(--elevated)' }}>
                      <input type="checkbox" checked={opts[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
                      <span className="text-[12px]">{label}</span>
                    </label>
                  ))}
                </div>
                <input value={opts.caption} onChange={(e) => set('caption', e.target.value)} maxLength={90}
                  placeholder="A line of your own (optional)"
                  className="mt-2 w-full px-3 py-2 rounded-[10px] text-[12.5px] bg-transparent outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
              </section>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/** A PNG data-URL as a Blob — the fallback when `canvas.toBlob` is unavailable. */
function dataUrlToBlob(url: string): Blob | null {
  const comma = url.indexOf(',')
  if (!/^data:/.test(url) || comma < 0) return null
  const binary = atob(url.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}

/** Decode a data-URL once per URL; canvas drawing needs an element, not a URL. */
const imageCache = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src)
  if (hit) return hit
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = src
  })
  imageCache.set(src, p)
  return p
}
