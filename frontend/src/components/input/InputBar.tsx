import { EffortSlider } from './EffortSlider'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Square, Wind, Globe, Sparkles, Sigma, Paperclip, Hammer, ListOrdered, ImagePlus, Plug, X, SlidersHorizontal, Calculator, BookOpen, Mic, FolderOpen, HardDrive, Mail, CalendarDays, Github, StickyNote, Hash, Gauge } from 'lucide-react'
import { VoiceBeam } from 'voice-glow'
import VoicePill from '@/components/ui/reactbits/micro/VoicePill'
import { useDictation } from '@/hooks/useDictation'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { BorderBeam } from 'border-beam'
import { SkillPicker } from './SkillPicker'
import { IntegrationPicker } from './IntegrationPicker'
import { triggerAt, replaceTrigger } from './trigger'
import { type ModeOption } from './ModeMenu'
import { ModeStrip } from './ModeStrip'
import { IntegrationsMenu } from './IntegrationsMenu'
import { clsx } from 'clsx'
import { themeKind } from '@/lib/themes/meta'

export interface ContextRef {
  /** `files` | `drive` | `mail` | `calendar` are the local boxes; `int:<id>` is a
   *  connected account (Gmail, Drive, GitHub, Notion, Slack, local files). */
  box: 'files' | 'drive' | 'mail' | 'calendar' | `int:${string}`
  id: string
  title: string
}
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

/**
 * Voice by Jakub Antalik wraps the composer only when the glow is switched on —
 * off means the component is not mounted at all, not merely invisible.
 */
function ComposerVoiceBeam({ on, children, ...rest }: React.ComponentProps<typeof VoiceBeam> & { on: boolean }) {
  if (!on) return <div style={{ width: '100%' }}>{children}</div>
  return <VoiceBeam {...rest} style={{ width: '100%' }}>{children}</VoiceBeam>
}

/** The chip icon for an attached reference — local boxes and connected accounts. */
function refIcon(box: ContextRef['box']) {
  const size = 10
  if (box.startsWith('int:')) {
    const id = box.slice(4)
    if (id === 'gmail') return <Mail size={size} />
    if (id === 'gcal') return <CalendarDays size={size} />
    if (id === 'github') return <Github size={size} />
    if (id === 'notion') return <StickyNote size={size} />
    if (id === 'slack') return <Hash size={size} />
    if (id === 'drive') return <HardDrive size={size} />
    return <FolderOpen size={size} />
  }
  if (box === 'files') return <FolderOpen size={size} />
  if (box === 'drive') return <HardDrive size={size} />
  if (box === 'mail') return <Mail size={size} />
  return <CalendarDays size={size} />
}

type EffortStep = { id: string; label: string; hint: string }

/**
 * Effort in each provider's own vocabulary. Claude's five levels come from its
 * effort doc; ChatGPT's are the ladder people know (Instant is minimal
 * reasoning, Max is Ultra). Both store the same ids; the backend maps them onto
 * the wire value for each dialect.
 */
const EFFORT_SETS: Record<string, EffortStep[]> = {
  anthropic: [
    { id: 'low', label: 'Low', hint: 'fastest, least thinking' },
    { id: 'medium', label: 'Medium', hint: 'default on Opus 5.5 and Haiku 5.5' },
    { id: 'high', label: 'High', hint: 'default on most Claude models' },
    { id: 'xhigh', label: 'xHigh', hint: 'long agentic and coding work' },
    { id: 'max', label: 'Max', hint: 'no limit on thinking or output' },
  ],
  openai: [
    { id: 'instant', label: 'Instant', hint: 'answers now, minimal reasoning' },
    { id: 'low', label: 'Low', hint: 'light reasoning' },
    { id: 'medium', label: 'Medium', hint: 'the daily default' },
    { id: 'high', label: 'High', hint: 'reasons before answering' },
    { id: 'xhigh', label: 'xHigh', hint: 'the deepest reasoning the model offers' },
    { id: 'max', label: 'Max', hint: 'Ultra: the most the model will spend' },
  ],
}

/** Effort pill: follows the provider of the default model. */
function EffortPill() {
  const effort = useStore((s) => s.settings.effort ?? 'medium')
  const provider = useStore((s) => (s.settings.defaultModel ?? '').split(':')[0])
  const steps = EFFORT_SETS[provider] ?? EFFORT_SETS.openai
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const current = steps.find((e) => e.id === effort) ?? steps.find((e) => e.id === 'medium') ?? steps[0]
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-1 p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors text-[10.5px]"
        style={{ color: current.id === 'medium' ? 'var(--text-3)' : 'var(--primary)' }}
        aria-label="Effort" aria-expanded={open}
        title="Effort: how hard the model thinks before it answers">
        <Gauge size={15} strokeWidth={1.5} />
        <span>{current.label}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 rounded-2xl p-4 z-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px rgb(0 0 0 / .25)' }}>
          <EffortSlider steps={steps} value={current.id}
            onChange={(id) => useStore.setState((s) => ({ settings: { ...s.settings, effort: id } }))} />
        </div>
      )}
    </div>
  )
}

export function InputBar({ onSend, mathMode, setMathMode, streaming, onStop, emptyHistory, chatId, autoFocus = true, big = false }: Props) {
  const [text, setText] = useState('')
  // The task panel (and anything else) can seed the composer: the seed is
  // consumed once, so editing afterwards is never overwritten.
  const seed = useUI((s) => s.composerSeed)
  // Dictation appends to whatever is already typed, so you can talk mid-draft
  // instead of choosing between the keyboard and the mic.
  const appendDictation = useCallback((spoken: string) => {
    setText((cur) => {
      const base = cur.trim()
      return base ? `${base} ${spoken}` : spoken
    })
    requestAnimationFrame(() => taRef.current?.focus())
  }, [])
  const dictation = useDictation(appendDictation)
  const [search, setSearch] = useState(false)
  const [quality, setQuality] = useState(false)
  const [replicate, setReplicate] = useState(false)
  const [picker, setPicker] = useState<'skill' | 'source' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  // Where the open trigger word sits in the text, so a pick replaces only that word.
  const [pickerAt, setPickerAt] = useState({ start: 0, end: 0 })
  const [sent, setSent] = useState(false)
  const [imgs, setImgs] = useState<{ name: string; dataUrl: string }[]>([])
  const [refs, setRefs] = useState<ContextRef[]>([])
  const [connOpen, setConnOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const plugRef = useRef<HTMLButtonElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const glassMode = useStore((s) => s.settings.glassMode)
  const flowEnabled = useStore((s) => s.settings.flowEnabled)
  // Border Beam by Jakubantalik rings the home composer. It lives on the
  // wrapper rather than around the shell so that popovers (skills, sources)
  // can still escape the composer box.
  const beamOn = useStore((s) => s.settings.composerBeam !== false)
  const beamVariant = useStore((s) => s.settings.composerBeamVariant ?? 'ocean')
  // Voice by Jakub Antalik (voice-glow) paints the sound-reactive glow along the
  // composer's bottom edge while the microphone is open. It only mounts while
  // listening — an idle beam is decoration, a live one is feedback.
  const voiceOn = useStore((s) => s.settings.voice?.enabled !== false)
  const voiceVariant = useStore((s) => s.settings.voice?.beamVariant ?? 'colorful')
  const voiceBeamOn = useStore((s) => s.settings.voice?.beam !== false)
  const voicePushToTalk = useStore((s) => s.settings.voice?.pushToTalk === true)
  const theme = useStore((s) => s.settings.theme)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const [focused, setFocused] = useState(false)
  // Actions only — see the note in components/chat/Message.tsx: subscribing
  // the composer to the entire UI store made every toast re-render it.
  const ui = useUI.getState
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
  useEffect(() => {
    if (!seed) return
    setText((cur) => (cur.trim() ? `${cur.trim()}\n\n${seed}` : seed))
    useUI.setState({ composerSeed: null })
  }, [seed])

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
    const caret = taRef.current?.selectionStart ?? v.length
    const t = triggerAt(v, caret)
    if (!t) { setPicker(null); return }
    setPicker(t.kind)
    setPickerQuery(t.query)
    setPickerAt({ start: t.start, end: t.end })
  }

  const doSend = (opts: { search?: boolean; quality?: boolean; replicate?: boolean } = {}) => {
    const raw = text.trim()
    // No streaming guard here: ChatView decides — while streaming, prompts
    // are queued and run automatically when the current answer finishes.
    if (!raw) return

    // ---- Easter eggs (strict rules) ----
    if (raw === '-404') { ui().set({ notFound: true }); setText(''); return }
    if (raw === '/konami') {
      const on = !useUI.getState().starfield
      ui().set({ starfield: on })
      ui().toast(on ? 'Konami accepted' : 'Star field dismissed', on ? 'Star field active for this session. Type /konami again to dismiss.' : 'Back to solid ground.')
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
    if (imgs.length >= 3) { ui().toast('Attachment limit', 'Up to 3 images per message.', 'warning'); return }
    if (file.size > 4 * 1024 * 1024) { ui().toast('Image too large', 'Images are capped at 4 MB.', 'warning'); return }
    const r = new FileReader()
    r.onload = () => setImgs((cur) => [...cur, { name: file.name, dataUrl: String(r.result) }])
    r.readAsDataURL(file)
  }

  const pills: ModeOption[] = [
    {
      id: 'flow', label: 'Flow', icon: Wind, active: flowEnabled,
      desc: 'AIFlowEngine keeps the context tight — cheaper, faster long chats.',
      toggle: () => useStore.setState((s) => ({ settings: { ...s.settings, flowEnabled: !s.settings.flowEnabled } })),
      title: 'AIFlowEngine — token-efficient context',
    },
    {
      id: 'search', label: 'Search', icon: Globe, active: search,
      desc: 'Live web results with citations (Cmd/Ctrl+Enter).',
      toggle: () => setSearch(!search),
      title: 'Web search with citations (Cmd/Ctrl+Enter)',
    },
    {
      id: 'quality', label: 'Quality', icon: Sparkles, active: quality,
      desc: 'Longer, structured, thoroughly cited answers. Turns search on.',
      toggle: () => { setQuality(!quality); if (!quality) setSearch(true) },
      title: 'Longer, thoroughly cited, structured answers',
    },
    {
      id: 'math', label: 'Math', icon: Sigma, active: mathMode, tone: 'warning' as const,
      desc: 'Step-by-step LaTeX, shown one line at a time (Cmd/Ctrl+M).',
      toggle: () => setMathMode(!mathMode),
      title: 'Step-by-step LaTeX (Cmd/Ctrl+M)',
    },
    {
      id: 'replicate', label: 'Replicate', icon: Hammer, active: replicate,
      desc: 'New Tech — a staged replication plan for a paper.',
      toggle: () => setReplicate(!replicate),
      title: 'New Tech — staged replication research plan',
    },
  ]

  const beam = big && beamOn && !reduceMotion

  return (
    // `data-ui` is the anchor Settings → Developer → UI lab uses to flash this
    // component in place (see components/settings/UILab.tsx).
    <div data-ui="composer" className={clsx('shrink-0 px-3 pb-3 pt-1', big && 'pb-6')}>
      <div className={clsx('mx-auto', big ? 'max-w-[720px]' : 'max-w-[760px]')}>
        <div className="relative" data-skin-composer>
        {beam && (
          <BorderBeam
            size="md"
            colorVariant={beamVariant}
            theme={themeKind(theme)}
            borderRadius={big ? 22 : 18}
            duration={focused ? 3.4 : 5.2}
            brightness={focused ? 1.45 : 1.2}
            saturation={1.25}
            strength={focused ? 0.85 : 0.6}
            hueRange={26}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'visible' }}
          >
            <span style={{ display: 'block', width: '100%', height: '100%' }} />
          </BorderBeam>
        )}
        <ComposerVoiceBeam
          on={voiceBeamOn}
          theme={themeKind(theme)}
          colorVariant={voiceVariant}
          stream={dictation.stream}
        >
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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={big ? 'What would you like to research today?' : 'Ask, or type / for skills, @ for sources…'}
              className="chat-input re-smooth-caret w-full bg-transparent outline-none resize-none px-4 pt-3.5 pb-1 text-[14px] leading-relaxed"
              style={{ minHeight: big ? 56 : 44 }}
              aria-label="Message input"
            />

            <AnimatePresence>
              {picker === 'skill' && (
                <SkillPicker
                  query={pickerQuery}
                  onPick={(skill) => { setText((t) => replaceTrigger(t, pickerAt, '')); setPicker(null); useUI.setState({ skillRun: { skillId: skill.id } }) }}
                  onClose={() => setPicker(null)}
                />
              )}
              {picker === 'source' && (
                <IntegrationPicker
                  query={pickerQuery}
                  onPick={(label) => { setText((t) => replaceTrigger(t, pickerAt, `@${label} `)); setPicker(null) }}
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
                  {refIcon(r.box)}
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
              <button ref={modeButtonRef} onClick={() => setModeOpen((v) => !v)} title={modeOpen ? 'Fold the modes' : 'Choose a mode'} aria-label="Choose a mode" aria-expanded={modeOpen}
                className="flex items-center justify-center w-9 h-8 rounded-full transition-colors hover:bg-[var(--elevated)]"
                style={{ color: pills.some((p) => p.active) || modeOpen ? 'var(--primary)' : 'var(--text-3)', background: modeOpen ? 'var(--elevated)' : 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <SlidersHorizontal size={15} strokeWidth={1.7} />
              </button>
            </div>
            {/* The modes expand sideways instead of opening a menu — each pill
                carries a tooltip, presses toggle and stay open. */}
            {modeOpen && <ModeStrip pills={pills} />}
            {!modeOpen && (
              <span className="hidden sm:inline text-[11px]" style={{ color: 'var(--text-3)' }}>{pills.filter((p) => p.active).map((p) => p.label).join(' · ') || 'Mode'}</span>
            )}

            <div className="flex-1" />

            {/* Dictation — Voice Pill (React Bits Micro) driving the microphone.
                Hold to talk by default; a click toggles when push-to-talk is
                off in Settings → Voice. Slide left to cancel while recording. */}
            {voiceOn && (
              <VoicePill
                mode={voicePushToTalk ? 'hold' : 'toggle'}
                size={30}
                shape="pill"
                showTime={false}
                accentColor="var(--primary)"
                iconColor="var(--text-2)"
                background="var(--elevated)"
                ariaLabel={dictation.state === 'recording' ? 'Stop dictation' : 'Dictate'}
                disabled={dictation.state === 'transcribing' || dictation.state === 'starting' || !!streaming}
                onStart={() => { void dictation.start() }}
                onStop={(info) => {
                  const abandon = info.reason === 'escape' || info.reason === 'cancel' || info.reason === 'blur'
                  if (abandon) dictation.cancel()
                  else if (info.reason !== 'mic-denied' && info.reason !== 'disabled') dictation.stop()
                }}
              />
            )}
            {(dictation.state === 'recording' || dictation.state === 'transcribing') && (
              <span className="hidden sm:inline text-[10.5px] tabular-nums" style={{ color: 'var(--primary)' }}>
                {dictation.state === 'transcribing' ? 'Transcribing…' : 'Listening'}
              </span>
            )}

            <EffortPill />

            <button className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors" style={{ color: 'var(--text-3)' }} aria-label="Attach document"
              onClick={() => { navigate('/quiz'); ui().toast('Learn', 'Drop a PDF, DOCX, TXT or Markdown file to study it.') }}>
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

            {/* Connected data: local files, Drive, Gmail, Calendar, GitHub,
                Notion, Slack — search it, read it in, or connect an account. */}
            <div className="relative">
              <button ref={plugRef}
                className="p-1.5 rounded-full hover:bg-[var(--elevated)] transition-colors"
                style={{ color: refs.length || connOpen ? 'var(--primary)' : 'var(--text-3)' }}
                aria-label="Connected data" aria-expanded={connOpen}
                title="Connected data — search your accounts, or connect one"
                onClick={() => setConnOpen((o) => !o)}>
                <Plug size={15} strokeWidth={1.5} />
              </button>
              {connOpen && (
                <IntegrationsMenu
                  anchor={plugRef.current}
                  onPick={(pick) => setRefs((cur) => [...cur, { box: `int:${pick.integration}` as ContextRef['box'], id: pick.id, title: pick.title }])}
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
        </ComposerVoiceBeam>
        </div>
        <div className="text-center text-[10.5px] mt-2" style={{ color: 'var(--text-3)' }}>
          Responses run on your configured models. Without keys, a local demo model answers.
        </div>
      </div>
    </div>
  )
}
