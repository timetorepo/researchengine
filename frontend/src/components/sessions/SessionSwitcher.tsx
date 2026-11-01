import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Box, Monitor, ServerCog } from 'lucide-react'
import CardSwap, { Card } from '@/components/reactbits/CardSwap/CardSwap'
import { useStore } from '@/stores/useStore'
import { isStreamingChat } from '@/lib/chat/runChat'
import { getPropsForTheme } from '@/lib/backgrounds/themeProps'

/**
 * The session switcher, iOS app-switcher style. Your recent sessions fan out
 * as cards (ReactBits CardSwap). The open session comes to the front.
 *
 * Opening: the shortcut (hold alt+shift by default), or the switcher button in
 * the top bar, which fires SESSION_SWITCHER_EVENT. Pressing the shortcut again
 * steps the deck; arrow keys step it too; Enter or a click lands on the card;
 * Escape dismisses. Sessions stream independently, so a card you left keeps
 * thinking.
 */

export const SESSION_SWITCHER_EVENT = 'researchengine:session-switcher'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

type Spec = { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean; letter: string | null }
const parseSpec = (spec: string): Spec => {
  const parts = spec.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean)
  const out: Spec = { alt: false, shift: false, ctrl: false, meta: false, letter: null }
  for (const p of parts) {
    if (p === 'alt') out.alt = true
    else if (p === 'shift') out.shift = true
    else if (p === 'ctrl') out.ctrl = true
    else if (p === 'meta' || p === 'cmd') out.meta = true
    // The shortcut recorder writes ⌘/Ctrl as `mod`: ⌘ on a Mac, Ctrl everywhere else.
    else if (p === 'mod') { if (IS_MAC) out.meta = true; else out.ctrl = true }
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

type DeckChat = ReturnType<typeof useStore.getState>['chats'][number]

export function SessionSwitcher() {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [deck, setDeck] = useState<DeckChat[]>([])
  const [round, setRound] = useState(0)
  const cardRef = useRef<{ next: () => void; prev: () => void } | null>(null)
  const navigate = useNavigate()
  const spec = useStore((s) => s.settings.sessionSwitchKey ?? 'alt+shift')
  const chats = useStore((s) => s.chats)
  const activeChatId = useStore((s) => s.activeChatId)
  const isLight = useStore((s) => getPropsForTheme(s.settings.theme).isLight)
  const list = useMemo(() => chats.slice(0, 12), [chats])
  // The open session goes to the front of the deck; the rest keep recency order.
  const ordered = useMemo(() => {
    const a = list.findIndex((c) => c.id === activeChatId)
    return a <= 0 ? list : [list[a], ...list.filter((_, i) => i !== a)]
  }, [list, activeChatId])

  const openDeck = () => {
    setDeck(ordered)
    setIdx(0)
    setRound((r) => r + 1) // remount CardSwap so every open starts from the front
    setOpen(true)
  }

  const confirm = (i: number) => {
    const c = deck[i]
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
        if (e.key === 'ArrowRight') { e.preventDefault(); cardRef.current?.next(); return }
        if (e.key === 'ArrowLeft') { e.preventDefault(); cardRef.current?.prev(); return }
      }
      if (!modsMatch(sp, e)) return
      // Pure-modifier spec (alt+shift): fire when the last modifier lands.
      // Modifier+letter spec: fire on the letter.
      const k = e.key.toLowerCase()
      const isMod = ['alt', 'shift', 'control', 'meta'].includes(k)
      if (sp.letter ? k === sp.letter : isMod) {
        e.preventDefault()
        if (!open) openDeck()
        else cardRef.current?.next()
      }
    }
    const onButton = () => { if (!open) openDeck() }
    window.addEventListener('keydown', onKey)
    window.addEventListener(SESSION_SWITCHER_EVENT, onButton)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(SESSION_SWITCHER_EVENT, onButton)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, open, idx, deck, ordered])

  return (
    <AnimatePresence>
      {open && deck.length > 0 && (
        <motion.div
          key="session-switcher"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[90] grid place-items-center"
          style={{ background: 'color-mix(in srgb, var(--bg) 55%, transparent)', backdropFilter: 'blur(18px) saturate(1.3)' }}
          onMouseDown={() => setOpen(false)}
          role="dialog"
          aria-label="Switch session"
        >
          <div onMouseDown={(e) => e.stopPropagation()}>
            <CardSwap
              key={round}
              ref={cardRef}
              width={300}
              height={230}
              cardDistance={38}
              verticalDistance={34}
              visibleCards={4}
              autoplay={false}
              pauseOnHover={false}
              theme={isLight ? 'light' : 'dark'}
              onChange={(i: number) => setIdx(i)}
              onCardClick={(i: number) => confirm(i)}
            >
              {deck.map((c) => {
                const last = c.messages[c.messages.length - 1]
                const live = isStreamingChat(c.id)
                const iso = c.session?.isolation
                const Icon = iso === 'docker' ? Box : iso === 'vm' ? ServerCog : Monitor
                return (
                  <Card key={c.id} aria-label={c.title || 'Untitled session'}>
                    <div className="flex h-full w-full flex-col p-4 text-left" style={{ color: 'var(--swap-ink)' }}>
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold truncate">
                        {live && <span className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--success, #34c759)' }} />}
                        <span className="truncate">{c.title || 'Untitled session'}</span>
                        <Icon size={12} className="ml-auto shrink-0 opacity-60" />
                      </div>
                      <div className="mt-2 flex-1 overflow-hidden rounded-lg px-2 py-1.5 text-[11px] leading-relaxed opacity-80"
                        style={{ background: 'var(--swap-badge)' }}>
                        {last ? plain(last.content).slice(0, 220) : 'No messages yet'}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] opacity-60">
                        <span>{c.messages.length} messages{c.kind === 'coding' ? ' · coding' : ''}</span>
                        <span>{ago(c.updatedAt)}</span>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </CardSwap>
          </div>
          <div className="absolute bottom-8 text-[11px]" style={{ color: 'var(--text-3)' }}>
            Drag or use ← → to browse · Enter to switch · Esc to dismiss
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
