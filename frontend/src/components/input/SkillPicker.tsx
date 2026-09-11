import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Wand2, CornerDownLeft } from 'lucide-react'
import type { Skill } from '@/types'
import { useStore } from '@/stores/useStore'
import { fuzzy } from '@/lib/utils'

export function SkillPicker({ query, onPick, onClose }: { query: string; onPick: (s: Skill) => void; onClose: () => void }) {
  const skills = useStore((s) => s.skills)

  const groups = useMemo(() => {
    const scored = skills
      .map((s) => ({ s, score: Math.max(fuzzy(query, s.name), fuzzy(query, s.description)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    const byCat = new Map<string, Skill[]>()
    for (const { s } of scored) {
      if (!byCat.has(s.category)) byCat.set(s.category, [])
      byCat.get(s.category)!.push(s)
    }
    return [...byCat.entries()]
  }, [skills, query])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute left-2 right-2 bottom-full mb-2 max-h-72 overflow-y-auto surface-elevated p-1.5 z-40"
      style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
      role="listbox" aria-label="Skills"
    >
      {groups.length === 0 && (
        <div className="px-3 py-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>No skills match "{query}"</div>
      )}
      {groups.map(([cat, list]) => (
        <div key={cat}>
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{cat}</div>
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left hover:bg-[var(--surface)]"
            >
              <span className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--secondary) 18%, transparent)', color: 'var(--secondary)' }}>
                <Wand2 size={12.5} strokeWidth={1.5} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] truncate">{s.name}</span>
                <span className="block text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{s.description}</span>
              </span>
              <CornerDownLeft size={12} style={{ color: 'var(--text-3)' }} />
            </button>
          ))}
        </div>
      ))}
    </motion.div>
  )
}
