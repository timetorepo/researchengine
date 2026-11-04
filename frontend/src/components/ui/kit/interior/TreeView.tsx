// Interior-style tree view: nested, expandable nodes. Arrow keys move through
// the visible rows, Right/Left expand and collapse, Enter selects.
import { useState, useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export type TreeNode = { id: string; label: string; children?: TreeNode[] }

export function useTreeView(initialOpen: string[] = []) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen))
  // The tree often arrives after mount (a project loads its files). Open the
  // requested folders when they first show up, but never re-open ones the user closed.
  const initialKey = initialOpen?.join('\n') ?? ''
  const seeded = useRef(new Set<string>())
  useEffect(() => {
    const paths = initialKey ? initialKey.split('\n') : []
    const fresh = paths.filter((p) => !seeded.current.has(p))
    if (!fresh.length) return
    fresh.forEach((p) => seeded.current.add(p))
    setOpen((prev) => new Set([...prev, ...fresh]))
  }, [initialKey])
  const [focus, setFocus] = useState<string | null>(null)
  const toggle = useCallback((id: string, force?: boolean) => {
    setOpen((s) => {
      const n = new Set(s)
      const want = force ?? !n.has(id)
      if (want) n.add(id); else n.delete(id)
      return n
    })
  }, [])
  return { open, toggle, focus, setFocus }
}

type Row = { node: TreeNode; depth: number; parent?: string }

export function TreeView({ nodes, selectedId, onSelect, label = 'Files', initialOpen, renderTrailing }: {
  nodes: TreeNode[]; selectedId?: string; onSelect?: (node: TreeNode) => void; label?: string; initialOpen?: string[]
  /** Optional controls at the end of a row (for example, delete). Clicks there do not select the row. */
  renderTrailing?: (node: TreeNode) => ReactNode
}) {
  const { open, toggle, focus, setFocus } = useTreeView(initialOpen)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (list: TreeNode[], depth: number, parent?: string) => {
      for (const n of list) {
        out.push({ node: n, depth, parent })
        if (n.children?.length && open.has(n.id)) walk(n.children, depth + 1, n.id)
      }
    }
    walk(nodes, 0)
    return out
  }, [nodes, open])

  const move = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))]
    if (!r) return
    setFocus(r.node.id)
    refs.current[r.node.id]?.focus()
  }

  const onKey = (e: KeyboardEvent, i: number, row: Row) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'ArrowRight') {
      if (row.node.children?.length) { e.preventDefault(); if (!open.has(row.node.id)) toggle(row.node.id, true); else move(i + 1) }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (row.node.children?.length && open.has(row.node.id)) toggle(row.node.id, false)
      else if (row.parent) move(rows.findIndex((r) => r.node.id === row.parent))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); onSelect?.(row.node)
    }
  }

  return (
    <div role="tree" aria-label={label} className="text-[12.5px] select-none">
      {rows.map((row, i) => {
        const isOpen = open.has(row.node.id)
        const branch = !!row.node.children?.length
        const selected = row.node.id === selectedId
        return (
          <div key={row.node.id} role="treeitem" aria-level={row.depth + 1} aria-expanded={branch ? isOpen : undefined} aria-selected={selected}
            ref={(el) => { refs.current[row.node.id] = el }} tabIndex={(focus ?? rows[0]?.node.id) === row.node.id ? 0 : -1}
            onKeyDown={(e) => onKey(e, i, row)} onFocus={() => setFocus(row.node.id)}
            onClick={() => { if (branch) toggle(row.node.id); onSelect?.(row.node) }}
            className="group flex items-center gap-1.5 h-7 rounded-[6px] pr-2 cursor-pointer outline-none focus-visible:ring-1"
            style={{ paddingLeft: 6 + row.depth * 14, background: selected ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent', color: selected ? 'var(--text)' : 'var(--text-2)' }}>
            <ChevronRight size={12} aria-hidden className="shrink-0 transition-transform duration-150"
              style={{ opacity: branch ? 1 : 0, transform: isOpen ? 'rotate(90deg)' : 'none' }} />
            <button type="button" tabIndex={-1} className="truncate flex-1 text-left outline-none">{row.node.label}</button>
            {renderTrailing && <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>{renderTrailing(row.node)}</span>}
          </div>
        )
      })}
    </div>
  )
}
