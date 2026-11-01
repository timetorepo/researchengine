import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Keyboard } from 'lucide-react'
import { useUI } from '@/stores/useUI'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS: [string, string][] = [
  [`${mod} + K`, 'Command palette — search everything'],
  [`${mod} + B`, 'Toggle sidebar'],
  [`${mod} + N`, 'New chat'],
  [`${mod} + Shift + N`, 'New chat with web search'],
  [`${mod} + M`, 'Toggle Math Mode'],
  [`${mod} + F`, 'Toggle AIFlowEngine'],
  [`${mod} + Shift + A`, 'Open Agent Flood planner'],
  [`${mod} + Shift + S`, 'Open Settings'],
  [`${mod} + /`, 'Show this panel'],
  [`${mod} + Enter`, 'Send with web search'],
  ['/ in input', 'Skill picker'],
  ['@ in input', 'Integration source picker'],
  ['Esc', 'Close overlay'],
  ['↑ in empty input', 'Edit last message'],
]

export function ShortcutsOverlay() {
  const open = useUI((s) => s.shortcutsOpen)
  const ui = useUI()

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[75] sheet-scrim flex items-center justify-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => ui.set({ shortcutsOpen: false })}>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-[520px] surface-elevated overflow-hidden"
            style={{ borderRadius: 'var(--radius-modal)', boxShadow: '0 32px 80px -24px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-label="Keyboard shortcuts"
          >
            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <Keyboard size={17} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
              <span className="font-semibold text-[15px] flex-1">Keyboard shortcuts</span>
              <button onClick={() => ui.set({ shortcutsOpen: false })} aria-label="Close"><X size={16} style={{ color: 'var(--text-3)' }} /></button>
            </div>
            <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
              {SHORTCUTS.map(([k, desc]) => (
                <div key={k} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{desc}</span>
                  <kbd className="text-[11px] font-mono px-2 py-1 rounded-[8px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>{k}</kbd>
                </div>
              ))}
              <p className="text-[11px] mt-3 pb-2 italic" style={{ color: 'var(--text-3)' }}>
                Some shortcuts aren't listed here. Curious types may enjoy /secrets.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
