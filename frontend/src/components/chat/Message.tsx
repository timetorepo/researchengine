import React, { memo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Copy, Check, RefreshCw, Pencil, GitBranch, Bookmark, Wand2, Info, Lightbulb, AlertTriangle, ArrowRight, Sparkles, Feather, Loader2, Gauge, Scissors, BrainCircuit,
} from 'lucide-react'
import type { ChatMessage } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

/** 1234 → 1.2k. Token counts are for orientation, not accounting. */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 100000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n / 1000)}k`
}
import { Markdown } from './Markdown'
import { ReplicateTimeline } from './ReplicateTimeline'
import { ToolTraceChips, ExecApproval, QuestionnaireCard, AttachmentStrip, CodingModeCard } from './ToolUI'
import { TooltipCardStrip } from '@/components/ui/aceternity/TooltipCard'
import { AlphaChip, handOffToAlpha } from '@/components/alpha/RemoverAlpha'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { SourceStrip } from './SourceStrip'
import { HumanizedAnswer, HumanizingIndicator, HumanizeError } from './HumanizedAnswer'
import { humanizeText } from '@/lib/chat/humanize'
import { nanoid } from 'nanoid'
import { ThinkingOrb } from 'thinking-orbs'
import { themeKind } from '@/lib/themes/meta'
// SmoothUI — the message frame (avatar, bubble, timestamp, copy / vote / retry
// actions that fade in from the side the bubble is anchored to).
import AIMessage from '@/components/smoothui/ai-message'
import { ForkPanel, CapsuleCard } from '@/components/chat/ForkPanel'
import AIDiff from '@/components/smoothui/ai-diff'
import AIReasoning from '@/components/smoothui/ai-reasoning'
import { timeAgo } from '@/lib/utils'
import { bubbleShape, runGap, DEFAULT_BUBBLES, type BubblePrefs } from '@/lib/chat/bubbles'
import { diffLines } from '@/lib/text/diff'

interface Props {
  chatId: string
  msg: ChatMessage
  streaming: boolean
  onRegenerate: (msg: ChatMessage) => void
  /** Where this message sits in a run from one author. Drives tail and spacing. */
  position?: 'solo' | 'first' | 'middle' | 'last'
}

/**
 * Chain of thought: the reasoning a provider chose to expose, kept verbatim
 * and collapsed. While the model is still thinking and no answer text has
 * landed yet, the block breathes so the wait reads as thinking, not hanging.
 */
type SectionAction = { kind: 'quiz' | 'coding' | 'read' | 'chats'; target?: string }
const SECTION_RE = /\[RE:open:(quiz|coding|read|chats)(?:\|([^\]]+))?\]/g
const sectionActions = (content: string): SectionAction[] => {
  const out: SectionAction[] = []
  for (const m of content.matchAll(SECTION_RE)) {
    out.push({ kind: m[1] as SectionAction['kind'], target: m[2]?.trim() })
    if (out.length >= 2) break
  }
  return out
}
const stripMarkers = (content: string) => content.replace(SECTION_RE, '').replace(/\n{3,}/g, '\n\n').trim()
function runSectionAction(a: SectionAction) {
  const nav = (to: string) => window.dispatchEvent(new CustomEvent('re-navigate', { detail: to }))
  if (a.kind === 'quiz') nav('/quiz')
  else if (a.kind === 'coding') nav('/code')
  else if (a.kind === 'chats') nav('/chats')
  else if (a.kind === 'read' && a.target) nav(`/library?url=${encodeURIComponent(a.target)}`)
}

function ThinkingBlock({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false)
  if (!text && !live) return null
  return (
    <div className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
        <BrainCircuit size={12} className={live && !text ? 'animate-pulse' : ''} />
        <span>{live && !text ? 'Thinking' : open ? 'Chain of thought' : 'Chain of thought'}</span>
        {text ? <span className="ml-auto text-[10px] opacity-70">{open ? 'hide' : `${Math.max(1, Math.round(text.length / 4))} tok`}</span> : null}
      </button>
      {(open || (live && !text)) && text && (
        <div className="px-2.5 pb-2 text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-auto" style={{ color: 'var(--text-3)' }}>{text}</div>
      )}
    </div>
  )
}

export const Message = memo(function Message({ chatId, msg, streaming, onRegenerate, position = 'solo' }: Props) {
  const navigate = useNavigate()
  /**
   * Deliberately *not* a subscription. Every use of `ui` here is an imperative
   * action (a toast, opening a panel), and subscribing to the whole UI store
   * meant every toast, queue change and overlay flag re-rendered every message
   * in the transcript — which is most of the cost of a long chat. Each message
   * now re-renders only for its own props, and the streaming one for its
   * tokens.
   */
  const ui = useUI.getState
  const [copied, setCopied] = useState(false)
  // Bubble shape comes from Settings, so a person can make a chat read the way
  // they want. `solo` is the default when a caller does not say, which keeps the
  // component usable outside the transcript.
  const prefs = useStore((s) => s.settings.bubbles ?? DEFAULT_BUBBLES)
  const themed = prefs.style !== 'classic'
  const shape = bubbleShape({
    prefs,
    from: msg.role === 'user' ? 'user' : 'assistant',
    position,
    themeFill: msg.role === 'user' ? 'var(--text)' : 'var(--elevated)',
  })
  const gap = runGap(prefs, position)
  /**
   * An assistant turn that is only prose. The moment it carries reasoning,
   * tools, stages, a capsule, sources or an error it owns its own surfaces, and
   * wrapping those in a chat bubble is a box inside a box. iMessage's shape is
   * for text, so that is what it gets.
   */
  const plainAssistant = themed && msg.role === 'assistant'
    && !msg.thinking && !(msg.toolTrace?.length) && !(msg.stages?.length)
    && !msg.capsule && !msg.error && !(msg.sources?.length)
    && !(msg.agentAttribution?.length) && !(msg.attachments?.length)
    && !msg.questionnaire
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [showInfo, setShowInfo] = useState(false)
  /** An edit is being reviewed as a diff before it is written back. */
  const [reviewing, setReviewing] = useState(false)
  const [hoverSource, setHoverSource] = useState<string | null>(null)
  const humanizeAbort = useRef<AbortController | null>(null)
  const store = useStore
  const theme = useStore((st) => st.settings.theme)
  const reduceMotion = useStore((st) => st.settings.reduceMotion)
  const contextExhausted = !!msg.error && /(context|token|maximum|limit|length).{0,24}(window|capacity|exceed|long|limit|token)|too many tokens/i.test(msg.error)
  /**
   * Forking is a panel now, not a 420-character-per-turn truncation: it shows
   * what the compression keeps and what it saves before anything is created
   * (components/chat/ForkPanel.tsx).
   */
  const [forkOpen, setForkOpen] = useState(false)

  /** Humanize is a Chat affordance — never offered inside Coding mode. */
  const chatTitle = store((s) => s.chats.find((c) => c.id === chatId)?.title ?? '')
  const humanizeAllowed = !/^Coding ·/.test(chatTitle)

  const runHumanize = async () => {
    if (msg.humanizing) { humanizeAbort.current?.abort(); store.getState().updateMessage(chatId, msg.id, { humanizing: false }); return }
    const ctrl = new AbortController()
    humanizeAbort.current = ctrl
    store.getState().updateMessage(chatId, msg.id, { humanizing: true, humanizeError: undefined })
    try {
      const res = await humanizeText({
        text: msg.content,
        signal: ctrl.signal,
        // Stream into the message so long answers appear as they are rewritten.
        onChunk: (soFar) => store.getState().updateMessage(chatId, msg.id, { humanized: soFar }),
      })
      store.getState().updateMessage(chatId, msg.id, { humanized: res.text, humanizedBy: res.by, humanizing: false })
      // A rewrite that is dramatically shorter than the original usually means
      // the model ran into its output limit — say so instead of quietly losing
      // half an answer.
      const clipped = msg.content.length > 800 && res.text.length < msg.content.length * 0.55
      ui().toast(
        clipped ? 'Humanized — check the length' : res.local ? 'Humanized on device' : 'Humanized',
        clipped
          ? 'The rewrite is much shorter than the original: the model may have been cut off. Press Humanize again for another pass.'
          : res.local
            ? 'No provider key is set, so the on-device pass rewrote it.'
            : `Rewritten by ${res.by}. Hover the green text for the previous response.`,
        clipped ? 'warning' : 'success',
      )
    } catch (e: any) {
      if (e?.name === 'AbortError') { store.getState().updateMessage(chatId, msg.id, { humanizing: false }); return }
      store.getState().updateMessage(chatId, msg.id, {
        humanizing: false,
        humanizeError: String(e?.message ?? e).slice(0, 200),
      })
    } finally {
      humanizeAbort.current = null
    }
  }

  if (msg.role === 'user') {
    return (
      <div className="msg-row group" style={{ borderTop: '1px solid var(--surface-border)', marginBlock: gap }}>
        <div className="max-w-[760px] mx-auto px-4">
          {editing ? (reviewing ? (
            // Reviewing your own edit as a diff: what is about to be removed,
            // what is about to replace it, and one place to decide.
            <AIDiff
              title="Review your edit"
              lines={diffLines(msg.content, draft)}
              onAccept={() => { store.getState().updateMessage(chatId, msg.id, { content: draft }); setEditing(false); setReviewing(false) }}
              onReject={() => setReviewing(false)}
            />
          ) : (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full p-3 rounded-[14px] outline-none text-[14px] resize-y"
                style={{ background: 'var(--surface)', border: '1px solid var(--primary)' }}
                rows={Math.min(10, draft.split('\n').length + 1)}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}
                  title="See what changed before it is saved"
                  onClick={() => { if (draft === msg.content) { setEditing(false); return } setReviewing(true) }}>
                  Review
                </button>
                <button className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                  onClick={() => { setDraft(msg.content); setEditing(false); setReviewing(false) }}>Cancel</button>
              </div>
            </div>
          )) : (
            <>
              <AttachmentStrip msg={msg} />
              <div className="flex" style={shape.rowStyle}>
                <AIMessage
                  bubble={!themed}
                  className="items-end"
                  contentClassName={themed ? 'w-full max-w-none' : undefined}
                  copyText={msg.content}
                  from="user"
                  timestamp={timeAgo(msg.createdAt)}
                  bubbleStyle={themed ? shape.style : undefined}
                >
                  <div className="whitespace-pre-wrap" style={themed ? { fontSize: 'inherit', lineHeight: 'inherit' } : { fontSize: '14.5px' }}>{msg.content}</div>
                </AIMessage>
              </div>
            </>
          )}
          <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
            <HoverBtn label="Edit" onClick={() => { setDraft(msg.content); setEditing(true) }}><Pencil size={13} /></HoverBtn>
            <HoverBtn label="Build skill" onClick={() => ui().set({ skillBuilderOpen: msg.content })}><Wand2 size={13} /></HoverBtn>
          </div>
        </div>
      </div>
    )
  }

  const f = msg.flow
  const usage = msg.usage
  /**
   * How long the answer actually took: the wall clock between the prompt and
   * this message. The only duration worth printing — a timer that starts when
   * a panel opens would be measuring the wrong thing.
   */
  const answerSeconds = (() => {
    const chat = store.getState().chats.find((c) => c.id === chatId)
    const i = chat?.messages.findIndex((m) => m.id === msg.id) ?? -1
    if (!chat || i <= 0) return undefined
    for (let j = i - 1; j >= 0; j--) {
      if (chat.messages[j].role === 'user') {
        const s = (msg.createdAt - chat.messages[j].createdAt) / 1000
        return s > 0 && s < 24 * 3600 ? s : undefined
      }
    }
    return undefined
  })()
  const showTokenUsage = useStore((st) => st.settings.showTokenUsage !== false)
  const Row: any = streaming ? motion.div : 'div'
  return (
    <Row
      {...(streaming ? {
        layout: true,
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { layout: { type: 'spring', damping: 26, stiffness: 320 }, opacity: { duration: 0.2 }, y: { duration: 0.2 } },
      } : {})}
      className={`msg-row group ${streaming ? 'msg-streaming' : 'msg-settle'}`} style={{ marginBlock: gap }}>
      {/* The fork panel lives with the message that opened it; HeroUI's Modal
          renders nothing until it is open, so an idle chat carries no extra
          DOM. */}
      <ForkPanel chatId={chatId} exhausted={contextExhausted} open={forkOpen} onClose={() => setForkOpen(false)} />
      <div className="max-w-[760px] mx-auto px-4">
        <AIMessage
          avatar={prefs.avatars ? (
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
                <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
              </svg>
            </span>
          ) : undefined}
          bubble={plainAssistant}
          className="items-start"
          contentClassName={plainAssistant ? undefined : 'w-full max-w-none'}
          bubbleStyle={plainAssistant ? shape.style : undefined}
          copyText={msg.content}
          from="assistant"
          onRetry={() => onRegenerate(msg)}
          timestamp={timeAgo(msg.createdAt)}
        >
        {/* Model attribution */}
        <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          {streaming && msg.content !== '' && (
            <motion.span layoutId="re-flow-orb" className="inline-flex">
              {/* ThinkingOrb (Jakubantalik) marks the text as still arriving. */}
              <ThinkingOrb state="composing" size={20} theme={themeKind(theme)} paused={reduceMotion} />
            </motion.span>
          )}
          <ProviderLogo id={msg.provider?.toLowerCase() ?? ''} size={12} />
          <span className="font-mono">{msg.model}</span>
          {msg.agentAttribution && msg.agentAttribution.length > 0 && (
            <span className="flex items-center gap-1 ml-1">
              {msg.agentAttribution.map((a) => (
                <span key={a.name} className="px-1.5 py-0.5 rounded-full text-[9.5px]" style={{ background: `${a.color}22`, color: a.color }}>{a.name}</span>
              ))}
            </span>
          )}
          {f && f.savedPct > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--primary)' }}>
              Flow mode — {f.savedPct}% fewer tokens used
            </span>
          )}
        </div>

        {(msg.thinking || (streaming && !msg.content)) && (
          <ThinkingBlock text={msg.thinking ?? ''} live={!!streaming} />
        )}

        {sectionActions(msg.content).map((a, i) => (
          <button key={i} onClick={() => runSectionAction(a)}
            className="mb-2 mr-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
            {a.kind === 'quiz' ? 'Open Read & Quiz' : a.kind === 'coding' ? 'Open Coding' : a.kind === 'chats' ? 'Open Sessions' : `Read ${a.target ? new URL(a.target, 'http://x').host : ''}`}
          </button>
        ))}

        {/* Sources strip */}
        {msg.sources && msg.sources.length > 0 && (
          <SourceStrip sources={msg.sources} hoverId={hoverSource} onHover={setHoverSource}
            onDelete={(id) => useStore.setState((s) => ({ citations: s.citations.filter((c) => c.id !== id) }))} />
        )}

        {msg.error ? (
          <div className="flex items-start gap-2.5 p-3.5 rounded-[14px] text-[13px]"
            style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', color: 'var(--text)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-0.5">The provider returned an error</div>
              <div style={{ color: 'var(--text-2)' }}>{msg.error}</div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => onRegenerate(msg)}
                  className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}>
                  Retry
                </button>
                {contextExhausted && <button onClick={() => setForkOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
                  <Sparkles size={12} /> Simplify &amp; fork
                </button>}
                <button
                  onClick={() => ui().set({ settingsSheet: true, settingsTab: 'providers' })}
                  className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--danger)', color: '#fff' }}
                >Fix in Settings</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {msg.stages && msg.stages.length > 0 && <ReplicateTimeline chatId={chatId} msg={msg} />}
            <ToolTraceChips msg={msg} streaming={streaming} />
            <CodingModeCard project={msg.promotedTo?.project} reason={msg.promotedTo?.reason} />
            <ExecApproval chatId={chatId} msg={msg} />
            <QuestionnaireCard chatId={chatId} msg={msg} />
            {/* Cards the model summoned with the `show_tooltip_card` tool.
                Deliberately tool-driven: no tool call, no card. */}
            {msg.tooltipCards?.length ? <TooltipCardStrip cards={msg.tooltipCards} /> : null}
            {msg.humanizing && !msg.humanized && <HumanizingIndicator onCancel={() => void runHumanize()} />}
            {msg.capsule ? (
              <CapsuleCard msg={msg} />
            ) : msg.humanized ? (
              <HumanizedAnswer
                msg={msg}
                onRestore={() => store.getState().updateMessage(chatId, msg.id, { humanized: undefined, humanizedBy: undefined, humanizeError: undefined })}
              />
            ) : (
              !msg.humanizing && <Markdown content={stripMarkers(msg.content)} streaming={streaming} />
            )}
            {msg.humanizeError && <HumanizeError message={msg.humanizeError} onRetry={() => void runHumanize()} />}
          </>
        )}

        {/* Citation chips — bidirectional highlight with source strip */}
        {msg.sources && msg.sources.length > 0 && !streaming && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {msg.sources.map((s, i) => (
              <button
                key={s.id}
                onMouseEnter={() => setHoverSource(s.id)}
                onMouseLeave={() => setHoverSource(null)}
                onClick={() => window.open(s.url, '_blank')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] transition-transform hover:scale-105"
                style={{
                  background: hoverSource === s.id ? 'color-mix(in srgb, var(--primary) 22%, transparent)' : 'var(--elevated)',
                  color: hoverSource === s.id ? 'var(--primary)' : 'var(--text-2)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <span className="w-3 h-3 rounded-full text-[8px] flex items-center justify-center font-semibold"
                  style={{ background: `hsl(${s.faviconHue} 60% 45%)`, color: '#fff' }}>{i + 1}</span>
                {s.domain}
              </button>
            ))}
          </div>
        )}

        {/* Humanize — always visible, because a hidden button is not a feature.
            Chat only: the IDE has its own agent surface, and Chat messages that
            belong to a Coding project (title "Coding · …") are excluded too. */}
        {!streaming && msg.content && !msg.error && humanizeAllowed && !msg.humanized && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button
              onClick={() => void runHumanize()}
              disabled={msg.humanizing}
              title="Rewrite this answer so it reads like a person wrote it — the original stays one hover away"
              aria-label="Humanize this answer"
              className="humanize-action"
            >
              {msg.humanizing
                ? <><Loader2 size={12} className="animate-spin" /> Humanizing…</>
                : <><Feather size={12} /> Humanize</>}
            </button>
            <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
              {msg.humanizing ? 'rewriting it now' : 'rewrites it in plain, human prose'}
            </span>
          </div>
        )}

        {/* Hover actions */}
        {!streaming && msg.content && (
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <HoverBtn label="Copy" onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </HoverBtn>
            <HoverBtn label="Regenerate" onClick={() => onRegenerate(msg)}><RefreshCw size={13} /></HoverBtn>
            <HoverBtn label="Fork with a compressed prompt" onClick={() => setForkOpen(true)}><Scissors size={13} /></HoverBtn>
            <HoverBtn label="Branch into new chat" onClick={() => {
              const chat = store.getState().chats.find((c) => c.id === chatId)!
              const idx = chat.messages.findIndex((m) => m.id === msg.id)
              const branch = {
                id: nanoid(10),
                title: `Branch — ${chat.title}`.slice(0, 60),
                createdAt: Date.now(), updatedAt: Date.now(),
                parentId: chatId, branchMessageId: msg.id,
                messages: chat.messages.slice(0, idx + 1).map((m) => ({ ...m, id: nanoid(8) })),
              }
              useStore.setState((s) => ({ chats: [branch, ...s.chats] }))
              navigate(`/chat/${branch.id}`)
              ui().toast('Branched', 'This response now lives in its own research thread.')
            }}><GitBranch size={13} /></HoverBtn>
            {/* removerAlpha: hand this answer's own text to the local pass. It
                only appears when the pass actually found something, so it is a
                result rather than a decoration. */}
            <AlphaChip
              text={msg.humanized ?? msg.content}
              onOpen={() => handOffToAlpha(msg.humanized ?? msg.content)}
            />
            <HoverBtn label="Bookmark" onClick={() => store.getState().updateMessage(chatId, msg.id, { bookmarked: !msg.bookmarked })}>
              <Bookmark size={13} fill={msg.bookmarked ? 'currentColor' : 'none'} />
            </HoverBtn>
            <HoverBtn label="Build skill" onClick={() => ui().set({ skillBuilderOpen: msg.content })}><Wand2 size={13} /></HoverBtn>
            <HoverBtn label="Extract insight" onClick={() => {
              const firstLine = msg.content.split('\n').find((l) => l.trim().length > 12)?.replace(/[#*>`]/g, '').trim() ?? 'Insight'
              useStore.setState((s) => ({
                knowledge: [{
                  id: nanoid(8), title: firstLine.slice(0, 70), insight: msg.content.slice(0, 280),
                  source: `${msg.model} · ${new Date(msg.createdAt).toLocaleDateString()}`,
                  tags: ['extracted'], confidence: 'medium', createdAt: Date.now(),
                }, ...s.knowledge],
              }))
              ui().toast('Knowledge card saved', 'Find it in Library → Knowledge.')
            }}><Lightbulb size={13} /></HoverBtn>
            {f && <HoverBtn label="Transparency info" onClick={() => setShowInfo((v) => !v)}><Info size={13} /></HoverBtn>}
            {/* What this answer cost. Providers that report counts are quoted
                exactly; estimates are marked with ≈ so the two never blur. */}
            {usage && usage.total > 0 && showTokenUsage && (
              <span
                className="ml-1 inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10.5px] font-mono cursor-default"
                style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}
                title={`${usage.reported ? 'Reported by the provider' : 'Estimated from the text (this provider does not report usage)'}: ${usage.prompt} in · ${usage.completion} out`}
              >
                <Gauge size={11} />
                {usage.reported ? '' : '≈'}{formatTokens(usage.total)} tokens
              </span>
            )}
          </div>
        )}

        {/* How this answer was made — SmoothUI's AIReasoning disclosure, with
            the real numbers inside it. */}
        {showInfo && f && (
          <AIReasoning className="mt-2.5" collapseWhenDone={false} defaultOpen duration={answerSeconds}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[12px]">
              <Stat label="Original context" value={`${f.originalTokens} tok`} />
              <Stat label="Pruned context" value={`${f.prunedTokens} tok`} />
              <Stat label="Prompt sent" value={`${f.promptTokens} tok`} />
              <Stat label="Completion" value={`${f.completionTokens} tok`} />
              <Stat label="Est. cost saved" value={`$${f.costSaved.toFixed(4)}`} accent />
            </div>
          </AIReasoning>
        )}

        {/* Continue from here — shown when a stream was stopped early */}
        {!streaming && msg.stopped && !msg.error && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('re:send-prompt', { detail: 'Continue exactly where you stopped. Do not repeat what you already wrote.' }))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all hover:scale-[1.02]"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              Continue from here <ArrowRight size={11} />
            </button>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>stream stopped early</span>
          </div>
        )}

        {/* Follow-ups */}
        {!streaming && msg.followUps && msg.followUps.length > 0 && !msg.error && !msg.stopped && (
          <div className="flex flex-wrap gap-2 mt-3">
            {msg.followUps.map((sug) => (
              <button
                key={sug}
                onClick={() => window.dispatchEvent(new CustomEvent('re:send-prompt', { detail: sug }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all hover:scale-[1.02]"
                style={{ border: '1px solid var(--surface-border)', color: 'var(--text-2)', background: 'var(--surface)' }}
              >
                {sug} <ArrowRight size={11} style={{ color: 'var(--text-3)' }} />
              </button>
            ))}
          </div>
        )}
        </AIMessage>
      </div>
    </Row>
  )
})

function HoverBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label} title={label} onClick={onClick}
      className="p-1.5 rounded-[8px] transition-colors hover:bg-[var(--elevated)]"
      style={{ color: 'var(--text-3)' }}
    >
      {children}
    </button>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="font-mono text-[12.5px]" style={{ color: accent ? 'var(--success)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}
