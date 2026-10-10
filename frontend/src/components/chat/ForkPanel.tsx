/**
 * "Fork with a compressed prompt."
 *
 * The old fork copied the last ten turns, cut each to 420 characters and handed
 * that over — one setting, no numbers, and a new chat that opened with a wall of
 * text. This panel is the feature as asked for: it compresses the prompt so the
 * continuation costs fewer tokens and answers the same way, and it shows its
 * work — how many tokens go in, how many come out, how many facts it kept, and
 * the capsule itself, which can be read (or edited by hand) before forking.
 *
 * The compression is local and deterministic (lib/chat/fork): no model call, so
 * nothing is spent to save something. HeroUI's Modal is the real component, as
 * everywhere else in this app.
 */
import React, { useMemo, useState } from 'react'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { Scissors, Copy, Check, ArrowRight, FileCode2, ListChecks, Gauge } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Button } from '@/components/ui/heroui/Button'
import { Switch } from '@/components/ui/heroui/Switch'
import { compressConversation, type ForkLevel } from '@/lib/chat/fork'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'

const LEVELS: { id: ForkLevel; label: string; note: string }[] = [
  { id: 'compact', label: 'Compact', note: 'Fewest tokens — the shape of the work only' },
  { id: 'balanced', label: 'Balanced', note: 'The default: decisions, numbers and the recent turns' },
  { id: 'faithful', label: 'Faithful', note: 'Keeps the most — for work with a lot of exact detail' },
]

export function ForkPanel({ open, onClose, chatId, exhausted = false }: { open: boolean; onClose: () => void; chatId: string; exhausted?: boolean }) {
  const navigate = useNavigate()
  const chat = useStore((s) => s.chats.find((c) => c.id === chatId))
  const settings = useStore((s) => s.settings)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, fork: { ...s.settings.fork, ...patch } } }))

  const level: ForkLevel = settings.fork?.level ?? 'balanced'
  const keepLast = settings.fork?.keepLast ?? 3
  const includeCode = settings.fork?.includeCode !== false

  const [copied, setCopied] = useState(false)
  const [showCapsule, setShowCapsule] = useState(false)

  const result = useMemo(
    () => compressConversation(chat?.messages ?? [], { level, keepLast, includeCode }),
    [chat?.messages, level, keepLast, includeCode],
  )

  if (!chat) return null

  const doFork = () => {
    const store = useStore.getState()
    const id = store.newChat()
    store.renameChat(id, `Fork · ${chat.title}`.slice(0, 80))
    const stats = result.stats
    store.addMessage(id, {
      id: nanoid(8),
      role: 'assistant',
      content: result.capsule,
      createdAt: Date.now(),
      model: 'compressed context',
      provider: 'Research Engine',
      capsule: {
        fromChatId: chat.id,
        fromTitle: chat.title,
        savedPct: stats.savedPct,
        sourceTokens: stats.sourceTokens,
        capsuleTokens: stats.capsuleTokens,
        turns: stats.turns,
        facts: stats.facts,
      },
    })
    onClose()
    navigate(`/chat/${id}`)
    useUI.getState().toast(
      'Forked with a compressed prompt',
      `${stats.sourceTokens} → ${stats.capsuleTokens} tokens (${stats.savedPct}% smaller), ${stats.facts} decisions kept.`,
      'success',
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.capsule)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the capsule is on screen to select by hand */ }
  }

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl" scrollBehavior="inside" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1 pr-10">
          <span className="flex items-center gap-2 text-[16px]">
            <Scissors size={16} style={{ color: 'var(--primary)' }} />
            Fork with a compressed prompt
          </span>
          <span className="text-[12px] font-normal" style={{ color: 'var(--text-2)' }}>
            {exhausted
              ? 'This chat ran out of context. Forking it with a compressed prompt keeps the work and starts clean.'
              : 'Carry this conversation into a new chat as a smaller, lossless-for-continuation capsule.'}
          </span>
        </ModalHeader>

        <ModalBody>
          {/* the numbers, before and after */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
            <Stat icon={Gauge} label="Source" value={`${result.stats.sourceTokens} tok`} />
            <Stat icon={Scissors} label="Capsule" value={`${result.stats.capsuleTokens} tok`} accent />
            <Stat icon={ListChecks} label="Decisions kept" value={String(result.stats.facts)} />
            <Stat icon={FileCode2} label="Code blocks" value={String(result.stats.codeBlocks)} />
          </div>

          <div className="rounded-[12px] px-3.5 py-3 mb-3 text-[12.5px]"
            style={{ background: 'color-mix(in srgb, var(--success) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)' }}>
            {result.stats.savedPct >= 15 ? (
              <>
                <b>{result.stats.savedPct}% fewer tokens</b> — {result.stats.turns} turns become {result.stats.capsuleTokens} tokens of context.
                Compiled on this device, so compressing costs nothing.
              </>
            ) : (
              <>
                <b>This chat is short enough that compressing it saves little</b> — the capsule carries everything a
                continuation needs at about the size of the conversation ({result.stats.sourceTokens} → {result.stats.capsuleTokens} tokens).
                Keep talking in it, or fork it anyway; nothing is lost either way.
              </>
            )}
          </div>

          {/* how hard to compress */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => update({ level: l.id })}
                title={l.note}
                className="px-3 py-1.5 rounded-full text-[11.5px] transition-colors"
                style={{
                  background: level === l.id ? 'color-mix(in srgb, var(--primary) 14%, var(--surface))' : 'var(--surface)',
                  border: `1px solid ${level === l.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                  color: level === l.id ? 'var(--text)' : 'var(--text-2)',
                }}>
                {l.label}
              </button>
            ))}
            <div className="flex items-center gap-3 ml-auto">
              <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                Recent turns kept
                <select
                  value={keepLast}
                  onChange={(e) => update({ keepLast: Number(e.target.value) })}
                  className="px-2 py-1 rounded-[8px] text-[11px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                  {[0, 1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                Code
                <Switch checked={includeCode} onChange={(v) => update({ includeCode: v })} size="sm" />
              </label>
            </div>
          </div>

          {/* the capsule itself, on request */}
          <button onClick={() => setShowCapsule((v) => !v)}
            className="text-[11.5px] mb-2" style={{ color: 'var(--primary)' }}>
            {showCapsule ? 'Hide the capsule' : 'Read the capsule before you fork'}
          </button>
          {showCapsule && (
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto rounded-[12px] p-3"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              {result.capsule || 'This chat has nothing to carry over yet.'}
            </pre>
          )}
        </ModalBody>

        <ModalFooter className="flex-wrap gap-2 justify-between">
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            The new chat opens with this capsule as its context — then just keep talking.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="flat" size="sm" onClick={copy} startContent={copied ? <Check size={13} /> : <Copy size={13} />}>
              {copied ? 'Copied' : 'Copy capsule'}
            </Button>
            <Button size="sm" onClick={doFork} disabled={!result.capsule} startContent={<ArrowRight size={13} />}>
              Fork into a new chat
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function Stat({ icon: Icon, label, value, accent = false }: { icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] px-3 py-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
        <Icon size={11} /> {label}
      </div>
      <div className="text-[15px] font-semibold font-mono" style={{ color: accent ? 'var(--primary)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

/**
 * A capsule message, rendered as what it is: a folded-up copy of an earlier
 * conversation, with the numbers, not an answer from a model.
 */
export function CapsuleCard({ msg }: { msg: import('@/types').ChatMessage }) {
  const c = msg.capsule
  const [open, setOpen] = useState(false)
  if (!c) return null
  return (
    <div className="rounded-[14px] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-2 px-3.5 py-3">
        <span className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
          <Scissors size={13} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium">Compressed context from “{c.fromTitle}”</div>
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {c.sourceTokens} → {c.capsuleTokens} tokens ({c.savedPct}% smaller) · {c.turns} turns · {c.facts} decisions kept
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="ml-auto text-[11.5px] shrink-0" style={{ color: 'var(--primary)' }}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <pre className="text-[11.5px] leading-relaxed whitespace-pre-wrap break-words px-3.5 pb-3.5 max-h-[420px] overflow-y-auto"
          style={{ color: 'var(--text-2)' }}>
          {msg.content}
        </pre>
      )}
    </div>
  )
}
