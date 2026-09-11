import React, { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Search, Users, Timer, Wind, Square } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { stopStream } from '@/lib/chat/runChat'
import { fmt } from '@/lib/utils'

const spring = { type: 'spring', damping: 25, stiffness: 300 } as const

export function DynamicIsland() {
  const island = useUI((s) => s.island)
  const expanded = useUI((s) => s.islandExpanded)
  const model = useStore((s) => s.settings.defaultModel)
  const pressTimer = useRef<any>(null)

  const reduced = useStore((s) => s.settings.reduceMotion) ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const onPointerDown = () => {
    pressTimer.current = setTimeout(() => useUI.setState({ islandExpanded: true }), 550)
  }
  const onPointerUp = () => clearTimeout(pressTimer.current)

  const mm = Math.floor((island.kind === 'focus' ? island.remaining : 0) / 60)
  const ss = (island.kind === 'focus' ? island.remaining : 0) % 60

  return (
    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        layout={!reduced}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => !expanded && useUI.setState({ islandExpanded: !expanded })}
        className="glass overflow-hidden cursor-pointer select-none flex items-center justify-center"
        style={{
          borderRadius: expanded ? 24 : 999,
          border: '1px solid var(--surface-border)',
          boxShadow: '0 8px 32px -8px rgba(0,0,0,0.55)',
          minWidth: expanded ? 320 : undefined,
        }}
        animate={{ width: expanded ? 340 : undefined }}
        transition={spring}
        aria-label="Status island"
      >
        <motion.div layout className="flex items-center gap-2.5 px-4 h-9" transition={spring}>
          {island.kind === 'idle' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="text-[11.5px] font-mono truncate max-w-[160px]" style={{ color: 'var(--text-2)' }}>
                {model.split(':')[1] ?? model}
              </span>
            </>
          )}
          {island.kind === 'streaming' && (
            <>
              <div className="flex items-end gap-[2.5px] h-4" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="wave-bar h-full" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
              <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-2)' }}>{fmt(island.tokens)} tokens</span>
            </>
          )}
          {island.kind === 'search' && (
            <>
              <Search size={13} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
              <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                {island.sources > 0 ? `${island.sources} sources` : 'Scanning web…'}
              </span>
              <motion.span
                className="w-8 h-[3px] rounded-full overflow-hidden relative"
                style={{ background: 'var(--elevated)' }}
              >
                <motion.span
                  className="absolute inset-y-0 w-3 rounded-full" style={{ background: 'var(--primary)' }}
                  animate={{ x: [-12, 32, -12] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.span>
            </>
          )}
          {island.kind === 'flood' && (
            <>
              <Users size={13} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
              <span className="flex gap-1">
                {Array.from({ length: island.total }).map((_, i) => (
                  <span key={i} className={i < island.active ? 'pulse-dot' : ''}
                    style={{ width: 6, height: 6, borderRadius: 99, display: 'inline-block', background: i < island.active ? 'var(--primary)' : 'var(--elevated)', color: 'var(--primary)' }} />
                ))}
              </span>
              <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>{island.active}/{island.total}</span>
            </>
          )}
          {island.kind === 'focus' && (
            <>
              <span className="relative w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="var(--elevated)" strokeWidth="2.5" />
                  <circle
                    cx="10" cy="10" r="8" fill="none" stroke="var(--warning)" strokeWidth="2.5"
                    strokeDasharray={`${(1 - island.remaining / Math.max(1, island.total)) * 50.2} 50.2`}
                    strokeLinecap="round" transform="rotate(-90 10 10)"
                  />
                </svg>
              </span>
              <span className="text-[11.5px] tabular-nums font-mono" style={{ color: 'var(--text-2)' }}>
                {mm}:{String(ss).padStart(2, '0')}
              </span>
            </>
          )}
          {island.kind === 'skill' && (
            <>
              <Loader2 size={13} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span className="text-[11.5px] truncate max-w-[140px]" style={{ color: 'var(--text-2)' }}>{island.name}</span>
            </>
          )}
        </motion.div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="w-full px-4 pb-3"
            >
              <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-3)' }}>Status</div>
                <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                  {island.kind === 'streaming' && `Streaming response — ${fmt(island.tokens)} tokens generated.`}
                  {island.kind === 'idle' && 'Idle. All systems local.'}
                  {island.kind === 'search' && 'Web search in progress.'}
                  {island.kind === 'flood' && `${island.active} of ${island.total} agents working.`}
                  {island.kind === 'focus' && `Focus session — ${mm}:${String(ss).padStart(2, '0')} remaining.`}
                  {island.kind === 'skill' && `Running skill "${island.name}".`}
                </div>
                <div className="flex gap-2 pt-1">
                  {island.kind === 'streaming' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); const c = useStore.getState().activeChatId; if (c) stopStream(c) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
                      style={{ background: 'var(--danger)', color: '#fff' }}
                    >
                      <Square size={11} /> Stop
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); useUI.setState({ islandExpanded: false, settingsOpen: true }); window.location.hash = '#/settings' }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
                    style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                  >
                    <Wind size={11} /> Settings
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
