import React, { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Search, Users, Square, Wind, X } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { stopStream } from '@/lib/chat/runChat'
import { fmt } from '@/lib/utils'
import { ModelLogo } from '@/components/shared/ModelLogo'

// Spec spring: damping 25 / stiffness 300. Higher stiffness keeps the island snappy.
const spring = { type: 'spring', damping: 25, stiffness: 300 } as const

export function DynamicIsland() {
  const island = useUI((s) => s.island)
  const expanded = useUI((s) => s.islandExpanded)
  const model = useStore((s) => s.settings.defaultModel)
  const pressTimer = useRef<any>(null)

  const reduced = useStore((s) => s.settings.reduceMotion) ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const providerId = (model || '').split(':')[0]
  const modelName = model.split(':')[1] ?? model

  const onPointerDown = () => {
    pressTimer.current = setTimeout(() => useUI.setState({ islandExpanded: true }), 550)
  }
  const onPointerUp = () => clearTimeout(pressTimer.current)

  const mm = Math.floor((island.kind === 'focus' ? island.remaining : 0) / 60)
  const ss = (island.kind === 'focus' ? island.remaining : 0) % 60

  const statusLine =
    island.kind === 'streaming' ? `Streaming response — ${fmt(island.tokens)} tokens generated.` :
    island.kind === 'idle' ? 'Idle. All systems local.' :
    island.kind === 'search' ? 'Web search in progress.' :
    island.kind === 'flood' ? `${island.active} of ${island.total} agents working.` :
    island.kind === 'focus' ? `Focus session — ${mm}:${String(ss).padStart(2, '0')} remaining.` :
    `Running skill "${(island as any).name}".`

  // Cross-fade config when motion is reduced, spring morph otherwise.
  const contentAnim = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, scale: 0.92, y: 4 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: -4 }, transition: spring }

  return (
    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-50">
      {/* Single layout-morphing container: framer animates transform, not width,
          so the pill stretches/settles on the GPU without layout thrash. */}
      <motion.div
        layout={!reduced}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => useUI.setState({ islandExpanded: !expanded })}
        className="glass cursor-pointer select-none flex flex-col overflow-hidden"
        style={{
          borderRadius: expanded ? 26 : 999,
          border: '1px solid var(--surface-border)',
          boxShadow: '0 10px 36px -10px rgba(0,0,0,0.6)',
          willChange: reduced ? undefined : 'transform',
        }}
        transition={spring}
        aria-label="Status island"
      >
        {/* Compact face — keyed by state so swaps cross-fade cleanly */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={expanded ? 'x' : island.kind}
            {...contentAnim}
            className="flex items-center gap-2.5 px-4 h-10"
          >
            {expanded ? (
              <>
                <ModelLogo providerId={providerId} size={26} rounded={8} />
                <span className="text-[12.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>{modelName}</span>
                <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: 'var(--success)' }} />
              </>
            ) : island.kind === 'idle' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                <span className="text-[11.5px] font-mono truncate max-w-[170px]" style={{ color: 'var(--text-2)' }}>{modelName}</span>
              </>
            ) : island.kind === 'streaming' ? (
              <>
                <div className="flex items-end gap-[2.5px] h-4" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="wave-bar h-full" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
                <span className="text-[11.5px] tabular-nums min-w-[64px]" style={{ color: 'var(--text-2)' }}>{fmt(island.tokens)} tokens</span>
              </>
            ) : island.kind === 'search' ? (
              <>
                <Search size={13} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                <span className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>
                  {island.sources > 0 ? `${island.sources} sources` : 'Scanning web…'}
                </span>
                <span className="w-8 h-[3px] rounded-full relative overflow-hidden" style={{ background: 'var(--elevated)' }}>
                  <motion.span
                    className="absolute inset-y-0 w-3 rounded-full" style={{ background: 'var(--primary)' }}
                    animate={{ x: [-12, 32, -12] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </span>
              </>
            ) : island.kind === 'flood' ? (
              <>
                <Users size={13} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
                <span className="flex gap-1 items-center">
                  {Array.from({ length: island.total }).map((_, i) => (
                    <span key={i} className={i < island.active ? 'pulse-dot' : ''}
                      style={{ width: 6, height: 6, borderRadius: 99, display: 'inline-block', background: i < island.active ? 'var(--primary)' : 'var(--elevated)', color: 'var(--primary)' }} />
                  ))}
                </span>
                <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-2)' }}>{island.active}/{island.total}</span>
              </>
            ) : island.kind === 'focus' ? (
              <>
                <span style={{ width: 18, height: 18, display: 'inline-flex' }}>
                  <svg viewBox="0 0 20 20" width="18" height="18">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--elevated)" strokeWidth="2.5" />
                    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--warning)" strokeWidth="2.5"
                      strokeDasharray={`${(1 - island.remaining / Math.max(1, island.total)) * 50.2} 50.2`}
                      strokeLinecap="round" transform="rotate(-90 10 10)" />
                  </svg>
                </span>
                <span className="text-[11.5px] tabular-nums font-mono" style={{ color: 'var(--text-2)' }}>
                  {mm}:{String(ss).padStart(2, '0')}
                </span>
              </>
            ) : (
              <>
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-[11.5px] truncate max-w-[150px]" style={{ color: 'var(--text-2)' }}>{(island as any).name}</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Expanded body */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body"
              {...(reduced
                ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
                : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 }, transition: spring })}
              className="px-4 pb-4 pt-1 w-[320px]"
            >
              <div className="flex items-center gap-3 pb-3 mb-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <ModelLogo providerId={providerId} size={44} rounded={12} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold truncate" style={{ letterSpacing: '-0.01em' }}>{modelName}</div>
                  <div className="text-[11px] capitalize" style={{ color: 'var(--text-3)' }}>{providerId} · default model</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); useUI.setState({ islandExpanded: false }) }}
                  aria-label="Collapse island"
                  className="ml-auto p-1.5 rounded-full hover:bg-[var(--elevated)]"
                  style={{ color: 'var(--text-3)' }}
                >
                  <X size={13} />
                </button>
              </div>

              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Status</div>
              <div className="text-[12.5px] leading-snug mb-3" style={{ color: 'var(--text-2)' }}>{statusLine}</div>

              <div className="flex gap-2">
                {island.kind === 'streaming' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); const c = useStore.getState().activeChatId; if (c) stopStream(c) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] pressable"
                    style={{ background: 'var(--danger)', color: '#fff' }}
                  >
                    <Square size={11} /> Stop
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); useUI.setState({ islandExpanded: false, settingsOpen: true, settingsTab: 'providers' }); window.location.hash = '#/settings' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] pressable"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                >
                  <Wind size={11} /> Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
