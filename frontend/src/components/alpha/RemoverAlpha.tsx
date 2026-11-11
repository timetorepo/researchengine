/**
 * removerAlpha.
 *
 * Paste anything, or send it here from an answer, and this says what makes it
 * read as machine-written: the findings for the text in hand, and the whole
 * catalogue of tells, so the list can be read as a reference. Nothing leaves
 * the machine and nothing is spent: the analysis is a set of rules applied in
 * the browser (lib/text/alpha), which is why the badge on screen can say
 * "0 tokens" and mean it.
 *
 * The fix button only applies substitutions that cannot change the meaning of a
 * sentence. It reports how many it made, so the result is never a silent
 * rewrite, and the original stays one click away.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ScanText, Copy, Check, Wand2, RotateCcw, ShieldCheck, FileText, Sparkles, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { analyzeAlpha, localFix, type AlphaCategory, type AlphaReport } from '@/lib/text/alpha'

const CATEGORY_LABEL: Record<AlphaCategory, string> = {
  punctuation: 'Punctuation',
  phrasing: 'Phrasing',
  vocabulary: 'Word choice',
  structure: 'Structure',
  formatting: 'Formatting',
  boilerplate: 'Chat boilerplate',
  statistics: 'Rhythm',
}

const SEVERITY_STYLE = {
  high: { color: 'var(--danger)', label: 'strong tell' },
  medium: { color: 'var(--warning, #FBBF24)', label: 'tell' },
  low: { color: 'var(--text-3)', label: 'weak tell' },
} as const

const BAND_COPY = {
  human: { title: 'Reads human', sub: 'Nothing in this text stands out as generated.' },
  light: { title: 'A few tells', sub: 'Mechanical, easy to clean up. Nothing structural.' },
  noticeable: { title: 'Noticeably generated', sub: 'Several habits are firing at once.' },
  heavy: { title: 'Reads like raw model output', sub: 'This would be spotted. The fix pass and the list below are the way out.' },
} as const

export function RemoverAlpha() {
  const ui = useUI()
  const [text, setText] = useState('')
  const [fixed, setFixed] = useState<string | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [copied, setCopied] = useState<'original' | 'fixed' | null>(null)
  const [showCatalog, setShowCatalog] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  // A chat answer can hand its text over ("check for AI tells" on the message).
  useEffect(() => {
    try {
      const handed = sessionStorage.getItem('re.alpha.text')
      if (handed) {
        setText(handed)
        sessionStorage.removeItem('re.alpha.text')
        ui.toast('Loaded from the chat', 'The answer was handed over for a local check.', 'info')
      }
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const report: AlphaReport | null = useMemo(() => (text.trim().length >= 20 ? analyzeAlpha(text) : null), [text])
  const display = fixed ?? text

  const fix = () => {
    if (!report) return
    const res = localFix(text)
    setFixed(res.text)
    setAppliedCount(res.changed)
    ui.toast(
      res.changed ? `Applied ${res.changed} local fix${res.changed === 1 ? '' : 'es'}` : 'Nothing mechanical to fix',
      res.changed ? 'Em dashes, markers and boilerplate only. Read it before you send it.' : 'The rest needs your judgement, which is what the list is for.',
      res.changed ? 'success' : 'info',
    )
  }

  const copy = async (what: 'original' | 'fixed') => {
    try {
      await navigator.clipboard.writeText(what === 'fixed' ? (fixed ?? text) : text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1400)
    } catch { ui.toast('Clipboard blocked', 'Select the text and copy it manually.', 'danger') }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const body = await f.text()
    setText(body)
    setFixed(null)
    ui.toast('Loaded', `${f.name} · ${body.length.toLocaleString()} characters`, 'info')
  }

  return (
    <div className="h-full overflow-y-auto" data-ui="remover-alpha">
      <div className="max-w-[980px] mx-auto px-5 py-8">
        <div className="flex items-start gap-3 mb-1">
          <ScanText size={20} style={{ color: 'var(--primary)' }} className="mt-0.5" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>removerAlpha</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>
              What makes a text look AI-written, and how to take it out. Everything here runs on this device.
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] shrink-0"
            style={{ background: 'color-mix(in srgb, var(--success) 12%, var(--surface))', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)' }}>
            <ShieldCheck size={12} /> 0 tokens · 0 requests
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {/* ---------------------------------------------------------- input */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-medium flex-1">Text</span>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
                <FileText size={12} /> Open a file
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,text/*" className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
            <textarea
              value={display}
              onChange={(e) => { setFixed(null); setText(e.target.value) }}
              onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]) }}
              onDragOver={(e) => e.preventDefault()}
              placeholder="Paste an answer, a draft, an abstract, an email. Or drag a file in."
              spellCheck={false}
              className="flex-1 min-h-[340px] rounded-[14px] p-4 text-[13px] leading-relaxed outline-none resize-none font-[inherit]"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Button size="sm" onClick={fix} disabled={!report} startContent={<Wand2 size={13} />}>Fix what is mechanical</Button>
              {fixed !== null && (
                <Button size="sm" variant="ghost" color="default" onClick={() => { setFixed(null); setAppliedCount(0) }} startContent={<RotateCcw size={13} />}>Undo</Button>
              )}
              <button onClick={() => void copy(fixed !== null ? 'fixed' : 'original')} className="flex items-center gap-1 text-[11.5px] px-2.5 py-1.5 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
                {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
              {report && <span className="text-[11px] ml-auto" style={{ color: 'var(--text-3)' }}>
                {report.stats.words.toLocaleString()} words · {report.stats.sentences} sentences
              </span>}
            </div>
          </div>

          {/* --------------------------------------------------------- report */}
          <div className="flex flex-col gap-3">
            {!report ? (
              <div className="surface p-5 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Sparkles size={18} style={{ color: 'var(--text-3)' }} />
                <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-2)' }}>Paste at least a sentence and the report appears here.</p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>It is a local rules pass. No model is called, so nothing is spent and nothing is uploaded.</p>
              </div>
            ) : (
              <>
                <div className="surface p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-[64px] h-[64px] shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--elevated)" strokeWidth="4" />
                        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round"
                          stroke={report.band === 'human' ? 'var(--success)' : report.band === 'heavy' ? 'var(--danger)' : 'var(--primary)'}
                          strokeDasharray={`${(report.score / 100) * 97.4} 97.4`} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold">{report.score}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium">{BAND_COPY[report.band].title}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>{BAND_COPY[report.band].sub}</div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                        {report.findings.length} rule{report.findings.length === 1 ? '' : 's'} firing
                        {appliedCount > 0 && <> · {appliedCount} local fix{appliedCount === 1 ? '' : 'es'} applied</>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    {[
                      ['em dashes', report.stats.emDashes],
                      ['bold markers', report.stats.boldMarkers],
                      ['bullets', report.stats.bullets],
                      ['avg sentence', `${report.stats.avgSentenceWords}w`],
                      ['spread', `${report.stats.sentenceVariance}`],
                      ['paragraphs', report.stats.paragraphs],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-[10px] py-1.5" style={{ background: 'var(--elevated)' }}>
                        <div className="text-[12.5px] font-medium">{v}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{k}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="surface p-4 max-h-[420px] overflow-y-auto">
                  <div className="text-[12px] font-medium mb-2">What is firing in this text</div>
                  {report.findings.length === 0 && (
                    <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>Nothing. That is the answer.</p>
                  )}
                  <div className="flex flex-col gap-2">
                    {report.findings.map((f) => (
                      <div key={f.id} className="rounded-[10px] p-2.5" style={{ background: 'var(--elevated)' }}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={12} style={{ color: SEVERITY_STYLE[f.severity].color }} />
                          <span className="text-[12px] font-medium flex-1">{f.label}</span>
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>
                            {f.count}× · {SEVERITY_STYLE[f.severity].label}
                          </span>
                        </div>
                        <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.why}</p>
                        {f.fix && <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>Instead: {f.fix}</p>}
                        {f.samples.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {f.samples.slice(0, 4).map((s, i) => (
                              <code key={i} className="text-[10.5px] px-1.5 py-0.5 rounded-[6px] truncate max-w-[220px]"
                                style={{ background: 'var(--surface)', color: 'var(--text-2)' }}>{s.text}</code>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- catalogue */}
        <div className="mt-6">
          <button onClick={() => setShowCatalog((v) => !v)} className="flex items-center gap-2 text-[12.5px] font-medium mb-2">
            <span style={{ color: 'var(--text)' }}>The full list: {report ? `${report.catalog.length} tells checked` : 'every tell checked'}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{showCatalog ? 'hide' : 'show'}</span>
          </button>
          {showCatalog && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(CATEGORY_LABEL) as AlphaCategory[]).map((cat) => {
                const rules = (report?.catalog ?? []).filter((c) => c.rule.category === cat)
                if (!rules.length) return null
                return (
                  <div key={cat} className="surface p-3.5">
                    <div className="text-[12px] font-medium mb-2 flex items-center gap-2">
                      {CATEGORY_LABEL[cat]}
                      <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                        {rules.filter((r) => r.count > 0).length}/{rules.length} firing
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {rules.map(({ rule, count }) => (
                        <div key={rule.id} className="flex items-start gap-2 text-[11.5px] leading-snug">
                          <span className="mt-[3px] w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: count > 0 ? SEVERITY_STYLE[rule.severity].color : 'var(--surface-border)' }} />
                          <span style={{ color: count > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                            {rule.label}
                            {count > 0 && <span style={{ color: 'var(--text-3)' }}> · {count}×</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Hand a piece of text to removerAlpha from anywhere in the app. */
export function handOffToAlpha(text: string) {
  try { sessionStorage.setItem('re.alpha.text', text) } catch { /* ignore */ }
  window.location.hash = '#/alpha'
}

/** Small inline chip: run the analysis on an answer without leaving the chat. */
export function AlphaChip({ text, onOpen }: { text: string; onOpen?: () => void }) {
  const report = React.useMemo(() => (text.trim().length >= 40 ? analyzeAlpha(text) : null), [text])
  const reduce = useStore((s) => s.settings.reduceMotion)
  if (!report || report.findings.length === 0) return null
  return (
    <button
      onClick={onOpen}
      title={`removerAlpha: ${report.summary.slice(0, 4).join(' · ')}`}
      className="flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full"
      style={{
        color: report.band === 'heavy' ? 'var(--danger)' : 'var(--text-3)',
        background: 'var(--elevated)',
        border: '1px solid var(--surface-border)',
      }}>
      <ScanText size={10} />
      {reduce ? `${report.findings.length} AI tells` : <>AI tells {report.score}</>}
    </button>
  )
}
