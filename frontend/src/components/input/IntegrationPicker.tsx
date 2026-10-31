import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { HardDrive, Mail, Calendar, Github, StickyNote, BookMarked, FolderOpen, Plug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { fuzzy } from '@/lib/utils'
import { composioConfigured, isActiveAccount, listComposioAccounts } from '@/lib/composio/client'

export const INTEGRATION_META: Record<string, { name: string; icon: any; hue: number }> = {
  drive: { name: 'Google Drive', icon: HardDrive, hue: 45 },
  gmail: { name: 'Google Mail', icon: Mail, hue: 5 },
  gcal: { name: 'Google Calendar', icon: Calendar, hue: 210 },
  github: { name: 'GitHub', icon: Github, hue: 260 },
  notion: { name: 'Notion', icon: StickyNote, hue: 30 },
  zotero: { name: 'Zotero', icon: BookMarked, hue: 0 },
  files: { name: 'Local files', icon: FolderOpen, hue: 150 },
}

export function IntegrationPicker({ query, onPick, onClose: _onClose }: { query: string; onPick: (label: string) => void; onClose: () => void }) {
  const integrations = useStore((s) => s.integrations)
  const documents = useStore((s) => s.documents)
  // Apps the person has connected in the Marketplace (Composio), one entry per app.
  const [apps, setApps] = useState<string[]>([])

  useEffect(() => {
    if (!composioConfigured()) return
    let alive = true
    listComposioAccounts()
      .then((accs) => {
        if (!alive) return
        const slugs = [...new Set(accs.filter(isActiveAccount).map((a) => a.toolkit.toLowerCase()))]
        setApps(slugs)
      })
      .catch(() => { /* the Marketplace shows the error; the picker just lists nothing */ })
    return () => { alive = false }
  }, [])

  const connected = Object.entries(integrations).filter(([, v]) => v.connected)
  const items = useMemo(() => {
    const list: { label: string; sub: string; icon: any; hue: number }[] = []
    for (const [id] of connected) {
      const meta = INTEGRATION_META[id]
      if (meta && fuzzy(query, meta.name)) list.push({ label: meta.name.toLowerCase().replace(/\s/g, '-'), sub: meta.name, icon: meta.icon, hue: meta.hue })
    }
    for (const slug of apps) {
      const name = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (fuzzy(query, name) || fuzzy(query, slug)) list.push({ label: slug, sub: name, icon: Plug, hue: 200 })
    }
    for (const d of documents) {
      if (fuzzy(query, d.name)) list.push({ label: `doc:${d.name}`, sub: `Document · ${d.name}`, icon: FolderOpen, hue: 150 })
    }
    return list.slice(0, 10)
  }, [connected, apps, documents, query])

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
          No connected sources yet. Connect apps in the Marketplace in the sidebar, or upload documents in Read &amp; Quiz.
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
