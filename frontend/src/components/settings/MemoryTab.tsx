import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { Switch } from '@/components/ui/heroui/Switch'
import { addMemory, removeMemory, MEMORY_LIMITS, type Memory } from '@/lib/memory/memory'
import { timeAgo } from '@/lib/utils'
import { AppleCard, AppleRow, AppleSectionTitle } from '@/components/ui/apple/AppleCard'

/**
 * Persistent memory, in one place: what Research Engine remembers about you,
 * whether it uses that in replies, and the means to add or remove any of it.
 *
 * Memories are written only by you — from a "Remember" action on a message, or
 * typed here. Nothing is saved from a conversation without you asking.
 */
export function MemoryTab() {
  const memories = useStore((s) => s.memories ?? [])
  const useMemories = useStore((s) => s.settings.useMemories !== false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const setUse = (v: boolean) =>
    useStore.setState((s) => ({ settings: { ...s.settings, useMemories: v } }))

  const add = () => {
    const r = addMemory(memories, draft, { source: 'manual' })
    if (r.added) {
      useStore.setState({ memories: r.list })
      setDraft('')
      setNote(null)
    } else {
      setNote(r.reason === 'duplicate' ? 'Already remembered.' : 'Write something first.')
    }
  }

  const remove = (m: Memory) =>
    useStore.setState((s) => ({ memories: removeMemory(s.memories ?? [], m.id) }))

  const clearAll = () => {
    useStore.setState({ memories: [] })
    setConfirmClear(false)
  }

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <Switch
          label="Use memories in replies"
          description="When on, the facts below are given to the model with each message. Turn it off to keep them saved but unused."
          checked={useMemories}
          onChange={setUse}
        />
      </div>

      <div className="surface p-4">
        <div className="text-[13px] font-medium mb-0.5">Remember something</div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          One fact per line works best, for example “I prefer metric units” or “My thesis is on coral reefs”. Up to {MEMORY_LIMITS.count} memories are kept.
        </p>
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setNote(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add() }}
          rows={2}
          maxLength={MEMORY_LIMITS.chars}
          placeholder="Type a fact to remember"
          className="w-full p-2.5 rounded-[10px] text-[13px] outline-none resize-y"
          style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={add} className="px-3.5 py-1.5 rounded-[9px] text-[12.5px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            Remember
          </button>
          {note && <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{note}</span>}
          <span className="flex-1" />
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{memories.length} / {MEMORY_LIMITS.count}</span>
        </div>
      </div>

      <AppleSectionTitle trailing={memories.length > 0 && (
        confirmClear ? (
          <span className="flex items-center gap-2 text-[12px]">
            <span style={{ color: 'var(--text-3)' }}>Delete all {memories.length}?</span>
            <button onClick={clearAll} className="px-2 py-1 rounded-full" style={{ color: 'var(--danger)' }}>Delete all</button>
            <button onClick={() => setConfirmClear(false)} className="px-2 py-1 rounded-full" style={{ color: 'var(--text-2)' }}>Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="text-[12px] px-2 py-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--primary)' }}>
            Clear all
          </button>
        )
      )}>Saved</AppleSectionTitle>
      <AppleCard padded={false}>
        {memories.length === 0 ? (
          <div className="px-4 py-5 text-[13px]" style={{ color: 'var(--text-3)' }}>
            Nothing saved yet. Use “Remember” on one of your messages, or type a fact above.
          </div>
        ) : (
          memories.map((m, i) => (
            <AppleRow key={m.id} first={i === 0} className="group">
              <div className="min-w-0 flex-1 py-0.5">
                <div className="text-[14px] leading-snug break-words" style={{ color: 'var(--text)' }}>{m.text}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {m.source === 'chat' ? 'From a chat' : 'Typed here'} · {timeAgo(m.createdAt)}
                </div>
              </div>
              <button onClick={() => remove(m)} aria-label="Delete this memory" title="Delete"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-8 h-8 rounded-full grid place-items-center hover:bg-[var(--elevated)]" style={{ color: 'var(--danger)' }}>
                <Trash2 size={14} />
              </button>
            </AppleRow>
          ))
        )}
      </AppleCard>
    </div>
  )
}
