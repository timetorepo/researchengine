import React, { useMemo } from 'react'
import { motion } from 'motion/react'
import { HardDrive, Mail, Calendar, Github, StickyNote, BookMarked, FolderOpen } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { fuzzy } from '@/lib/utils'

export const INTEGRATION_META: Record<string, { name: string; icon: any; hue: number }> = {
  drive: { name: 'Google Drive', icon: HardDrive, hue: 45 },
  gmail: { name: 'Google Mail', icon: Mail, hue: 5 },
  gcal: { name: 'Google Calendar', icon: Calendar, hue: 210 },
  github: { name: 'GitHub', icon: Github, hue: 260 },
  notion: { name: 'Notion', icon: StickyNote, hue: 30 },
  zotero: { name: 'Zotero', icon: BookMarked, hue: 0 },
  files: { name: 'Local files', icon: FolderOpen, hue: 150 },
}

export function IntegrationPicker({ query, onPick, onClose }: { query: string; onPick: (label: string) => void; onClose: () => void }) {
  const integrations = useStore((s) => s.integrations)
  const documents = useStore((s) => s.documents)
  const ui = useUI()

  const connected = Object.entries(integrations).filter(([, v]) => v.connected)
  const items = useMemo(() => {
    const list: { label: string; sub: string; icon: any; hue: number }[] = []
    for (const [id] of connected) {
      const meta = INTEGRATION_META[id]
      if (meta && fuzzy(query, meta.name)) list.push({ label: meta.name.toLowerCase().replace(/\s/g, '-'), sub: meta.name, icon: meta.icon, hue: meta.hue })
    }
    for (const d of documents) {
      if (fuzzy(query, d.name)) list.push({ label: `doc:${d.name}`, sub: `Document · ${d.name}`, icon: FolderOpen, hue: 150 })
    }
    return list.slice(0, 8)
  }, [connected, documents, query])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute left-2 right-2 bottom-full mb-2 max-h-64 overflow-y-auto surface-elevated p-1.5 z-40"
      style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
      role="listbox" aria-label="Sources"
    >
      {items.length === 0 ? (
        <div className="px-3 py-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>
          No connected sources yet. Connect integrations in Settings, or upload documents in Read &amp; Quiz.
        </div>
      ) : items.map((it) => (
        <button key={it.label} onClick={() => onPick(it.label)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left hover:bg-[var(--surface)]">
          <span className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: `hsl(${it.hue} 50% 45% / 0.2)`, color: `hsl(${it.hue} 60% 60%)` }}>
            <it.icon size={12.5} strokeWidth={1.5} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] truncate">{it.sub}</span>
            <span className="block text-[11px] font-mono truncate" style={{ color: 'var(--text-3)' }}>@{it.label}</span>
          </span>
        </button>
      ))}
    </motion.div>
  )
}
