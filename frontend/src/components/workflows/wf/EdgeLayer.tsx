// Stepped orthogonal edges with rounded corners, animated during runs, and an
// inline "+" on each connector that inserts a node at that point.
import React, { useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { WorkflowNode, WorkflowEdge } from '@/lib/workflows/types'
import { NODE_W } from '@/lib/workflows/types'
import { NODE_H } from './NodeCard'
import { nodeDef, KIND_COLOR } from '@/lib/workflows/library'

const R = 8 // corner radius

export function edgeAnchors(from: WorkflowNode, edge: WorkflowEdge) {
  const def = nodeDef(from.type)
  let sx = from.x + NODE_W / 2
  if (def?.handles && edge.fromHandle) {
    const idx = def.handles.findIndex((h) => h.id === edge.fromHandle)
    if (idx >= 0) sx = from.x + ((idx + 1) / (def.handles.length + 1)) * NODE_W
  }
  return { sx, sy: from.y + NODE_H, }
}

/** Stepped orthogonal path from bottom of `from` to top of `to`, rounded corners. */
export function steppedPath(from: WorkflowNode, to: WorkflowNode, edge: WorkflowEdge): { d: string; mx: number; my: number } {
  const { sx, sy } = edgeAnchors(from, edge)
  const tx = to.x + NODE_W / 2
  const ty = to.y
  const midY = (sy + ty) / 2

  // Straight vertical drop when aligned
  if (Math.abs(sx - tx) < 1) return { d: `M ${sx} ${sy} L ${tx} ${ty}`, mx: sx, my: midY }

  const dir = tx > sx ? 1 : -1
  const r = Math.min(R, Math.abs(tx - sx) / 2, Math.abs(midY - sy), Math.abs(ty - midY))
  const d = [
    `M ${sx} ${sy}`,
    `L ${sx} ${midY - r}`,
    `Q ${sx} ${midY} ${sx + r * dir} ${midY}`,
    `L ${tx - r * dir} ${midY}`,
    `Q ${tx} ${midY} ${tx} ${midY + r}`,
    `L ${tx} ${ty}`,
  ].join(' ')
  return { d, mx: (sx + tx) / 2, my: midY }
}

interface Props {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  activeEdges: Set<string>
  onInsert: (edgeId: string, x: number, y: number) => void
  selectedEdge: string | null
  onSelectEdge: (id: string | null) => void
}

export function EdgeLayer({ nodes, edges, activeEdges, onInsert, selectedEdge, onSelectEdge }: Props) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  return (
    <>
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {edges.map((e) => {
          const from = byId[e.from], to = byId[e.to]
          if (!from || !to) return null
          const { d } = steppedPath(from, to, e)
          const active = activeEdges.has(e.id)
          const isSel = selectedEdge === e.id
          const accent = KIND_COLOR[from.kind]
          return (
            <g key={e.id}>
              {/* fat invisible hit area */}
              <path d={d} stroke="transparent" strokeWidth={14} fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={() => onSelectEdge(isSel ? null : e.id)} />
              <path d={d} fill="none"
                stroke={isSel ? 'var(--primary)' : active ? accent : 'var(--surface-border)'}
                strokeWidth={isSel || active ? 2 : 1.5}
                strokeDasharray={active ? '6 5' : undefined}
                style={{ transition: 'stroke 0.2s ease' }}
              >
                {active && <animate attributeName="stroke-dashoffset" from="22" to="0" dur="0.6s" repeatCount="indefinite" />}
              </path>
              {active && (
                <circle r={3.5} fill={accent}>
                  <animateMotion dur="0.9s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          )
        })}
      </svg>

      {/* inline + buttons */}
      {edges.map((e) => {
        const from = byId[e.from], to = byId[e.to]
        if (!from || !to) return null
        const { mx, my } = steppedPath(from, to, e)
        return (
          <button
            key={`ins-${e.id}`}
            title="Insert a node here"
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => { ev.stopPropagation(); onInsert(e.id, mx, my) }}
            className="absolute w-[18px] h-[18px] rounded-full flex items-center justify-center z-10 transition-transform hover:scale-110"
            style={{
              left: mx - 9, top: my - 9,
              background: 'var(--elevated)', border: '1px solid var(--surface-border)',
              color: 'var(--text-3)', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.4)',
            }}
            aria-label="Insert node"
          >
            <Plus size={11} strokeWidth={2.5} />
          </button>
        )
      })}
    </>
  )
}
