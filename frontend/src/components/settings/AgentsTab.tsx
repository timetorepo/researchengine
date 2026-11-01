import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ArrowRight } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { fmt } from '@/lib/utils'

export function AgentsTab() {
  const squads = useStore((s) => s.squads)
  const budget = useStore((s) => s.settings.floodBudget)
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <Users size={20} style={{ color: 'var(--secondary)' }} /> Agents
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Preset squads for Agent Flood. Deploy and customize them on the Flood canvas.
      </p>

      <div className="mb-6 surface p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-medium">Hard budget cap (all agents)</span>
          <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)' }}>{fmt(budget)} tok</span>
        </div>
        <input type="range" min={10000} max={1000000} step={10000} value={budget}
          onChange={(e) => useStore.setState((s) => ({ settings: { ...s.settings, floodBudget: Number(e.target.value) } }))}
          className="w-full accent-[var(--secondary)]" aria-label="Flood budget cap" />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Agents halt when the combined token budget is hit.</p>
      </div>

      <div className="space-y-3">
        {squads.map((sq) => (
          <div key={sq.id} className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-[14px]">{sq.name}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{sq.description}</div>
              </div>
              <button onClick={() => navigate('/flood')} className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--secondary)' }}>
                Open <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sq.agents.map((a) => (
                <span key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px]"
                  style={{ background: `${a.color}1a`, color: a.color, border: `1px solid ${a.color}33` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color }} />
                  {a.name} · {a.role}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
