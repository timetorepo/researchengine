/**
 * The source viewer.
 *
 * Every search result in the Library opens here instead of throwing the user at
 * a new browser tab. Two ways to read the same thing:
 *
 *   Read    — the source, reduced to text on the server. Wikipedia comes from
 *             its own API (clean sections, real article text, no scraped HTML);
 *             everything else goes through the HTML reducer. This is the path
 *             that works when a site is hostile to being embedded.
 *   Browser — the real page, in a sandboxed frame, for everything the text
 *             cannot carry: layout, an interactive map, a video, a login you
 *             have on that site already.
 *
 * The panel is a squircle: real CSS corner shaping where the engine supports it
 * (`corner-shape`), plain large radii everywhere else. The tabs, the outline
 * rail and the frame each move differently on purpose — a sliding pill for the
 * tab, a rail that fades in from the side, a frame that fades up behind the
 * first paint — so no two interactions repeat the same motion.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { scrollChildIntoView } from '@/lib/dom/scroll'
import {
  X, Globe, BookOpen, ExternalLink, RefreshCw, AlertTriangle, List, Link2,
  Check, Loader2, Star, Type, PanelTop, CornerDownRight,
} from 'lucide-react'

export interface OpenSource {
  url: string
  title?: string
  favicon?: string
  kind?: 'wikipedia' | 'source' | 'document' | 'screens' | 'ui' | 'docs' | 'web'
}

interface Block {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code'
  level?: number
  text?: string
  items?: string[]
  id?: string
}

interface ReadResult {
  ok: boolean
  url: string
  via: 'wikipedia' | 'html' | 'text'
  title: string
  siteName?: string
  description?: string
  wordCount: number
  minutes: number
  blocks: Block[]
  outline: { id: string; text: string; level: number }[]
  images: { src: string; alt?: string }[]
  warning?: string
  fetchedAt: number
}

type Tab = 'read' | 'browser'

const host = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : '' } catch { return '' } }

export function SourceViewer({ source, onClose, onSave, onKeep, inline = false }: {
  source: OpenSource | null
  onClose: () => void
  onSave?: (s: OpenSource) => void
  /** Keep this page as a reference — Design mode's version of Save. */
  onKeep?: (s: OpenSource) => void
  /**
   * Inline drops the modal: same header, same two ways to read the page, but it
   * stands in a pane of the caller's layout instead of covering the window. The
   * Library wants the modal — it is a reading break. Design mode wants it in the
   * studio, next to the screen it is comparing against.
   */
  inline?: boolean
}) {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<Tab>('read')
  const [doc, setDoc] = useState<ReadResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [frameState, setFrameState] = useState<'idle' | 'loaded' | 'slow'>('idle')
  const [activeId, setActiveId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const open = !!source
  const key = source?.url ?? ''

  /* ------------------------------------------------------------- loading --- */

  const load = useCallback(async (url: string) => {
    setBusy(true); setFailure(null); setDoc(null)
    try {
      const res = await fetch(`/api/library/read?url=${encodeURIComponent(url)}`)
      const json: ReadResult = await res.json().catch(() => null as any)
      if (!json) throw new Error(`The reader answered HTTP ${res.status} without JSON.`)
      setDoc(json)
      // A wiki always has something worth reading; an HTML page that came back
      // empty because the site renders itself in JavaScript opens on Browser.
      if (!json.ok || json.blocks.length === 0) {
        setFailure(json.warning ?? (json.via === 'wikipedia'
          ? 'Wikipedia returned no sections for this page.'
          : 'This page is rendered by the site’s own JavaScript, so there is no text to reduce. Open it in the browser tab.'))
        if (json.via !== 'wikipedia') setTab('browser')
      }
    } catch (e: any) {
      setFailure(`The reader could not be reached: ${String(e?.message ?? e)}`)
      setTab('browser')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !source) return
    setTab('read'); setFrameState('idle'); setActiveId(null)
    void load(source.url)
  }, [key, open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => { if (frameState === 'idle' && tab === 'browser') setFrameState('slow') }, 7000)
    return () => clearTimeout(t)
  }, [open, tab, frameState, key])

  /* ------------------------------------------------------------- outline --- */

  const jump = (id: string) => {
    setActiveId(id)
    const target = scrollerRef.current?.querySelector(`[data-block="${id}"]`) as HTMLElement | null
    // Never the browser's own scrollIntoView: it scrolls every scrollable
    // ancestor, including the ones the app keeps still (lib/dom/scroll.ts).
    scrollChildIntoView(scrollerRef.current, target, { block: 'start', smooth: !reduce })
  }

  // Which heading the reader is currently inside, updated on scroll. This is the
  // outline rail's whole job; a plain list of links would be decoration.
  useEffect(() => {
    if (tab !== 'read' || !doc?.outline.length) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top
      let current = doc.outline[0].id
      for (const h of doc.outline) {
        const el = scroller.querySelector(`[data-block="${h.id}"]`) as HTMLElement | null
        if (el && el.getBoundingClientRect().top - top < 90) current = h.id
      }
      setActiveId(current)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [tab, doc])

  const body = useMemo(() => {
    if (!doc) return null
    return (doc.blocks ?? []).map((b, i) => {
      if (b.type === 'heading') {
        const size = b.level === 1 ? 'text-[19px]' : b.level === 2 ? 'text-[16px]' : 'text-[14px]'
        return (
          <h3 key={i} data-block={b.id} className={`${size} font-semibold mt-6 mb-2 scroll-mt-6`} style={{ color: 'var(--text)' }}>
            {b.text}
          </h3>
        )
      }
      if (b.type === 'list') {
        return (
          <ul key={i} className="my-2.5 flex flex-col gap-1.5">
            {(b.items ?? []).map((it, j) => (
              <li key={j} className="flex items-start gap-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                <CornerDownRight size={12} className="mt-1 shrink-0" style={{ color: 'var(--text-3)' }} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )
      }
      if (b.type === 'quote') {
        return (
          <blockquote key={i} className="my-3 pl-3.5 text-[13.5px] leading-relaxed italic"
            style={{ color: 'var(--text-2)', borderLeft: '2px solid color-mix(in srgb, var(--primary) 55%, transparent)' }}>
            {b.text}
          </blockquote>
        )
      }
      if (b.type === 'code') {
        return (
          <pre key={i} className="my-3 p-3 rounded-[12px] overflow-x-auto text-[12px] leading-relaxed"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>
            <code>{b.text}</code>
          </pre>
        )
      }
      return (
        <p key={i} className="my-2.5 text-[13.5px] leading-[1.75]" style={{ color: 'var(--text-2)' }}>
          {b.text}
        </p>
      )
    })
  }, [doc])

  /* ---------------------------------------------------------------- view --- */

  const squircle = {
    borderRadius: 30,
    // Real superellipse corners where the engine has corner-shape; a large
    // radius with a soft inner ring everywhere else.
    cornerShape: 'superellipse(1.7)',
    background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
    border: '1px solid var(--surface-border)',
    boxShadow: '0 1px 0 color-mix(in srgb, white 8%, transparent) inset, 0 30px 80px -20px rgba(0,0,0,.55)',
    backdropFilter: 'blur(26px) saturate(140%)',
  } as React.CSSProperties

  // Standing in a pane of the studio rather than over the window: the same
  // surface the panels around it use, with none of the modal shadow.
  const inlineShell = {
    borderRadius: 13,
    background: 'var(--ide-panel, var(--surface))',
    border: '1px solid var(--ide-border, var(--surface-border))',
  } as React.CSSProperties

  const h = host(source?.url)
  const favicon = source?.favicon ?? (h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : undefined)

  return (
    <AnimatePresence>
      {open && source && (
        <motion.div
          className={inline ? 'flex flex-col h-full min-h-0' : 'fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={inline ? undefined : { background: 'rgba(6,8,12,.55)' }}
          onMouseDown={inline ? undefined : (e) => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div
            ref={panelRef}
            data-ui="source-viewer"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.965, borderRadius: 48, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, borderRadius: 30, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.975, borderRadius: 44, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
            className={inline
              ? 'relative w-full h-full flex flex-col overflow-hidden'
              : 'relative w-full max-w-[1080px] h-[86vh] flex flex-col overflow-hidden'}
            style={inline ? inlineShell : squircle}>

            {/* header — the site, the two ways to read it, and the actions */}
            <div className="flex items-center gap-2.5 px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--surface-border)' }}>
              {favicon
                ? <img src={favicon} alt="" width={20} height={20} className="rounded-[6px]"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                : <Globe size={16} style={{ color: 'var(--text-3)' }} />}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                  {doc?.title || source.title || h || source.url}
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>
                  <span className="truncate">{source.url}</span>
                  {doc?.ok && doc.blocks.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{doc.wordCount.toLocaleString()} words · {doc.minutes} min</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        {doc.via === 'wikipedia' ? <BookOpen size={9} /> : <Type size={9} />}
                        {doc.via === 'wikipedia' ? 'Wikipedia article text' : 'reduced from the page'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* tab pill: the highlight slides, the labels do not move */}
              <div className="relative flex items-center p-0.5 rounded-full shrink-0"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                {([['read', 'Read', BookOpen], ['browser', 'Browser', PanelTop]] as const).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setTab(id)}
                    className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px]"
                    style={{ color: tab === id ? 'var(--text)' : 'var(--text-3)' }}>
                    {tab === id && (
                      <motion.span layoutId="viewer-tab" className="absolute inset-0 rounded-full -z-10"
                        style={{ background: 'color-mix(in srgb, var(--primary) 22%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                    )}
                    <Icon size={11.5} /> {label}
                  </button>
                ))}
              </div>

              {onKeep && (
                <button onClick={() => onKeep({ ...source, title: doc?.title || source.title || h || source.url })}
                  title="Keep this page as a design reference"
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px]"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                  <Star size={11} /> Keep
                </button>
              )}
              {onSave && (
                <button onClick={() => onSave(source)} title="Save this source to the library"
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px]"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                  <Star size={11} /> Save
                </button>
              )}
              <a href={source.url} target="_blank" rel="noreferrer noopener" title="Open in your own browser"
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px]"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                <ExternalLink size={11} /> New tab
              </a>
              <button onClick={onClose} title="Close"
                className="shrink-0 p-1.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                <X size={13} />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 min-h-0 flex">
              {tab === 'read' ? (
                <>
                  {/* outline rail — only when the document actually has structure */}
                  {doc && doc.outline.length > 2 && (
                    <motion.aside
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.28, delay: 0.06 }}
                      className="hidden lg:flex flex-col gap-0.5 w-[210px] shrink-0 px-3 py-4 overflow-y-auto"
                      style={{ borderRight: '1px solid var(--surface-border)' }}>
                      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>
                        <List size={10} /> Sections
                      </div>
                      {(doc.outline ?? []).map((s) => (
                        <button key={s.id} onClick={() => jump(s.id)}
                          className="text-left text-[11.5px] leading-snug px-2 py-1 rounded-[8px] transition-colors"
                          style={{
                            color: activeId === s.id ? 'var(--text)' : 'var(--text-3)',
                            background: activeId === s.id ? 'var(--elevated)' : 'transparent',
                            paddingLeft: 8 + (s.level - 1) * 9,
                          }}>
                          {s.text}
                        </button>
                      ))}
                    </motion.aside>
                  )}

                  <div ref={scrollerRef} className="flex-1 min-w-0 overflow-y-auto px-5 sm:px-7 py-5">
                    {busy && (
                      <div className="flex flex-col gap-2.5 max-w-[640px]">
                        {[92, 100, 96, 74, 88, 60].map((w, i) => (
                          <motion.div key={i} className="h-3 rounded-full" style={{ background: 'var(--elevated)', width: `${w}%` }}
                            animate={reduce ? {} : { opacity: [0.45, 0.9, 0.45] }}
                            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.09 }} />
                        ))}
                      </div>
                    )}

                    {!busy && failure && (
                      <div className="max-w-[560px] surface p-4" style={{ borderColor: 'color-mix(in srgb, var(--warning) 40%, var(--surface-border))' }}>
                        <div className="flex items-center gap-2 text-[12.5px] font-medium mb-1.5" style={{ color: 'var(--warning)' }}>
                          <AlertTriangle size={13} /> Nothing to parse here
                        </div>
                        <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{failure}</p>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setTab('browser')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
                            style={{ background: 'var(--primary)', color: '#fff' }}>
                            <PanelTop size={11} /> Open the page
                          </button>
                          <button onClick={() => void load(source.url)} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
                            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                            <RefreshCw size={11} /> Try again
                          </button>
                          <a href={source.url} target="_blank" rel="noreferrer noopener"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
                            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                            <ExternalLink size={11} /> New tab
                          </a>
                        </div>
                      </div>
                    )}

                    {!busy && !failure && doc && (
                      <motion.div initial={reduce ? {} : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }} className="max-w-[680px]">
                        {doc.description && (
                          <p className="text-[12px] leading-relaxed mb-3 pb-3" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--surface-border)' }}>
                            {doc.description}
                          </p>
                        )}
                        {body}
                        {doc.images.length > 0 && (
                          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {doc.images.slice(0, 6).map((im, i) => (
                              <img key={i} src={im.src} alt={im.alt ?? ''} loading="lazy"
                                className="w-full h-[110px] object-cover rounded-[14px]"
                                style={{ border: '1px solid var(--surface-border)' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ))}
                          </div>
                        )}
                        {doc.warning && (
                          <p className="mt-5 flex items-start gap-1.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {doc.warning}
                          </p>
                        )}
                        <p className="mt-6 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
                          <Link2 size={10} /> Read the original at
                          <a href={source.url} target="_blank" rel="noreferrer noopener" className="hover:underline" style={{ color: 'var(--primary)' }}>{h}</a>
                        </p>
                      </motion.div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-2 text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>
                    {frameState === 'slow'
                      ? <><AlertTriangle size={11} style={{ color: 'var(--warning)' }} /> The page is taking its time — it may refuse to load inside another app. The Read tab always works.</>
                      : <><Globe size={11} /> Loading the real page. Sites that block being embedded are normal; Read is the fallback.</>}
                    <div className="flex-1" />
                    <button onClick={() => setFrameState('idle')} title="Reload the frame"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ color: 'var(--text-2)' }}>
                      <RefreshCw size={10} /> Reload
                    </button>
                  </div>
                  <div className="relative flex-1 min-h-0 mx-3 mb-3 rounded-[18px] overflow-hidden"
                    style={{ border: '1px solid var(--surface-border)', background: '#fff' }}>
                    {frameState !== 'loaded' && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12px]"
                        style={{ color: 'var(--text-3)', background: 'var(--surface)' }}>
                        <Loader2 size={13} className="animate-spin" /> {h}
                      </div>
                    )}
                    <iframe
                      key={key + frameState}
                      title={doc?.title || source.title || source.url}
                      src={source.url}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      onLoad={() => setFrameState('loaded')}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* footer: what the reader actually did, said plainly */}
            <div className="flex items-center gap-2 px-4 py-2 text-[10.5px] shrink-0"
              style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
              {busy
                ? <><Loader2 size={10} className="animate-spin" /> Reading the source…</>
                : doc?.ok && doc.blocks.length > 0
                  ? <><Check size={10} style={{ color: 'var(--secondary)' }} /> Parsed {doc.blocks.length} blocks · {doc.outline.length} sections · {doc.images.length} images{doc.via === 'wikipedia' ? ' · via the Wikipedia API' : ''}</>
                  : <><AlertTriangle size={10} /> No text could be reduced from this page · the Browser tab is the way in</>}
              <div className="flex-1" />
              <span>Esc closes</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SourceViewer
