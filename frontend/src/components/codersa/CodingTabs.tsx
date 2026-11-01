import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderGit2 } from 'lucide-react'
import { CodersaMascot } from './CodersaMascot'

/** The two sections of Coding: the project workbench, and Codersa, the agent. */
export function CodingTabs({ active }: { active: 'projects' | 'codersa' }) {
  const navigate = useNavigate()
  const tabs: { id: 'projects' | 'codersa'; to: string; label: React.ReactNode }[] = [
    { id: 'projects', to: '/code', label: <><FolderGit2 size={13} strokeWidth={1.8} /> Projects</> },
    { id: 'codersa', to: '/code/codersa', label: <><CodersaMascot size={16} title="" /> Codersa</> },
  ]
  return (
    <div role="tablist" aria-label="Coding sections" className="inline-flex p-1 rounded-[14px] gap-1"
      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => { if (!on) navigate(t.to) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text-3)',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12), 0 0 0 1px var(--surface-border)' : 'none',
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
