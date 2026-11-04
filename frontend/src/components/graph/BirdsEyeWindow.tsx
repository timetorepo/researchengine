import React, { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Network } from 'lucide-react'

/**
 * The bird's-eye graph window. The chat opens it from a "Bird's-eye graph" note
 * after an agent saves something; it can also be opened from anywhere with
 * openBirdsEye(). It draws the saved graph as a ring of labelled nodes with their
 * edges, and it reloads the graph every time it opens.
 */

export const BIRDS_EYE_OPEN_EVENT = 'research-engine:open-birds-eye'

export function openBirdsEye(): void {
  window.dispatchEvent(new Event(BIRDS_EYE_OPEN_EVENT))
}

interface GraphNode { id: string; label: string; kind: string }
interface GraphEdge { id: string; from: string; to: string; label: string }
interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

const W = 800
const H = 520
const PALETTE = ['var(--primary)', '#34c759', '#ff9f0a', '#bf5af2', '#64d2ff', '#ff453a']

/** Positions on a ring, in the order the nodes were saved. Pure, so it is easy to read and test. */
export function ringLayout(count: number, width = W, height = H): { x: number; y: number }[] {
  if (count === 0) return []
  if (count === 1) return [{ x: width / 2, y: height / 2 }]
  const r = Math.min(width, height) * 0.36
  return Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count - Math.PI / 2
    return { x: width / 2 + r * Math.cos(a), y: height / 2 + r * Math.sin(a) }
  })
}

export function colorForKind(kind: string, kinds: string[]): string {
  const i = Math.max(0, kinds.indexOf(kind))
  return PALETTE[i % PALETTE.length]
}

export function BirdsEyeWindow() {
  const [open, setOpen] = useState(false)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/graph')
      if (!res.ok) throw new Error(`The server answered ${res.status}.`)
      setGraph(await res.json())
      setError(null)
    } catch (e: any) {
      setError(`The graph could not be loaded (${String(e?.message ?? e)}).`)
    }
  }

  useEffect(() => {
    const onOpen = () => { setOpen(true); void load() }
    window.addEventListener(BIRDS_EYE_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(BIRDS_EYE_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const layout = useMemo(() => ringLayout(graph?.nodes.length ?? 0), [graph])
  const kinds = useMemo(() => [...new Set((graph?.nodes ?? []).map((n) => n.kind))], [graph])
  const index = useMemo(() => new Map((graph?.nodes ?? []).map((n, i) => [n.id, i])), [graph])

  if (!open) return null

  const clear = async () => {
    if (!window.confirm('Clear the whole bird\'s-eye graph? This cannot be undone.')) return
    await fetch('/api/graph', { method: 'DELETE' })
    await load()
  }

  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={() => setOpen(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Bird's-eye graph"
        data-ui="birds-eye-window"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[880px] overflow-hidden rounded-[22px] border shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
      >
        <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <Network size={16} style={{ color: 'var(--primary)' }} />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Bird&rsquo;s-eye graph</h2>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge{edges.length === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={clear} disabled={!nodes.length}
              className="p-2 rounded-lg hover:bg-[var(--elevated)] disabled:opacity-40" aria-label="Clear the graph" title="Clear the graph">
              <Trash2 size={15} style={{ color: 'var(--text-3)' }} />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-[var(--elevated)]" aria-label="Close the graph window" title="Close (Esc)">
              <X size={15} style={{ color: 'var(--text-3)' }} />
            </button>
          </div>
        </header>

        <div className="relative" style={{ background: 'var(--bg)' }}>
          {error ? (
            <p className="p-8 text-center text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>
          ) : !graph ? (
            <p className="p-8 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>Loading the graph…</p>
          ) : nodes.length === 0 ? (
            <p className="p-8 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>
              Nothing is saved yet. When the assistant saves something from a chat or a coding session, it appears here.
            </p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`${nodes.length} nodes and ${edges.length} edges`}>
              {edges.map((e) => {
                const a = index.get(e.from)
                const b = index.get(e.to)
                if (a === undefined || b === undefined) return null
                const p = layout[a]
                const q = layout[b]
                return (
                  <g key={e.id}>
                    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--surface-border)" strokeWidth={1.5} />
                    {edges.length <= 60 && (
                      <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} fontSize={10} textAnchor="middle" fill="var(--text-3)">{e.label}</text>
                    )}
                  </g>
                )
              })}
              {nodes.map((n, i) => {
                const p = layout[i]
                const left = p.x < W / 2
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={7} fill={colorForKind(n.kind, kinds)} />
                    <text x={p.x + (left ? -12 : 12)} y={p.y + 4} fontSize={12} textAnchor={left ? 'end' : 'start'} fill="var(--text)">
                      {n.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </section>
    </div>
  )
}

export default BirdsEyeWindow
