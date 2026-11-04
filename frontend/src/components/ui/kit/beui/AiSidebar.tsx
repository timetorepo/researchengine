// Beui-style AI sidebar: a collapsible side panel for the Coder — sessions,
// files or tools — that slides open and shut with its header toggle.
import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function AiSidebar({ title, children, defaultOpen = true, width = 260 }: {
  title: string; children: ReactNode; defaultOpen?: boolean; width?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.aside aria-label={title} animate={{ width: open ? width : 44 }} transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative h-full shrink-0 overflow-hidden flex flex-col" style={{ borderRight: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-2 px-2.5 h-10 shrink-0">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="grid place-items-center w-7 h-7 rounded-[7px]" style={{ color: 'var(--text-2)' }}>
          {open ? <PanelLeftClose size={15} aria-hidden /> : <PanelLeftOpen size={15} aria-hidden />}
        </button>
        {open && <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{title}</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-auto" hidden={!open} aria-hidden={!open}>{children}</div>
    </motion.aside>
  )
}
