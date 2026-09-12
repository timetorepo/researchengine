// Infinite canvas: pan (drag / space / middle mouse), zoom (ctrl-wheel, pinch),
// dot grid, node dragging with snap, shift-marquee multi-select, minimap.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Workflow, WorkflowNode, WorkflowEdge, NodeRunStatus } from '@/lib/workflows/types'
import { NODE_W } from '@/lib/workflows/types'
import { NodeCard, NODE_H } from './NodeCard'
import { EdgeLayer } from './EdgeLayer'

export interface CanvasHandle {
  fitView: () => void
  zoomBy: (f: number) => void
  getScale: () => number
}

interface Props {
  wf: Workflow
  snap: boolean
  showMinimap: boolean
  nodeStatus: Record<string, NodeRunStatus>
  activeEdges: Set<string>
  selected: string[]
  onSelect: (ids: string[]) => void
  onMoveNodes: (moves: Record<string, { x: number; y: number }>) => void
  onOpenConfig: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleDisable: (id: string) => void
  onDeleteNode: (id: string) => void
  onInsertAtEdge: (edgeId: string, x: number, y: number) => void
  onCanvasClick: () => void
  selectedEdge: string | null
  onSelectEdge: (id: string | null) => void
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(props, ref) {
  const { wf, snap, showMinimap } = props
  const outerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 60, y: 40, scale: 1 })
  const viewRef = useRef(view); viewRef.current = view
  const spaceRef = useRef(false)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const dragRef = useRef<null | {
    kind: 'pan' | 'node' | 'marquee'
    startX: number; startY: number
    viewX: number; viewY: number
    nodes?: Record<string, { x: number; y: number }>
    moved: boolean
  }>(null)

  const toWorld = useCallback((cx: number, cy: number) => {
    const rect = outerRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (cx - rect.left - v.x) / v.scale, y: (cy - rect.top - v.y) / v.scale }
  }, [])

  useImperativeHandle(ref, () => ({
    fitView: () => {
      const el = outerRef.current
      if (!el || wf.nodes.length === 0) return
      const xs = wf.nodes.map((n) => n.x), ys = wf.nodes.map((n) => n.y)
      const minX = Math.min(...xs) - 80, minY = Math.min(...ys) - 80
      const maxX = Math.max(...xs) + NODE_W + 80, maxY = Math.max(...ys) + NODE_H + 120
      const w = maxX - minX, h = maxY - minY
      const scale = Math.min(1.15, (el.clientWidth - 80) / w, (el.clientHeight - 80) / h)
      setView({ scale: Math.max(0.2, scale), x: (el.clientWidth - w * scale) / 2 - minX * scale, y: (el.clientHeight - h * scale) / 2 - minY * scale })
    },
    zoomBy: (f: number) => {
      const el = outerRef.current
      if (!el) return
      const v = viewRef.current
      const ns = Math.min(2, Math.max(0.25, v.scale * f))
      const cx = el.clientWidth / 2, cy = el.clientHeight / 2
      setView({ scale: ns, x: cx - ((cx - v.x) / v.scale) * ns, y: cy - ((cy - v.y) / v.scale) * ns })
    },
    getScale: () => viewRef.current.scale,
  }), [wf.nodes])

  // space-to-pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.matches('input,textarea,[contenteditable]')) {
        spaceRef.current = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // wheel: ctrl/pinch = zoom at cursor; plain wheel = pan
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top
        const ns = Math.min(2, Math.max(0.25, v.scale * Math.exp(-e.deltaY * 0.0022)))
        setView({ scale: ns, x: cx - ((cx - v.x) / v.scale) * ns, y: cy - ((cy - v.y) / v.scale) * ns })
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onNodePointerDown = (e: React.PointerEvent, node: WorkflowNode) => {
    if (spaceRef.current || e.button === 1) return // let the pan handler take it
    e.stopPropagation()
    if (e.button !== 0) return
    let sel = props.selected
    if (e.shiftKey) sel = sel.includes(node.id) ? sel.filter((i) => i !== node.id) : [...sel, node.id]
    else if (!sel.includes(node.id)) sel = [node.id]
    props.onSelect(sel)
    const nodes: Record<string, { x: number; y: number }> = {}
    for (const id of (sel.includes(node.id) ? sel : [node.id])) {
      const n = wf.nodes.find((nn) => nn.id === id)
      if (n) nodes[id] = { x: n.x, y: n.y }
    }
    dragRef.current = { kind: 'node', startX: e.clientX, startY: e.clientY, viewX: 0, viewY: 0, nodes, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceRef.current || e.button === 0) {
      const shift = e.shiftKey && e.button === 0 && !spaceRef.current
      const w = toWorld(e.clientX, e.clientY)
      dragRef.current = shift
        ? { kind: 'marquee', startX: e.clientX, startY: e.clientY, viewX: 0, viewY: 0, moved: false }
        : { kind: 'pan', startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y, moved: false }
      if (shift) setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y })
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, x: d.viewX + dx, y: d.viewY + dy }))
    } else if (d.kind === 'marquee') {
      const w = toWorld(e.clientX, e.clientY)
      setMarquee((m) => (m ? { ...m, x1: w.x, y1: w.y } : m))
    } else if (d.kind === 'node' && d.nodes) {
      const s = viewRef.current.scale
      const moves: Record<string, { x: number; y: number }> = {}
      for (const [id, p] of Object.entries(d.nodes)) {
        let nx = p.x + dx / s, ny = p.y + dy / s
        if (snap) { nx = Math.round(nx / 16) * 16; ny = Math.round(ny / 16) * 16 }
        moves[id] = { x: nx, y: ny }
      }
      props.onMoveNodes(moves)
    }
  }

  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (d?.kind === 'marquee' && marquee) {
      const minX = Math.min(marquee.x0, marquee.x1), maxX = Math.max(marquee.x0, marquee.x1)
      const minY = Math.min(marquee.y0, marquee.y1), maxY = Math.max(marquee.y0, marquee.y1)
      const hit = wf.nodes.filter((n) => n.x + NODE_W > minX && n.x < maxX && n.y + NODE_H > minY && n.y < maxY).map((n) => n.id)
      props.onSelect(hit)
      setMarquee(null)
    } else if (d?.kind === 'pan' && !d.moved) {
      props.onSelect([])
      props.onSelectEdge(null)
      props.onCanvasClick()
    } else if (d?.kind === 'node' && d.nodes) {
      // commit already streamed through onMoveNodes
    }
  }

  // ---- minimap ----
  const mm = (() => {
    if (!showMinimap || wf.nodes.length === 0) return null
    const xs = wf.nodes.map((n) => n.x), ys = wf.nodes.map((n) => n.y)
    const minX = Math.min(...xs) - 100, minY = Math.min(...ys) - 100
    const maxX = Math.max(...xs) + NODE_W + 100, maxY = Math.max(...ys) + NODE_H + 100
    const W = 168, H = 104
    const s = Math.min(W / (maxX - minX), H / (maxY - minY))
    const el = outerRef.current
    const vw = el ? el.clientWidth / view.scale : 0
    const vh = el ? el.clientHeight / view.scale : 0
    const vx = el ? -view.x / view.scale : 0
    const vy = el ? -view.y / view.scale : 0
    return { minX, minY, s, W, H, vw, vh, vx, vy }
  })()

  return (
    <div
      ref={outerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        cursor: spaceRef.current ? 'grab' : 'default',
        background: 'var(--base)',
        backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--text-3) 22%, transparent) 1px, transparent 1px)',
        backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        touchAction: 'none',
      }}
      onPointerDown={onBgPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0', position: 'absolute' }}>
        <EdgeLayer
          nodes={wf.nodes} edges={wf.edges} activeEdges={props.activeEdges}
          onInsert={props.onInsertAtEdge} selectedEdge={props.selectedEdge} onSelectEdge={props.onSelectEdge}
        />
        {wf.nodes.map((n) => (
          <NodeCard
            key={n.id} node={n} selected={props.selected.includes(n.id)} status={props.nodeStatus[n.id]}
            onPointerDown={onNodePointerDown}
            onOpenConfig={props.onOpenConfig}
            onDuplicate={props.onDuplicate}
            onToggleDisable={props.onToggleDisable}
            onDelete={props.onDeleteNode}
          />
        ))}
        {marquee && (
          <div className="absolute rounded-[6px]" style={{
            left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
            border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          }} />
        )}
      </div>

      {/* minimap */}
      {mm && (
        <div className="absolute bottom-4 right-4 rounded-[12px] overflow-hidden z-20"
          style={{ width: mm.W, height: mm.H, background: 'color-mix(in srgb, var(--elevated) 92%, transparent)', border: '1px solid var(--surface-border)', backdropFilter: 'blur(6px)' }}>
          <svg width={mm.W} height={mm.H}>
            {wf.nodes.map((n) => (
              <rect key={n.id} x={(n.x - mm.minX) * mm.s} y={(n.y - mm.minY) * mm.s}
                width={NODE_W * mm.s} height={NODE_H * mm.s} rx={2}
                fill="color-mix(in srgb, var(--text-3) 45%, transparent)" />
            ))}
            <rect x={(mm.vx - mm.minX) * mm.s} y={(mm.vy - mm.minY) * mm.s}
              width={mm.vw * mm.s} height={mm.vh * mm.s} rx={3}
              fill="none" stroke="var(--primary)" strokeWidth={1.2} />
          </svg>
        </div>
      )}
    </div>
  )
})
