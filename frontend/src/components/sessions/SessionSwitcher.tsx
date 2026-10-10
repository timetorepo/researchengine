import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Box, Monitor, ServerCog } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { isStreamingChat } from '@/lib/chat/runChat'

/**
 * The session switcher: hold-alt-shift energy. Pressing the shortcut opens a
 * card carousel of your live sessions, iOS app-switcher style; pressing it
 * again steps the selection; Enter (or clicking a card) lands you there.
 * Sessions stream independently, so the card you left keeps thinking.
 */

type Spec = { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean; letter: string | null }
const parseSpec = (spec: string): Spec => {
  const parts = spec.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean)
  const out: Spec = { alt: false, shift: false, ctrl: false, meta: false, letter: null }
  for (const p of parts) {
    if (p === 'alt') out.alt = true
    else if (p === 'shift') out.shift = true
    else if (p === 'ctrl') out.ctrl = true
    else if (p === 'meta' || p === 'cmd') out.meta = true
    else out.letter = p
  }
  return out
}
const modsMatch = (sp: Spec, e: KeyboardEvent) =>
  sp.alt === e.altKey && sp.shift === e.shiftKey && sp.ctrl === e.ctrlKey && sp.meta === e.metaKey

/** Plain text for a card: no markdown markers, no line breaks. */
const plain = (t: string) => t
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/[*_`]{1,3}/g, '')
  .replace(/^\s{0,3}(#{1,6}|>|[-+]|\d+\.)\s+/gm, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()

const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

export function SessionSwitcher() {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const navigate = useNavigate()
  const spec = useStore((s) => s.settings.sessionSwitchKey ?? 'alt+shift')
  const chats = useStore((s) => s.chats)
  const activeChatId = useStore((s) => s.activeChatId)
  const list = useMemo(() => chats.slice(0, 12), [chats])

  const confirm = (i: number) => {
    const c = list[i]
    if (c) {
      useStore.getState().setActiveChat(c.id)
      navigate(`/chat/${c.id}`)
    }
    setOpen(false)
  }

  useEffect(() => {
    const sp = parseSpec(spec)
    const onKey = (e: KeyboardEvent) => {
      if (open) {
        if (e.key === 'Escape') { setOpen(false); return }
        if (e.key === 'Enter') { e.preventDefault(); confirm(idx); return }
        if (e.key === 'ArrowRight') { setIdx((i) => Math.min(i + 1, list.length - 1)); return }
        if (e.key === 'ArrowLeft') { setIdx((i) => Math.max(i - 1, 0)); return }
      }
      if (!modsMatch(sp, e)) return
      // Pure-modifier spec (alt+shift): fire when the last modifier lands.
      // Modifier+letter spec: fire on the letter.
      const k = e.key.toLowerCase()
      const isMod = ['alt', 'shift', 'control', 'meta'].includes(k)
      if (sp.letter ? k === sp.letter : isMod) {
        e.preventDefault()
        setOpen((o) => {
          if (!o) setIdx(Math.max(0, list.findIndex((c) => c.id === (activeChatId ?? list[0]?.id))))
          else setIdx((i) => (i + 1) % Math.max(1, list.length))
          return true
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, open, idx, list, activeChatId])

  return (
    <AnimatePresence>
      {open && list.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[90] grid place-items-center"
          style={{ background: 'color-mix(in srgb, var(--bg) 55%, transparent)', backdropFilter: 'blur(18px) saturate(1.3)' }}
          onMouseDown={() => setOpen(false)}
        >
          <div className="flex items-center gap-4 max-w-[92vw] overflow-x-auto px-8 py-6" onMouseDown={(e) => e.stopPropagation()}>
            {list.map((c, i) => {
              const last = c.messages[c.messages.length - 1]
              const live = isStreamingChat(c.id)
              const iso = c.session?.isolation
              return (
                <motion.button
                  key={c.id}
                  layout
                  animate={{ scale: i === idx ? 1.07 : 0.94, y: i === idx ? -6 : 0 }}
                  transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                  className="shrink-0 w-60 rounded-2xl p-3 text-left"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${i === idx ? 'var(--primary)' : 'var(--surface-border)'}`,
                    boxShadow: i === idx ? '0 18px 48px rgb(0 0 0 / .35)' : '0 8px 24px rgb(0 0 0 / .2)',
                  }}
                  onClick={() => confirm(i)}
                  onMouseEnter={() => setIdx(i)}
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
                    {live && <span className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--success, #34c759)' }} />}
                    <span className="truncate">{c.title || 'Untitled session'}</span>
                    <span className="ml-auto shrink-0" style={{ color: 'var(--text-3)' }}>
                      {iso === 'docker' ? <Box size={12} /> : iso === 'vm' ? <ServerCog size={12} /> : <Monitor size={12} />}
                    </span>
                  </div>
                  <div className="mt-2 h-16 overflow-hidden rounded-lg px-2 py-1.5 text-[10.5px] leading-relaxed"
                    style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                    {last ? plain(last.content).slice(0, 160) : 'No messages yet'}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9.5px]" style={{ color: 'var(--text-3)' }}>
                    <span>{c.messages.length} messages{c.kind === 'coding' ? ' · coding' : ''}</span>
                    <span>{ago(c.updatedAt)}</span>
                  </div>
                </motion.button>
              )
            })}
          </div>
          <div className="absolute bottom-8 text-[11px]" style={{ color: 'var(--text-3)' }}>
            {spec.toUpperCase().replace(/\+/g, ' + ')} again to step · Enter to switch · Esc to dismiss
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
