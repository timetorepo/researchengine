import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { scrollChildIntoView } from '@/lib/dom/scroll'
import { ArrowLeft, Send, Sparkles, Image as ImageIcon, X, GraduationCap, MessageSquareText, Minimize2, Maximize2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { generateText } from '@/lib/chat/generate'
import { getMaster } from '@/lib/prompts/masters'
import { webSearch } from '@/lib/search/web'
import type { DemoHighlight } from '@/lib/documents/demoDoc'
import { normalizeStepText, toStudyBlocks, type StudyBlock } from '@/lib/reader/format'
import { Markdown } from '@/components/chat/Markdown'

export interface ReaderDoc {
  id: string
  name: string
  text: string
  rewrite?: string          // cached study rewrite (demo ships one)
  highlights?: DemoHighlight[] // pre-computed (demo)
  isDemo?: boolean
}

type Tier = 'definition' | 'fact' | 'concept' | 'user'

interface Highlight { match: string; tier: Tier; reason: string }
interface InlineImage { after: number; url: string; caption: string; credit: string }
interface PanelMsg { role: 'user' | 'ai'; text: string; sourceIdx?: number }

const TIER_STYLE: Record<Tier, { bg: string; border: string; label: string }> = {
  definition: { bg: 'color-mix(in srgb, #60A5FA 16%, transparent)', border: '#60A5FA', label: 'Definition' },
  fact: { bg: 'color-mix(in srgb, var(--warning) 20%, transparent)', border: 'var(--warning)', label: 'Key fact' },
  concept: { bg: 'color-mix(in srgb, var(--warning) 32%, transparent)', border: 'var(--warning)', label: 'Critical concept' },
  user: { bg: 'color-mix(in srgb, var(--primary) 18%, transparent)', border: 'var(--primary)', label: 'Your highlight' },
}

const COACH = [
  'Try asking the chatbox to highlight parts about hydrogen bonds.',
  'Toggle between the rewritten and original text here.',
  'Generate a quiz from this document when you are ready.',
]

export function ReaderView({ doc, onBack, onQuizSection, initialNeedle }: {
  doc: ReaderDoc
  onBack: () => void
  onQuizSection: (text: string) => void
  initialNeedle?: string
}) {
  const settings = useStore((s) => s.settings)
  const reduceMotion = !!settings.reduceMotion
  const ui = useUI()
  const originalParas = useMemo(() => doc.text.split(/\n{2,}/).filter((p) => p.trim()), [doc.text])
  const rewriteParas = useMemo(() => (doc.rewrite ? doc.rewrite.split(/\n{2,}/).filter((p) => p.trim()) : null), [doc.rewrite])

  const [version, setVersion] = useState<'rewritten' | 'original'>(doc.rewrite ? 'rewritten' : 'original')
  const [highlights, setHighlights] = useState<Highlight[]>([
    ...(doc.highlights ?? []),
  ])
  const [topicMarks, setTopicMarks] = useState<Highlight[]>([])
  const [dimmed, setDimmed] = useState(false)
  const [filterTopic, setFilterTopic] = useState<string | null>(null)
  const [images, setImages] = useState<InlineImage[]>([])
  const [progress, setProgress] = useState(0)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; label: string } | null>(null)
  // The chip that follows an automatic highlight (undo / explain / quiz).
  const [selBtn, setSelBtn] = useState<{ x: number; y: number; text: string } | null>(null)
  // Paragraphs currently flashing after a jump, and the mark that was just
  // painted — both drive one-shot animations.
  const [flashIdx, setFlashIdx] = useState<number | null>(null)
  const [justMarked, setJustMarked] = useState<string | null>(null)
  const [coachStep, setCoachStep] = useState(() => (doc.isDemo && !localStorage.getItem('re.reader.coach') ? 0 : -1))
  const scrollRef = useRef<HTMLDivElement>(null)
  const paraRefs = useRef<(HTMLDivElement | null)[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  const paras = version === 'rewritten' && rewriteParas ? rewriteParas : originalParas
  const allMarks = useMemo(() => [...highlights, ...topicMarks], [highlights, topicMarks])

  // ---- jump to a source needle (e.g. "see this in the source" from a quiz) ----
  useEffect(() => {
    if (!initialNeedle) return
    const idx = originalParas.findIndex((p) => p.includes(initialNeedle))
    if (idx >= 0) {
      setHighlights((h) => [...h, { match: initialNeedle, tier: 'fact', reason: 'The passage your quiz answer came from.' }])
      // Centre the paragraph inside the reader's own scroller — never the page.
      setTimeout(() => scrollChildIntoView(scrollRef.current, paraRefs.current[idx], { block: 'center', smooth: true }), 250)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNeedle])

  // ---- progress rail ----
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0)
  }
  useEffect(() => { onScroll() }, [paras])

  // Read mode is an activity too — the focus timer should say "Reading" here.
  useEffect(() => {
    useUI.getState().setActivity({ kind: 'reading', label: 'Reading' })
    return () => { if (useUI.getState().activity.kind === 'reading') useUI.getState().setActivity({ kind: 'idle' }) }
  }, [])

  // ---- highlighting: selection paints the mark itself ----
  // Selecting text used to leave a button to press. Now the mark is drawn the
  // moment the selection is released (and "ink" is animated on), with a small
  // chip for the things you might want next: undo, explain, make a quiz.
  const paintSelection = useCallback((text: string, x: number, y: number) => {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 240)
    if (clean.length < 3) return false
    const already = [...highlights, ...topicMarks].some((h) => h.match === clean)
    if (!already) {
      setHighlights((h) => [...h, { match: clean, tier: 'user', reason: 'Your highlight.' }])
      setJustMarked(clean)
      window.setTimeout(() => setJustMarked((m) => (m === clean ? null : m)), 700)
      ui.toast('Highlighted', clean.length > 60 ? `${clean.slice(0, 60)}…` : clean, 'success')
    }
    setSelBtn({ x, y, text: clean })
    return !already
  }, [highlights, topicMarks, ui])

  /** Where to float the chip: the selection's box, with sane fallbacks. */
  const anchorFor = useCallback((sel: Selection | null): { x: number; y: number } | null => {
    const host = scrollRef.current?.getBoundingClientRect()
    if (!host) return null
    let rect: { left: number; top: number; width: number } | null = null
    try {
      // Not every engine implements getBoundingClientRect on a Range (jsdom,
      // some embedded webviews), and it can throw mid-layout — never fatal.
      const r = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect?.() : null
      if (r && (r.width || r.height)) rect = r
    } catch { rect = null }
    if (!rect) {
      const node = sel?.anchorNode
      const el = (node?.nodeType === 1 ? node as Element : node?.parentElement) ?? null
      try {
        const r = el?.getBoundingClientRect?.()
        if (r && (r.width || r.height)) rect = r
      } catch { rect = null }
    }
    if (!rect) return { x: Math.round(host.width / 2), y: 48 }
    return { x: rect.left + rect.width / 2 - host.left, y: Math.max(8, rect.top - host.top - 38) }
  }, [])

  /** The selection, when it is inside the reading column and worth marking. */
  const readingSelection = useCallback((): string | null => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    if (text.trim().length < 3 || !sel?.anchorNode || !contentRef.current?.contains(sel.anchorNode)) return null
    return text
  }, [])

  useEffect(() => {
    const onUp = () => {
      const text = readingSelection()
      if (!text) { setSelBtn(null); return }
      const at = anchorFor(window.getSelection())
      if (!at) return
      paintSelection(text, at.x, at.y)
      // Drop the browser selection so the mark is what you see, not the
      // system-blue overlay on top of it.
      try { window.getSelection()?.removeAllRanges() } catch { /* nothing to clear */ }
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [paintSelection, readingSelection, anchorFor])

  // Keyboard selection (shift+arrows, ctrl+A) gets the same treatment.
  useEffect(() => {
    let timer: number | undefined
    const onSelChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const text = readingSelection()
        if (!text) return
        const at = anchorFor(window.getSelection())
        if (!at) return
        paintSelection(text, at.x, at.y)
        try { window.getSelection()?.removeAllRanges() } catch { /* nothing to clear */ }
      }, 420)
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => { document.removeEventListener('selectionchange', onSelChange); window.clearTimeout(timer) }
  }, [paintSelection, readingSelection, anchorFor])

  // The chip fades on its own; it is a shortcut, not a modal.
  useEffect(() => {
    if (!selBtn) return
    const t = window.setTimeout(() => setSelBtn(null), 6000)
    return () => window.clearTimeout(t)
  }, [selBtn])

  // ---- chatbox command handlers
  const visibleText = useMemo(
    () => paras.filter((p) => !filterTopic || p.toLowerCase().includes(filterTopic.toLowerCase())).join('\n\n'),
    [paras, filterTopic],
  )

  const highlightTopic = (topic: string) => {
    const terms = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    const found: Highlight[] = []
    for (const p of paras) {
      const lower = p.toLowerCase()
      if (!terms.some((t) => lower.includes(t))) continue
      const sents = p.split(/(?<=[.!?])\s+/)
      for (const s of sents) {
        if (terms.some((t) => s.toLowerCase().includes(t)) && s.length > 30) {
          found.push({ match: s.trim(), tier: 'fact', reason: `Matches your topic "${topic}".` })
        }
      }
    }
    setTopicMarks(found.slice(0, 20))
    setDimmed(true)
    ui.toast('Highlights updated', `${found.length} passage${found.length === 1 ? '' : 's'} about “${topic}” flagged. Existing highlights dimmed.`, 'info')
  }

  const addImageFor = async (topic: string) => {
    if (!settings.readerImages) { ui.toast('Image fetching is off', 'Enable it in Settings → Search or Appearance.', 'warning'); return null }
    try {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
        `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + topic)}&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`
      const res = await fetch(url)
      const json = await res.json()
      const page = Object.values(json?.query?.pages ?? {})[0] as any
      const info = page?.imageinfo?.[0]
      if (!info?.thumburl) throw new Error('no image')
      const title = String(page.title ?? topic).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
      const license = info.extmetadata?.LicenseShortName?.value ?? 'see source'
      const afterIdx = paras.findIndex((p) => p.toLowerCase().includes(topic.toLowerCase().split(/\s+/)[0]))
      setImages((im) => [...im, { after: afterIdx >= 0 ? afterIdx : Math.min(2, paras.length - 1), url: info.thumburl, caption: title, credit: `${info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '') ?? 'Wikimedia Commons'} · ${license}` }])
      return true
    } catch {
      ui.toast('No image found', 'Wikimedia Commons had no match for that topic.', 'warning')
      return null
    }
  }

  const askAI = async (q: string): Promise<PanelMsg[]> => {
    const lower = q.toLowerCase()
    if (/^highlight\b/.test(lower)) { highlightTopic(q.replace(/^highlight (everything about )?/i, '')); return [] }
    if (/^(focus|filter|rewrite this to focus)\b/.test(lower)) {
      const topic = q.replace(/^(rewrite this to focus only on|focus on|filter to)\s*/i, '').trim()
      setFilterTopic(topic || null)
      return topic ? [] : [{ role: 'ai', text: 'Back to the full document.' }]
    }
    if (/^add (an? )?image/.test(lower)) {
      const topic = q.replace(/^add (an? )?images? (for |of |about )?/i, '').trim()
      const ok = await addImageFor(topic || paras[0]?.slice(0, 30))
      return ok ? [{ role: 'ai', text: `Added an image for “${topic}” from Wikimedia Commons (license attributed below it).` }] : []
    }
    if (/^explain\b/.test(lower)) {
      const concept = q.replace(/^explain\s*/i, '').replace(/like i'?m new to this\.?$/i, '').trim()
      const res = await generateText({
        system: 'Explain concepts in plain language for a newcomer. Two short paragraphs maximum. No filler.',
        prompt: `From this document:\n\n${doc.text.slice(0, 5000)}\n\nExplain like I'm new to this: ${concept}`,
        maxTokens: 350,
      })
      return [{ role: 'ai', text: res.text }]
    }
    // general Q&A with source jump
    const res = await generateText({
      system: 'You answer questions about the provided document only. Be precise and cite the document. If the answer is not in the document, say so.',
      prompt: `Document:\n\n${doc.text.slice(0, 7000)}\n\nQuestion: ${q}`,
      maxTokens: 500,
    })
    const terms = q.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
    const sourceIdx = paras.findIndex((p) => terms.some((t) => p.toLowerCase().includes(t)))
    return [{ role: 'ai', text: res.text, sourceIdx: sourceIdx >= 0 ? sourceIdx : undefined }]
  }

  const jumpTo = (idx: number) => {
    scrollChildIntoView(scrollRef.current, paraRefs.current[idx], { block: 'center', smooth: !reduceMotion })
    setFlashIdx(idx)
    window.setTimeout(() => setFlashIdx((i) => (i === idx ? null : i)), 1100)
  }

  const dismissCoach = () => {
    const next = coachStep + 1
    setCoachStep(next >= COACH.length ? -1 : next)
    if (next >= COACH.length) localStorage.setItem('re.reader.coach', 'done')
  }

  const renderPara = (p: string, i: number) => {
    const marks = allMarks.filter((h) => p.includes(h.match))
    const isTopicMatch = dimmed && topicMarks.some((h) => p.includes(h.match))
    // The document is tidied here, in the browser: `:dot:` lines, "Step 2 —"
    // runs and blank-line-separated steps become real, cleanly marked lists.
    const blocks = toStudyBlocks(p)
    const fresh = justMarked !== null && marks.some((m) => m.tier === 'user' && m.match === justMarked)
    return (
      <motion.div
        key={`${version}-${i}`}
        ref={(el: HTMLDivElement | null) => { paraRefs.current[i] = el }}
        // Reading should feel like pages settling, not popping: a short rise and
        // fade, staggered a little per paragraph, capped so long documents do
        // not wait on the animation to be readable.
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : Math.min(i, 8) * 0.035 }}
        className={`relative re-para${flashIdx === i ? ' re-para-flash' : ''}${fresh ? ' re-para-fresh' : ''}`}
        style={{ marginBottom: '1.35em', opacity: dimmed && !isTopicMatch ? 0.45 : undefined, transition: 'opacity 300ms' }}
      >
        <StudyFlow blocks={blocks} inline={renderWithHighlights(p, marks)} renderText={(t) => renderWithHighlights(t, marks)} />
        {images.filter((im) => im.after === i).map((im, k) => (
          <figure key={k} className="my-5 re-figure">
            <img src={im.url} alt={im.caption} loading="lazy" decoding="async" className="w-full rounded-[12px]" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }} />
            <figcaption className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-3)' }}>
              {im.caption} — <span style={{ color: 'var(--text-3)' }}>{im.credit}</span>
            </figcaption>
          </figure>
        ))}
      </motion.div>
    )
  }

  const visibleIdx: number[] = []
  paras.forEach((p, i) => { if (!filterTopic || p.toLowerCase().includes(filterTopic.toLowerCase())) visibleIdx.push(i) })

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 h-12" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] rounded-full px-2.5 py-1 hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
          <ArrowLeft size={13} /> Library
        </button>
        <span className="text-[13px] font-medium truncate flex-1" style={{ letterSpacing: '-0.01em' }}>{doc.name}</span>
        {rewriteParas && (
          <div className="flex items-center rounded-full p-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            {(['rewritten', 'original'] as const).map((v) => (
              <button key={v} onClick={() => setVersion(v)}
                className="px-3 py-1 rounded-full text-[11.5px] capitalize transition-colors"
                style={{ background: version === v ? 'var(--elevated)' : 'transparent', color: version === v ? 'var(--text)' : 'var(--text-3)' }}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {filterTopic && (
        <div className="shrink-0 flex justify-center py-2">
          <button onClick={() => setFilterTopic(null)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px]"
            style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)' }}>
            Filtered view: “{filterTopic}” — Return to full document <X size={12} />
          </button>
        </div>
      )}

      {/* Reading pane */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto relative">
        {/* progress rail */}
        <div className="absolute left-4 top-8 bottom-8 w-[3px] rounded-full hidden lg:block" style={{ background: 'var(--elevated)' }}>
          <div className="w-full rounded-full re-rail" style={{ height: `${progress * 100}%`, background: 'var(--primary)' }} />
        </div>
        {/* annotation markers */}
        <div className="absolute right-4 top-8 bottom-8 w-2 hidden lg:block">
          {paras.map((p, i) => {
            const m = allMarks.find((h) => p.includes(h.match))
            if (!m) return null
            const top = ((i + 0.5) / paras.length) * 100
            return (
              <motion.button key={i} onClick={() => jumpTo(i)} aria-label={`Annotation in paragraph ${i + 1}`}
                initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 18, stiffness: 340, delay: Math.min(i, 10) * 0.03 }}
                whileHover={{ scale: 1.35 }}
                className="absolute -left-0.5 w-2.5 h-2.5 rounded-full"
                style={{ top: `${top}%`, background: TIER_STYLE[m.tier].border }} />
            )
          })}
        </div>

        <div ref={contentRef} className="max-w-[720px] mx-auto px-6 py-10 pb-[38vh]"
          style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 18, lineHeight: 1.7, color: 'var(--text)' }}>
          {visibleIdx.map((i) => renderPara(paras[i], i))}
        </div>

        {/* The chip that follows an automatic highlight. The highlight itself
            is already painted — these are the next steps, not a confirmation. */}
        <AnimatePresence>
          {selBtn && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="absolute z-30 flex items-center gap-1 px-1.5 py-1 rounded-full glass"
              style={{ left: selBtn.x, top: selBtn.y, transform: 'translateX(-50%)', border: '1px solid var(--surface-border)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.55)' }}>
              <span className="flex items-center gap-1.5 pl-1.5 pr-1 text-[11px]" style={{ color: 'var(--primary)' }}>
                <Sparkles size={11} /> Highlighted
              </span>
              <button
                onClick={() => { setSelBtn(null); void onQuizSection(selBtn.text) }}
                className="px-2 py-1 rounded-full text-[11px] hover:bg-[var(--elevated)]"
                style={{ color: 'var(--text-2)' }}>
                Quiz this
              </button>
              <button
                onClick={() => { setHighlights((h) => h.filter((x) => !(x.tier === 'user' && x.match === selBtn.text))); setSelBtn(null) }}
                className="px-2 py-1 rounded-full text-[11px] hover:bg-[var(--elevated)]"
                style={{ color: 'var(--text-2)' }}>
                Undo
              </button>
              <button onClick={() => setSelBtn(null)} aria-label="Dismiss"
                className="p-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                <X size={11} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* highlight tooltip */}
        <AnimatePresence>
          {tooltip && (
            <div className="absolute z-40 px-3 py-2 rounded-[10px] text-[11.5px] max-w-[280px] pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y, background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)' }}>
              <div className="font-semibold mb-0.5" style={{ color: 'var(--text)' }}>{tooltip.label}</div>
              {tooltip.text}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Coach marks (demo) */}
      <AnimatePresence>
        {coachStep >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[24vh] z-40 w-[340px] max-w-[90vw] glass p-4 rounded-[16px]"
            style={{ border: '1px solid var(--surface-border)', boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}>
            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: 'var(--primary)', color: '#fff' }}>{coachStep + 1}</span>
              <p className="text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--text-2)' }}>{COACH[coachStep]}</p>
            </div>
            <div className="flex justify-between items-center mt-3">
              <div className="flex gap-1">
                {COACH.map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= coachStep ? 'var(--primary)' : 'var(--elevated)' }} />)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setCoachStep(-1); localStorage.setItem('re.reader.coach', 'done') }} className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Skip all</button>
                <button onClick={dismissCoach} className="text-[11.5px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--primary)', color: '#fff' }}>
                  {coachStep === COACH.length - 1 ? 'Start exploring' : 'Next'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reading chatbox */}
      <ReaderChat
        docName={doc.name}
        onAsk={askAI}
        onJump={jumpTo}
        onQuiz={() => onQuizSection(visibleText)}
      />
    </div>
  )
}

/* ---------- study blocks: real list markup for tidied text ----------
 * `inline` is the paragraph as it was written, so a paragraph with no list
 * markers renders exactly as before (highlights included). */
function StudyFlow({ blocks, inline, renderText }: {
  blocks: StudyBlock[]
  inline: React.ReactNode
  renderText: (t: string) => React.ReactNode
}) {
  const hasList = blocks.some((b) => b.kind === 'bullets' || b.kind === 'steps')
  // Nothing structured → the untouched paragraph, highlights and all.
  if (!hasList) return <>{inline}</>

  return (
    <>
      {blocks.map((b, bi) => {
        if (b.kind === 'heading') {
          const size = b.level === 1 ? 26 : b.level === 2 ? 21 : 17
          return (
            <div key={bi} role="heading" aria-level={Math.min(6, b.level ?? 2)}
              className="font-semibold mt-5 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: size, letterSpacing: '-0.015em' }}>
              {renderText(b.text ?? '')}
            </div>
          )
        }
        if (b.kind === 'quote') {
          return (
            <blockquote key={bi} className="my-4 pl-4"
              style={{ borderLeft: '3px solid color-mix(in srgb, var(--primary) 45%, transparent)', color: 'var(--text-2)' }}>
              {renderText(b.text ?? '')}
            </blockquote>
          )
        }
        if (b.kind === 'code') {
          return <pre key={bi} className="my-4 p-3 rounded-[12px] overflow-x-auto text-[13.5px]"
            style={{ background: 'var(--code-bg)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{b.text}</pre>
        }
        if (b.kind === 'table') {
          return <pre key={bi} className="my-4 text-[15px] overflow-x-auto" style={{ fontFamily: 'inherit' }}>{b.text}</pre>
        }
        if (b.kind === 'steps') {
          return (
            <ol key={bi} start={b.start ?? 1} className="study-steps my-4"
              style={{ '--study-start': String((b.start ?? 1) - 1) } as React.CSSProperties}>
              {nestItems(b.items ?? []).map((it, k) => (
                <li key={k} className="study-li" style={it.depth ? { marginLeft: 18 } : undefined}>
                  <span className="study-marker" aria-hidden />
                  <span className="study-text">{renderText(it.text)}</span>
                  {it.children.length > 0 && (
                    <ul className="study-list">
                      {it.children.map((c, ci) => (
                        <li key={ci} className="study-li"><span className="study-marker" aria-hidden /><span className="study-text">{renderText(c)}</span></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )
        }
        return (
          <ul key={bi} className="study-list my-4">
            {nestItems(b.items ?? []).map((it, k) => (
              <li key={k} className="study-li">
                <span className="study-marker" aria-hidden />
                <span className="study-text">{renderText(it.text)}</span>
                {it.children.length > 0 && (
                  <ul className="study-list">
                    {it.children.map((c, ci) => (
                      <li key={ci} className="study-li"><span className="study-marker" aria-hidden /><span className="study-text">{renderText(c)}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      })}
    </>
  )
}

/** Flatten depth-tagged items into items-with-children for nested markup. */
function nestItems(items: { text: string; depth: number }[]): { text: string; depth: number; children: string[] }[] {
  const out: { text: string; depth: number; children: string[] }[] = []
  for (const it of items) {
    if (it.depth > 0 && out.length) out[out.length - 1].children.push(it.text)
    else out.push({ text: it.text, depth: it.depth, children: [] })
  }
  return out
}

/* ---------- highlight-aware paragraph renderer ---------- */
function renderWithHighlights(text: string, marks: Highlight[]): React.ReactNode {
  if (!marks.length) return renderBlock(text)
  // find the earliest occurring mark, split around it, recurse
  let best: { mark: Highlight; idx: number } | null = null
  for (const m of marks) {
    const idx = text.indexOf(m.match)
    if (idx >= 0 && (!best || idx < best.idx)) best = { mark: m, idx }
  }
  if (!best) return renderBlock(text)
  const { mark, idx } = best
  const before = text.slice(0, idx)
  const mid = text.slice(idx, idx + mark.match.length)
  const after = text.slice(idx + mark.match.length)
  const st = TIER_STYLE[mark.tier]
  const restMarks = marks.filter((m) => m !== mark || after.includes(m.match))
  return (
    <>
      {before && renderBlock(before)}
      <Mark span={mid} mark={mark} style={st} />
      {restMarks.length ? renderWithHighlights(after, restMarks) : renderBlock(after)}
    </>
  )
}

function Mark({ span, mark, style }: { span: string; mark: Highlight; style: { bg: string; border: string; label: string } }) {
  const [tip, setTip] = useState(false)
  // A marker swipe: the wash grows left→right, then the underline settles in.
  const fresh = mark.tier === 'user'
  return (
    <span className="relative">
      <mark
        className={fresh ? 're-mark re-mark-ink' : 're-mark'}
        onMouseEnter={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect()
          const host = (e.target as HTMLElement).closest('.relative')?.parentElement?.getBoundingClientRect() ?? r
          setTip(true)
          // position via parent handler is complex; use native title fallback + inline tooltip
          void host
        }}
        onMouseLeave={() => setTip(false)}
        style={{
          background: `linear-gradient(${style.bg}, ${style.bg}) left center / 100% 100% no-repeat`,
          boxShadow: `inset 2.5px 0 0 ${style.border}`,
          color: 'inherit', borderRadius: 3, padding: '0.05em 0',
        }}
        title={`${style.label}: ${mark.reason}`}
      >
        {span}
      </mark>
      {tip && (
        <span className="absolute left-0 bottom-full mb-1.5 z-30 block w-[260px] px-2.5 py-2 rounded-[8px] text-[11px] pointer-events-none"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <b style={{ color: 'var(--text)' }}>{style.label}.</b> {mark.reason}
        </span>
      )}
    </span>
  )
}

/** Markdown-ish block rendering for the reader column. */
/**
 * Inline markdown, rendered.
 *
 * A study rewrite, a pasted abstract or an imported document can all carry
 * `**bold**`, and a reader that prints the asterisks is showing the source
 * language instead of the text. Emphasis is drawn; a marker left unpaired
 * (which happens when a stored rewrite is truncated) is dropped rather than
 * shown, so no document ever reads like a diff of itself.
 */
function renderInline(text: string): React.ReactNode {
  if (!text.includes('*')) return text
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter((p) => p !== '')
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} style={{ fontWeight: 650 }}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        return <React.Fragment key={i}>{part.replace(/\*\*/g, '').replace(/\*/g, '')}</React.Fragment>
      })}
    </>
  )
}

function renderBlock(text: string): React.ReactNode {
  const t = text.trim()
  if (t.startsWith('# ')) return <h2 className="text-[26px] font-semibold mt-2 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{renderInline(t.slice(2))}</h2>
  if (t.startsWith('## ')) return <h3 className="text-[20px] font-semibold mt-6 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.015em' }}>{renderInline(t.slice(3))}</h3>
  if (t.startsWith('### ')) return <h4 className="text-[17px] font-semibold mt-5 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{renderInline(t.slice(4))}</h4>
  if (t.split('\n').every((l) => l.startsWith('|'))) {
    return <pre className="my-4 text-[15px] leading-relaxed overflow-x-auto" style={{ fontFamily: 'Lora, Georgia, serif' }}>{t}</pre>
  }
  if (t.startsWith('- ')) {
    return <p>{renderInline(t)}</p>
  }
  return <p>{renderInline(t)}</p>
}

/* ---------- floating reading chatbox ---------- */
function ReaderChat({ docName, onAsk, onJump, onQuiz }: {
  docName: string
  onAsk: (q: string) => Promise<PanelMsg[]>
  onJump: (idx: number) => void
  onQuiz: () => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<PanelMsg[]>([])

  const send = async (raw?: string) => {
    const q = (raw ?? text).trim()
    if (!q || busy) return
    setText('')
    setBusy(true)
    setOpen(true)
    setPanel((p) => [...p, { role: 'user', text: q }])
    try {
      const msgs = await onAsk(q)
      setPanel((p) => [...p, ...msgs])
    } catch (e: any) {
      setPanel((p) => [...p, { role: 'ai', text: `Something went wrong: ${e?.message ?? e}` }])
    } finally { setBusy(false) }
  }

  const chips = ['Highlight everything about hydrogen bonds', 'Explain base pairing like I\'m new to this', 'Quiz me on this section']

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[640px] px-4 z-30">
      <AnimatePresence>
        {open && (panel.length > 0 || busy) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="mb-2 max-h-[36vh] overflow-y-auto rounded-[18px] p-3.5 space-y-2.5"
            style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--surface-border)', boxShadow: '0 16px 48px -16px rgba(0,0,0,0.55)' }}>
            {panel.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <div className={`inline-block text-left text-[12.5px] leading-relaxed px-3 py-2 rounded-[12px] max-w-[92%] ${m.role === 'user' ? 'whitespace-pre-wrap' : ''}`}
                  style={{ background: m.role === 'user' ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--surface)', color: 'var(--text)' }}>
                  {m.role === 'user' ? m.text : <Markdown content={normalizeStepText(m.text)} />}
                </div>
                {m.role === 'ai' && m.sourceIdx != null && (
                  <button onClick={() => onJump(m.sourceIdx!)} className="block text-[11px] mt-1 hover:underline" style={{ color: 'var(--primary)' }}>
                    See this in the source →
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="text-[11.5px] italic" style={{ color: 'var(--text-3)' }}>Reading the document…</div>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-full flex items-center gap-2 px-2 py-2 transition-all"
        style={{
          background: 'var(--glass)', backdropFilter: 'blur(16px)',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--surface-border))',
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent)',
        }}>
        {!open && <MessageSquareText size={15} className="ml-2 shrink-0" style={{ color: 'var(--primary)' }} />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder={`Ask about ${docName.slice(0, 28)}${docName.length > 28 ? '…' : ''} — highlight, explain, quiz…`}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] px-2"
          style={{ color: 'var(--text)' }}
        />
        {!open && (
          <div className="hidden md:flex gap-1 pr-1">
            {chips.slice(0, 1).map((c) => (
              <button key={c} onClick={() => send(c)} className="text-[10.5px] px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                {c.slice(0, 26)}…
              </button>
            ))}
          </div>
        )}
        {open && <button onClick={onQuiz} title="Quiz me on this section" className="p-2 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}><GraduationCap size={15} strokeWidth={1.5} /></button>}
        <button onClick={() => send()} disabled={!text.trim() || busy} aria-label="Send"
          className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-35"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Send size={13} />
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse chat' : 'Expand chat'}
          className="p-2 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
          {open ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  )
}
