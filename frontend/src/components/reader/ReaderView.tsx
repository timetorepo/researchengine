import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Send, Sparkles, Image as ImageIcon, X, GraduationCap, MessageSquareText, Minimize2, Maximize2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { generateText } from '@/lib/chat/generate'
import { getMaster } from '@/lib/prompts/masters'
import { webSearch } from '@/lib/search/web'
import type { DemoHighlight } from '@/lib/documents/demoDoc'

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
  const [selBtn, setSelBtn] = useState<{ x: number; y: number; text: string } | null>(null)
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
      setTimeout(() => paraRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
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

  // ---- user highlight via text selection ----
  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (text.length > 6 && contentRef.current?.contains(sel!.anchorNode)) {
        const r = sel!.getRangeAt(0).getBoundingClientRect()
        const host = scrollRef.current!.getBoundingClientRect()
        setSelBtn({ x: r.left + r.width / 2 - host.left, y: r.top - host.top - 36, text: text.slice(0, 240) })
      } else setSelBtn(null)
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  // ---- chatbox command handlers ----
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
    paraRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const dismissCoach = () => {
    const next = coachStep + 1
    setCoachStep(next >= COACH.length ? -1 : next)
    if (next >= COACH.length) localStorage.setItem('re.reader.coach', 'done')
  }

  const renderPara = (p: string, i: number) => {
    const marks = allMarks.filter((h) => p.includes(h.match))
    const isTopicMatch = dimmed && topicMarks.some((h) => p.includes(h.match))
    return (
      <div
        key={`${version}-${i}`}
        ref={(el) => { paraRefs.current[i] = el }}
        className="relative"
        style={{ marginBottom: '1.35em', opacity: dimmed && !isTopicMatch ? 0.45 : 1, transition: 'opacity 300ms' }}
      >
        {renderWithHighlights(p, marks)}
        {images.filter((im) => im.after === i).map((im, k) => (
          <figure key={k} className="my-5">
            <img src={im.url} alt={im.caption} loading="lazy" decoding="async" className="w-full rounded-[12px]" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }} />
            <figcaption className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-3)' }}>
              {im.caption} — <span style={{ color: 'var(--text-3)' }}>{im.credit}</span>
            </figcaption>
          </figure>
        ))}
      </div>
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
          <div className="w-full rounded-full" style={{ height: `${progress * 100}%`, background: 'var(--primary)', transition: 'height 120ms linear' }} />
        </div>
        {/* annotation markers */}
        <div className="absolute right-4 top-8 bottom-8 w-2 hidden lg:block">
          {paras.map((p, i) => {
            const m = allMarks.find((h) => p.includes(h.match))
            if (!m) return null
            const top = ((i + 0.5) / paras.length) * 100
            return (
              <button key={i} onClick={() => jumpTo(i)} aria-label={`Annotation in paragraph ${i + 1}`}
                className="absolute -left-0.5 w-2.5 h-2.5 rounded-full hover:scale-125 transition-transform"
                style={{ top: `${top}%`, background: TIER_STYLE[m.tier].border }} />
            )
          })}
        </div>

        <div ref={contentRef} className="max-w-[720px] mx-auto px-6 py-10 pb-[38vh]"
          style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 18, lineHeight: 1.7, color: 'var(--text)' }}>
          {visibleIdx.map((i) => renderPara(paras[i], i))}
        </div>

        {/* floating selection highlight button */}
        <AnimatePresence>
          {selBtn && (
            <motion.button
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={() => {
                setHighlights((h) => [...h, { match: selBtn.text, tier: 'user', reason: 'Your highlight.' }])
                setSelBtn(null)
              }}
              className="absolute z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px]"
              style={{ left: selBtn.x, top: selBtn.y, background: 'var(--primary)', color: '#fff', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)' }}>
              <Sparkles size={11} /> Highlight
            </motion.button>
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
  return (
    <span className="relative">
      <mark
        onMouseEnter={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect()
          const host = (e.target as HTMLElement).closest('.relative')?.parentElement?.getBoundingClientRect() ?? r
          setTip(true)
          // position via parent handler is complex; use native title fallback + inline tooltip
          void host
        }}
        onMouseLeave={() => setTip(false)}
        style={{ background: style.bg, boxShadow: `inset 2.5px 0 0 ${style.border}`, color: 'inherit', borderRadius: 3, padding: '0.05em 0' }}
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
function renderBlock(text: string): React.ReactNode {
  const t = text.trim()
  if (t.startsWith('# ')) return <h2 className="text-[26px] font-semibold mt-2 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{t.slice(2)}</h2>
  if (t.startsWith('## ')) return <h3 className="text-[20px] font-semibold mt-6 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.015em' }}>{t.slice(3)}</h3>
  if (t.startsWith('### ')) return <h4 className="text-[17px] font-semibold mt-5 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{t.slice(4)}</h4>
  if (t.split('\n').every((l) => l.startsWith('|'))) {
    return <pre className="my-4 text-[15px] leading-relaxed overflow-x-auto" style={{ fontFamily: 'Lora, Georgia, serif' }}>{t}</pre>
  }
  if (t.startsWith('- ')) {
    return <p>{t}</p>
  }
  return <p>{t}</p>
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
                <div className="inline-block text-left text-[12.5px] leading-relaxed px-3 py-2 rounded-[12px] max-w-[92%] whitespace-pre-wrap"
                  style={{ background: m.role === 'user' ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--surface)', color: 'var(--text)' }}>
                  {m.text}
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
