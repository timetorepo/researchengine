import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, X, Maximize2, Minimize2, GripVertical } from 'lucide-react'
import { AgentPanel } from './AgentPanel'
import { isStreamingChat } from '@/lib/chat/runChat'
import { chatIdFor } from './AgentPanel'
import type { TreeNode } from './types'

type State = 'pill' | 'open'

/**
 * The assistant as a floating, draggable pill.
 *
 * In full-screen file / design views the docked panel would eat the canvas, so
 * the chatbox collapses into an iOS-style pill: tap it and it springs open into
 * a sheet, tap the grip to drag it somewhere less obtrusive. Both the workbench
 * focus mode and the design studio's full-screen preview use this.
 */
export function AIFloat({
  project, tree, design = false, initial = 'pill', onClickExpandArea,
}: {
  project: string
  tree: TreeNode[]
  design?: boolean
  initial?: State
  /** Called when the user expands/collapses (e.g. to hide neighbouring chrome). */
  onClickExpandArea?: (open: boolean) => void
}) {
  const [state, setState] = useState<State>(initial)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [streaming, setStreaming] = useState(false)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const movedRef = useRef(false)
  const shellRef = useRef<HTMLDivElement>(null)

  // Reflect "AI is working" on the pill so it reads like an activity indicator.
  useEffect(() => {
    const chatId = chatIdFor(project)
    const iv = setInterval(() => setStreaming(isStreamingChat(chatId)), 400)
    return () => clearInterval(iv)
  }, [project])

  useEffect(() => { onClickExpandArea?.(state === 'open') }, [state, onClickExpandArea])

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = shellRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    movedRef.current = false
    setPos({ x: rect.left, y: rect.top })
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (Math.abs(ev.clientX - d.dx - rect.left) > 4 || Math.abs(ev.clientY - d.dy - rect.top) > 4) movedRef.current = true
      const w = shellRef.current?.offsetWidth ?? 320
      const h = shellRef.current?.offsetHeight ?? 48
      setPos({
        x: Math.min(Math.max(8, ev.clientX - d.dx), window.innerWidth - w - 8),
        y: Math.min(Math.max(8, ev.clientY - d.dy), window.innerHeight - h - 8),
      })
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const anchored = pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 20 }

  return (
    <div ref={shellRef} className="fixed z-40 pointer-events-none" style={{ ...anchored, width: state === 'open' ? 392 : 'auto', maxWidth: 'calc(100vw - 32px)' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {state === 'pill' ? (
          <motion.button
            key="pill"
            layoutId={`ai-float-${design ? 'design' : 'code'}`}
            onPointerDown={onPointerDown}
            onClick={() => { if (!movedRef.current) setState('open') }}
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }}
            whileTap={{ scale: 0.96 }}
            className="pointer-events-auto relative ios-material ios-sheen flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-full overflow-hidden cursor-grab active:cursor-grabbing"
            style={{ borderRadius: 999 }}
            aria-label="Open the AI assistant"
            title="Drag to move · click to open"
          >
            <span className="relative flex items-center justify-center">
              {streaming
                ? <span className="re-orb" aria-hidden />
                : (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                    <Sparkles size={14} />
                  </span>
                )}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
                {streaming ? 'AI is working' : design ? 'Ask about this screen' : 'Ask about this file'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                {streaming ? 'tap to watch' : 'fix · build · refine'}
              </span>
            </span>
            <GripVertical size={13} className="ml-1 opacity-40" style={{ color: 'var(--text-3)' }} />
          </motion.button>
        ) : (
          <motion.div
            key="sheet"
            layoutId={`ai-float-${design ? 'design' : 'code'}`}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
            className="pointer-events-auto ios-material flex flex-col overflow-hidden"
            style={{ borderRadius: 22, height: 'min(62vh, 560px)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 shrink-0 ios-material" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span onPointerDown={onPointerDown} className="cursor-grab active:cursor-grabbing p-1 rounded-md" title="Drag">
                <GripVertical size={13} style={{ color: 'var(--text-3)' }} />
              </span>
              <Sparkles size={13} style={{ color: 'var(--primary)' }} />
              <span className="text-[12px] font-medium flex-1 truncate">
                {design ? 'Design assistant' : 'AI pair-programmer'}
              </span>
              <span className="ide-badge accent">{project}</span>
              <button onClick={() => setState('pill')} className="ide-icon-btn" style={{ width: 24, height: 24 }}
                aria-label="Collapse to pill" title="Collapse">
                <Minimize2 size={12} />
              </button>
              <button onClick={() => setState('pill')} className="ide-icon-btn" style={{ width: 24, height: 24 }} aria-label="Close">
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AgentPanel project={project} tree={tree} design={design} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Small toggle the workbench uses to enter/leave full-screen (focus) mode. */
export function FocusButton({ focus, onToggle }: { focus: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="ide-btn" title={focus ? 'Exit full screen (⌘⇧F)' : 'Full screen (⌘⇧F)'}>
      {focus ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      {focus ? 'Exit full' : 'Full'}
    </button>
  )
}
