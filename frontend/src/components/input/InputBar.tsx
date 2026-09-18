import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Square, Wind, Globe, Sparkles, Sigma, Paperclip, StopCircle, Hammer, ListOrdered, ImagePlus, Plug, X, Loader2, FolderOpen, Mail, CalendarDays, HardDrive, SlidersHorizontal, Calculator, BookOpen } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { SkillPicker } from './SkillPicker'
import { IntegrationPicker } from './IntegrationPicker'
import { clsx } from 'clsx'

export interface ContextRef { box: 'files' | 'drive' | 'mail' | 'calendar'; id: string; title: string }
export interface SendOpts {
  search?: boolean; quality?: boolean; replicate?: boolean
  attachments?: { type: 'image'; name: string; dataUrl: string }[]
  contextRefs?: ContextRef[]
}

interface Props {
  onSend: (prompt: string, opts?: SendOpts) => void
  mathMode: boolean
  setMathMode: (v: boolean) => void
  streaming: boolean
  onStop: () => void
  emptyHistory: boolean
  chatId: string
  autoFocus?: boolean
  big?: boolean
}

export function InputBar({ onSend, mathMode, setMathMode, streaming, onStop, emptyHistory, chatId, autoFocus = true, big = false }: Props) {
  const [text, setText] = useState('')
  const [search, setSearch] = useState(false)
  const [quality, setQuality] = useState(false)
  const [replicate, setReplicate] = useState(false)
  const [picker, setPicker] = useState<'skill' | 'source' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [sent, setSent] = useState(false)
  const [imgs, setImgs] = useState<{ name: string; dataUrl: string }[]>([])
  const [refs, setRefs] = useState<ContextRef[]>([])
  const [connOpen, setConnOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const glassMode = useStore((s) => s.settings.glassMode)
  const flowEnabled = useStore((s) => s.settings.flowEnabled)
  const ui = useUI()
  const navigate = useNavigate()

  // auto-expand
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, big ? 280 : 200) + 'px'
  }, [text])

  useEffect(() => { if (autoFocus) taRef.current?.focus() }, [chatId, autoFocus])

  // ↑ in empty input → edit last user message
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (picker && (e.key === 'Escape')) { setPicker(null); return }
    if (e.key === 'ArrowUp' && text === '' && emptyHistory === false) {
      const chat = useStore.getState().chats.find((c) => c.id === chatId)
      const lastUser = chat && [...chat.messages].reverse().find((m) => m.role === 'user')
      if (lastUser && taRef.current) { e.preventDefault(); setText(lastUser.content) }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend(e.metaKey || e.ctrlKey ? { search: true, quality, replicate } : { quality, replicate })
    }
  }

  const onChange = (v: string) => {
    setText(v)
    if (v.startsWith('/') && !v.includes(' ')) { setPicker('skill'); setPickerQuery(v.slice(1)) }
    else if (v.startsWith('@') && !v.includes(' ')) { setPicker('source'); setPickerQuery(v.slice(1)) }
    else setPicker(null)
  }

  const doSend = (opts: { search?: boolean; quality?: boolean; replicate?: boolean } = {}) => {
    const raw = text.trim()
    // No streaming guard here: ChatView decides — while streaming, prompts
    // are queued and run automatically when the current answer finishes.
    if (!raw) return

    // ---- Easter eggs (strict rules) ----
    if (raw === '-404') { ui.set({ notFound: true }); setText(''); return }
    if (raw === '/konami') {
      const on = !useUI.getState().starfield
      ui.set({ starfield: on })
      ui.toast(on ? 'Konami accepted' : 'Star field dismissed', on ? 'Star field active for this session. Type /konami again to dismiss.' : 'Back to solid ground.')
      setText('')
      return
    }

    if (picker === 'skill') { setPicker(null) }
    setSent(true)
    setTimeout(() => setSent(false), 400)
    onSend(raw, {
      search: search || quality || opts.search, quality: quality || opts.quality, replicate: replicate || opts.replicate,
      attachments: imgs.length ? imgs.map((f) => ({ type: 'image' as const, name: f.name, dataUrl: f.dataUrl })) : undefined,
      contextRefs: refs.length ? refs : undefined,
    })
    setText('')
    setSearch(false)
    setImgs([])
    setRefs([])
    setConnOpen(false)
  }

  const attachImage = (file: File) => {
    if (imgs.length >= 3) { ui.toast('Attachment limit', 'Up to 3 images per message.', 'warning'); return }
    if (file.size > 4 * 1024 * 1024) { ui.toast('Image too large', 'Images are capped at 4 MB.', 'warning'); return }
    const r = new FileReader()
    r.onload = () => setImgs((cur) => [...cur, { name: file.name, dataUrl: String(r.result) }])
    r.readAsDataURL(file)
  }

  const pills = [
    { id: 'flow', label: 'Flow', icon: Wind, active: flowEnabled, toggle: () => useStore.setState((s) => ({ settings: { ...s.settings, flowEnabled: !s.settings.flowEnabled } })), title: 'AIFlowEngine — token-efficient context' },
    { id: 'search', label: 'Search', icon: Globe, active: search, toggle: () => setSearch(!search), title: 'Web search with citations (Cmd/Ctrl+Enter)' },
    { id: 'quality', label: 'Quality', icon: Sparkles, active: quality, toggle: () => { setQuality(!quality); if (!quality) setSearch(true) }, title: 'Longer, thoroughly cited, structured answers' },
    { id: 'math', label: 'Math', icon: Sigma, active: mathMode, toggle: () => setMathMode(!mathMode), title: 'Step-by-step LaTeX (Cmd/Ctrl+M)' },
    { id: 'replicate', label: 'Replicate', icon: Hammer, active: replicate, toggle: () => setReplicate(!replicate), title: 'New Tech — staged replication research plan' },
  ]

  return (
    <div className={clsx('shrink-0 px-3 pb-3 pt-1', big && 'pb-6')}>
      <div className={clsx('mx-auto', big ? 'max-w-[720px]' : 'max-w-[760px]')}>
        <div
          className={clsx('input-shell', glassMode !== 'off' && 'glass-chat')}
          style={{
            borderRadius: big ? 22 : 18,
            background: glassMode === 'off' ? 'var(--elevated)' : undefined,
            boxShadow: big ? '0 16px 48px -20px rgba(0,0,0,0.5)' : undefined,
          }}
        >
          <div className="relative">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={big ? 'What would you like to research today?' : 'Ask, or type / for skills, @ for sources…'}
              className="chat-input w-full bg-transparent outline-none resize-none px-4 pt-3.5 pb-1 text-[14px] leading-relaxed"
              style={{ minHeight: big ? 56 : 44 }}
              aria-label="Message input"
            />

            <AnimatePresence>
              {picker === 'skill' && (
                <SkillPicker
                  query={pickerQuery}
                  onPick={(skill) => { setText(''); setPicker(null); useUI.setState({ skillRun: { skillId: skill.id } }) }}
                  onClose={() => setPicker(null)}
                />
              )}
              {picker === 'source' && (
                <IntegrationPicker
                  query={pickerQuery}
                  onPick={(label) => { setText((t) => t.replace(/@\S*$/, `@${label} `)); setPicker(null) }}
                  onClose={() => setPicker(null)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Attached images + connector references */}
          {(imgs.length > 0 || refs.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1.5">
              {imgs.map((f, i) => (
                <span key={i} className="relative group">
                  <img src={f.dataUrl} alt={f.name} className="h-12 w-12 object-cover rounded-[8px]" style={{ border: '1px solid var(--surface-border)' }} />
                  <button onClick={() => setImgs((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--danger)', color: '#fff' }}><X size={9} /></button>
                </span>
              ))}
              {refs.map((r, i) => (
                <span key={`${r.box}-${r.id}-${i}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10.5px]"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                  {r.box === 'files' ? <FolderOpen size={10} /> : r.box === 'drive' ? <HardDrive size={10} /> : r.box === 'mail' ? <Mail size={10} /> : <CalendarDays size={10} />}
                  <span className="max-w-[140px] truncate">{r.title}</span>
                  <button onClick={() => setRefs((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove reference"
                    className="p-0.5 rounded-full" style={{ color: 'var(--text-3)' }}><X size={9} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Bottom row: pills + send */}
          <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
            <div className="relative">
              <button onClick={() => setModeOpen((v) => !v)} title="Choose a mode" aria-label="Choose a mode" aria-expanded={modeOpen}
                className="flex items-center justify-center w-9 h-8 rounded-full transition-colors hover:bg-[var(--elevated)]"
                style={{ color: pills.some((p) => p.active) ? 'var(--primary)' : 'var(--text-3)', background: modeOpen ? 'var(--elevated)' : 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <SlidersHorizontal size={15} strokeWidth={1.7} />
              </button>
              <AnimatePresence>
                {modeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModeOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: 5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 bottom-full mb-2 z-50 w-[230px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-[14px] p-1.5"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 18px 44px -16px rgba(0,0,0,.55)' }}>
                      <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-3)' }}>Choose mode</div>
                      {pills.map((p) => (
                        <button key={p.id} onClick={() => { p.toggle(); setModeOpen(false) }} title={p.title} aria-pressed={p.active}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left text-[12.5px] transition-colors hover:bg-[var(--surface)]"
                          style={{ color: p.active ? (p.id === 'math' ? 'var(--warning)' : 'var(--primary)') : 'var(--text-2)' }}>
                          <p.icon size={14} strokeWidth={1.7} />
                          <span className="flex-1">{p.label}</span>
                          {p.active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.id === 'math' ? 'var(--warning)' : 'var(--primary)' }} />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <span className="hidden sm:inline text-[11px]" style={{ color: 'var(--text-3)' }}>{pills.filter((p) => p.active).map((p) => p.label).join(' · ') || 'Mode'}</span>

            <div className="flex-1" />

            <button className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors" style={{ color: 'var(--text-3)' }} aria-label="Attach document"
              onClick={() => { navigate('/quiz'); ui.toast('Read & Quiz', 'Drop a PDF, DOCX, TXT or Markdown file to study it.') }}>
              <Paperclip size={15} strokeWidth={1.5} />
            </button>

            {/* Vision: attach images for models that can see them */}
            <button className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors" style={{ color: imgs.length ? 'var(--primary)' : 'var(--text-3)' }} aria-label="Attach image"
              title="Attach images — supported models can see them"
              onClick={() => imgInputRef.current?.click()}>
              <ImagePlus size={15} strokeWidth={1.5} />
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { Array.from(e.target.files ?? []).forEach(attachImage); e.target.value = '' }} />

            {/* Connectors: Local Files / Drive / Mail / Calendar */}
            <div className="relative">
              <button className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors" style={{ color: refs.length || connOpen ? 'var(--primary)' : 'var(--text-3)' }} aria-label="Connectors"
                title="Connectors — Local Files, Drive, Mail, Calendar"
                onClick={() => setConnOpen((o) => !o)}>
                <Plug size={15} strokeWidth={1.5} />
              </button>
              {connOpen && (
                <ConnectorMenu
                  onPick={(r) => setRefs((cur) => [...cur, r])}
                  onClose={() => setConnOpen(false)}
                />
              )}
            </div>

            {streaming ? (
              <>
                {text.trim() && (
                  <button
                    onClick={() => doSend({})}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                    style={{ background: 'var(--primary)', color: '#fff' }}
                    aria-label="Queue question"
                    title="Queue — runs when the current answer finishes"
                  >
                    <ListOrdered size={13} />
                  </button>
                )}
                <button
                  onClick={onStop}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                  aria-label="Stop generating"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              </>
            ) : (
              <button
                onClick={() => doSend({})}
                disabled={!text.trim()}
                className="press-tap w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-35 disabled:hover:scale-100"
                style={{ background: 'var(--primary)', color: '#fff' }}
                aria-label="Send"
              >
                <motion.span animate={sent ? { y: -14, opacity: 0 } : { y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
                  <ArrowUp size={15} strokeWidth={2.2} />
                </motion.span>
              </button>
            )}
          </div>
        </div>
        <div className="text-center text-[10.5px] mt-2" style={{ color: 'var(--text-3)' }}>
          Responses run on your configured models. Without keys, a local demo model answers.
        </div>
      </div>
    </div>
  )
}

/* ---------- Connector picker: Local Files / Drive / Mail / Calendar ----------
 * Everything is local-first and genuinely queryable. Picking an item attaches
 * it as context for the message; the AI can also reach these on its own via
 * tool calls (connector_search / connector_read). */
const BOX_META: Record<string, { label: string; icon: any; hue: number }> = {
  files: { label: 'Local Files', icon: FolderOpen, hue: 210 },
  drive: { label: 'Drive', icon: HardDrive, hue: 260 },
  mail: { label: 'Mail', icon: Mail, hue: 20 },
  calendar: { label: 'Calendar', icon: CalendarDays, hue: 150 },
}

function ConnectorMenu({ onPick, onClose }: { onPick: (r: ContextRef) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ContextRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      setLoading(true)
      setErr('')
      try {
        const out: ContextRef[] = []
        const q = query.trim()
        // Local files + connector boxes in one sweep.
        const [filesRes, connRes] = await Promise.all([
          fetch('/api/fs/list'),
          fetch(`/api/connectors/search?q=${encodeURIComponent(q)}`),
        ])
        if (filesRes.ok) {
          const fj = await filesRes.json()
          for (const f of (fj.files ?? []).filter((x: any) => !x.dir)) {
            if (!q || f.name.toLowerCase().includes(q.toLowerCase())) out.push({ box: 'files', id: f.name, title: f.name })
          }
        }
        if (connRes.ok) {
          const cj = await connRes.json()
          for (const h of cj.hits ?? []) out.push({ box: h.box, id: h.id, title: h.title ?? '(untitled)' })
        }
        if (live) setHits(out.slice(0, 30))
      } catch (e: any) {
        if (live) setErr(String(e?.message ?? e))
      } finally {
        if (live) setLoading(false)
      }
    }, 160)
    return () => { live = false; clearTimeout(t) }
  }, [query])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-full right-0 mb-2 w-[300px] z-50 rounded-[14px] overflow-hidden"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 16px 48px -16px rgba(0,0,0,0.5)' }}>
        <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Connectors</div>
        <div className="px-3 pb-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder="Search files, mail, events…"
            className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
        </div>
        <div className="max-h-56 overflow-y-auto pb-1.5">
          {loading && <div className="flex items-center gap-2 px-3.5 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}><Loader2 size={13} className="animate-spin" /> Searching…</div>}
          {!loading && err && <div className="px-3.5 py-3 text-[12px]" style={{ color: 'var(--danger)' }}>{err}</div>}
          {!loading && !err && hits.length === 0 && (
            <div className="px-3.5 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>
              No items yet. Add files in Settings → Integrations, or drop data into Drive / Mail / Calendar there.
            </div>
          )}
          {hits.map((h, i) => {
            const meta = BOX_META[h.box] ?? BOX_META.files
            return (
              <button key={`${h.box}-${h.id}-${i}`} onClick={() => { onPick(h); onClose() }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-[var(--surface)] transition-colors">
                <span className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ background: `hsl(${meta.hue} 50% 45% / 0.18)`, color: `hsl(${meta.hue} 62% 62%)` }}>
                  <meta.icon size={13} strokeWidth={1.6} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] truncate" style={{ color: 'var(--text)' }}>{h.title}</span>
                  <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>{meta.label}</span>
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}
