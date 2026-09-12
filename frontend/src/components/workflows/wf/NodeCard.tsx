// One workflow node card: 320px, 16px radius, icon block, overline + title,
// 3px left accent bar by kind, `...` menu, branch handles when defined.
import React, { memo, useEffect, useRef, useState } from 'react'
import { Check, Copy, MoreHorizontal, PowerOff, Trash2, X } from 'lucide-react'
import type { WorkflowNode, NodeRunStatus } from '@/lib/workflows/types'
import { NODE_W } from '@/lib/workflows/types'
import { nodeDef, KIND_COLOR, KIND_LABEL } from '@/lib/workflows/library'

export const NODE_H = 84

interface Props {
  node: WorkflowNode
  selected: boolean
  status?: NodeRunStatus
  onPointerDown: (e: React.PointerEvent, node: WorkflowNode) => void
  onOpenConfig: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleDisable: (id: string) => void
  onDelete: (id: string) => void
}

export const NodeCard = memo(function NodeCard({
  node, selected, status, onPointerDown, onOpenConfig, onDuplicate, onToggleDisable, onDelete,
}: Props) {
  const def = nodeDef(node.type)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  if (!def) return null
  const Icon = def.icon
  const accent = KIND_COLOR[node.kind]

  const running = status === 'running'
  const ok = status === 'ok'
  const err = status === 'error'
  const disabled = node.disabled

  return (
    <div
      data-wf-node={node.id}
      onPointerDown={(e) => onPointerDown(e, node)}
      onDoubleClick={() => onOpenConfig(node.id)}
      className="absolute select-none"
      style={{
        left: node.x, top: node.y, width: NODE_W, height: NODE_H,
        borderRadius: 16,
        background: 'var(--elevated)',
        border: `1px solid ${selected ? 'var(--primary)' : err ? 'var(--danger)' : 'var(--surface-border)'}`,
        boxShadow: running
          ? `0 0 0 3px color-mix(in srgb, ${accent} 30%, transparent), 0 8px 28px -8px color-mix(in srgb, ${accent} 45%, transparent)`
          : selected ? '0 8px 28px -10px rgba(0,0,0,0.5)' : '0 2px 10px -4px rgba(0,0,0,0.35)',
        opacity: disabled ? 0.45 : 1,
        cursor: 'grab',
        animation: running ? 'wf-pulse 1.2s ease-in-out infinite' : err ? 'wf-shake 0.4s ease' : undefined,
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: accent }} />

      <div className="flex items-center gap-3 h-full pl-4 pr-2">
        {/* icon block */}
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{
            background: def.gradient
              ? 'linear-gradient(135deg, #6C8EEF 0%, #A78BFA 55%, #22D3EE 110%)'
              : `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: def.gradient ? '#fff' : accent,
          }}>
          <Icon size={19} strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: accent }}>
            {KIND_LABEL[node.kind]}{disabled ? ' · off' : ''}
          </div>
          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{node.label || def.name}</div>
        </div>

        {/* status badge */}
        {ok && <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' }}><Check size={12} strokeWidth={3} /></span>}
        {err && <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--danger) 18%, transparent)', color: 'var(--danger)' }}><X size={12} strokeWidth={3} /></span>}

        {/* menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMenu((m) => !m) }}
            className="w-6 h-6 rounded-[8px] flex items-center justify-center hover:bg-[var(--surface)]"
            style={{ color: 'var(--text-3)' }}
            aria-label="Node menu"
          >
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <div className="absolute right-0 top-7 z-30 w-40 rounded-[12px] py-1"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5)' }}>
              <MenuItem icon={<Copy size={13} />} label="Duplicate" onClick={() => { setMenu(false); onDuplicate(node.id) }} />
              <MenuItem icon={<PowerOff size={13} />} label={disabled ? 'Enable' : 'Disable'} onClick={() => { setMenu(false); onToggleDisable(node.id) }} />
              <MenuItem icon={<Copy size={13} />} label="Copy ID" onClick={() => { navigator.clipboard.writeText(node.id); setMenu(false) }} />
              <div className="h-px my-1" style={{ background: 'var(--surface-border)' }} />
              <MenuItem icon={<Trash2 size={13} />} label="Delete" danger onClick={() => { setMenu(false); onDelete(node.id) }} />
            </div>
          )}
        </div>
      </div>

      {/* branch handles */}
      {def.handles && def.handles.map((h, i) => {
        const total = def.handles!.length
        const left = ((i + 1) / (total + 1)) * NODE_W
        return (
          <div key={h.id} className="absolute -bottom-[15px] flex flex-col items-center" style={{ left: left - 16, width: 32 }}>
            <div className="w-3 h-3 rounded-full border-2" style={{ background: 'var(--elevated)', borderColor: accent }} />
            <div className="text-[8.5px] font-medium mt-[1px]" style={{ color: 'var(--text-3)' }}>{h.label}</div>
          </div>
        )
      })}
    </div>
  )
})

function MenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-[var(--surface)]"
      style={{ color: danger ? 'var(--danger)' : 'var(--text-2)' }}>
      {icon}{label}
    </button>
  )
}
