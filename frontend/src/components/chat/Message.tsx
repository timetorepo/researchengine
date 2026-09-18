import React, { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Copy, Check, RefreshCw, Pencil, GitBranch, Bookmark, Wand2, Info, Lightbulb, AlertTriangle, ArrowRight,
} from 'lucide-react'
import type { ChatMessage } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Markdown } from './Markdown'
import { ReplicateTimeline } from './ReplicateTimeline'
import { ToolTraceChips, ExecApproval, QuestionnaireCard, AttachmentStrip } from './ToolUI'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { SourceStrip } from './SourceStrip'
import { nanoid } from 'nanoid'

interface Props {
  chatId: string
  msg: ChatMessage
  streaming: boolean
  onRegenerate: (msg: ChatMessage) => void
}

export const Message = memo(function Message({ chatId, msg, streaming, onRegenerate }: Props) {
  const navigate = useNavigate()
  const ui = useUI()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [showInfo, setShowInfo] = useState(false)
  const [hoverSource, setHoverSource] = useState<string | null>(null)
  const store = useStore

  if (msg.role === 'user') {
    return (
      <div className="msg-row group py-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
        <div className="max-w-[760px] mx-auto px-4">
          {editing ? (
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
                  onClick={() => { store.getState().updateMessage(chatId, msg.id, { content: draft }); setEditing(false) }}>
                  Save
                </button>
                <button className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                  onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <AttachmentStrip msg={msg} />
              <div className="text-[14.5px] whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{msg.content}</div>
            </>
          )}
          <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <HoverBtn label="Copy" onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </HoverBtn>
            <HoverBtn label="Edit" onClick={() => { setDraft(msg.content); setEditing(true) }}><Pencil size={13} /></HoverBtn>
            <HoverBtn label="Build skill" onClick={() => ui.set({ skillBuilderOpen: msg.content })}><Wand2 size={13} /></HoverBtn>
          </div>
        </div>
      </div>
    )
  }

  const f = msg.flow
  const Row: any = streaming ? motion.div : 'div'
  return (
    <Row
      {...(streaming ? {
        layout: true,
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { layout: { type: 'spring', damping: 26, stiffness: 320 }, opacity: { duration: 0.2 }, y: { duration: 0.2 } },
      } : {})}
      className={`msg-row group py-4 ${streaming ? 'msg-streaming' : 'msg-settle'}`}>
      <div className="max-w-[760px] mx-auto px-4">
        {/* Model attribution */}
        <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          {streaming && msg.content !== '' && <motion.span layoutId="re-flow-orb" className="inline-flex"><span className="re-orb re-orb-sm" aria-hidden="true" /></motion.span>}
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

        {/* Sources strip */}
        {msg.sources && msg.sources.length > 0 && (
          <SourceStrip sources={msg.sources} hoverId={hoverSource} onHover={setHoverSource} />
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
                <button
                  onClick={() => ui.set({ settingsSheet: true, settingsTab: 'providers' })}
                  className="px-3 py-1 rounded-full text-[12px]" style={{ background: 'var(--danger)', color: '#fff' }}
                >Fix in Settings</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {msg.stages && msg.stages.length > 0 && <ReplicateTimeline chatId={chatId} msg={msg} />}
            <ToolTraceChips msg={msg} />
            <ExecApproval chatId={chatId} msg={msg} />
            <QuestionnaireCard chatId={chatId} msg={msg} />
            <Markdown content={msg.content} streaming={streaming} />
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

        {/* Hover actions */}
        {!streaming && msg.content && (
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <HoverBtn label="Copy" onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </HoverBtn>
            <HoverBtn label="Regenerate" onClick={() => onRegenerate(msg)}><RefreshCw size={13} /></HoverBtn>
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
              ui.toast('Branched', 'This response now lives in its own research thread.')
            }}><GitBranch size={13} /></HoverBtn>
            <HoverBtn label="Bookmark" onClick={() => store.getState().updateMessage(chatId, msg.id, { bookmarked: !msg.bookmarked })}>
              <Bookmark size={13} fill={msg.bookmarked ? 'currentColor' : 'none'} />
            </HoverBtn>
            <HoverBtn label="Build skill" onClick={() => ui.set({ skillBuilderOpen: msg.content })}><Wand2 size={13} /></HoverBtn>
            <HoverBtn label="Extract insight" onClick={() => {
              const firstLine = msg.content.split('\n').find((l) => l.trim().length > 12)?.replace(/[#*>`]/g, '').trim() ?? 'Insight'
              useStore.setState((s) => ({
                knowledge: [{
                  id: nanoid(8), title: firstLine.slice(0, 70), insight: msg.content.slice(0, 280),
                  source: `${msg.model} · ${new Date(msg.createdAt).toLocaleDateString()}`,
                  tags: ['extracted'], confidence: 'medium', createdAt: Date.now(),
                }, ...s.knowledge],
              }))
              ui.toast('Knowledge card saved', 'Find it in Library → Knowledge.')
            }}><Lightbulb size={13} /></HoverBtn>
            {f && <HoverBtn label="Transparency info" onClick={() => setShowInfo((v) => !v)}><Info size={13} /></HoverBtn>}
          </div>
        )}

        {/* Flow trust indicator */}
        {showInfo && f && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2.5 p-3.5 rounded-[14px] text-[12px] grid grid-cols-2 sm:grid-cols-5 gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Stat label="Original context" value={`${f.originalTokens} tok`} />
            <Stat label="Pruned context" value={`${f.prunedTokens} tok`} />
            <Stat label="Prompt sent" value={`${f.promptTokens} tok`} />
            <Stat label="Completion" value={`${f.completionTokens} tok`} />
            <Stat label="Est. cost saved" value={`$${f.costSaved.toFixed(4)}`} accent />
          </motion.div>
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
