/* BoardUI tree layout adaptation with an original windowed renderer for large local workspaces. MIT; see LICENSE. */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight, FileCode2, FileText, Folder, FolderOpen } from 'lucide-react'
export type TreeNode = { id: string; label: string; children?: TreeNode[] }
type Row = { node: TreeNode; depth: number; parent?: string; pos: number; size: number }
const ROW = 28
export function TreeView({ nodes, selectedId, onSelect, label = 'Files', initialOpen = [], renderTrailing, persistenceKey }: {
  nodes: TreeNode[]; selectedId?: string; onSelect?: (node: TreeNode) => void; label?: string; initialOpen?: string[]
  renderTrailing?: (node: TreeNode) => ReactNode; persistenceKey?: string
}) {
  const [open, setOpen] = useState<Set<string>>(() => {
    try { const value = persistenceKey && localStorage.getItem(`re.tree.${persistenceKey}`); if (value) { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === 'string')) } } catch { /* storage unavailable */ }
    return new Set(initialOpen)
  })
  const [focus, setFocus] = useState<string | null>(null)
  const [scroll, setScroll] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const seeded = useRef(false)
  const typeahead = useRef({ text: '', at: 0 })
  useEffect(() => {
    if (seeded.current || !nodes.length) return
    seeded.current = true
    try { if (persistenceKey && localStorage.getItem(`re.tree.${persistenceKey}`)) return } catch { /* storage unavailable */ }
    setOpen(new Set(initialOpen))
  }, [nodes, initialOpen, persistenceKey])
  useEffect(() => { if (persistenceKey && seeded.current) { try { localStorage.setItem(`re.tree.${persistenceKey}`, JSON.stringify([...open])) } catch { /* storage unavailable */ } } }, [open, persistenceKey])
  const toggle = useCallback((id: string, value?: boolean) => setOpen((current) => { const next = new Set(current); if (value ?? !next.has(id)) next.add(id); else next.delete(id); return next }), [])
  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (items: TreeNode[], depth: number, parent?: string) => items.forEach((node, index) => {
      out.push({ node, depth, parent, pos: index + 1, size: items.length })
      if (node.children && open.has(node.id)) walk(node.children, depth + 1, node.id)
    })
    walk(nodes, 0); return out
  }, [nodes, open])
  const windowed = rows.length > 200
  const activeId = focus && rows.some((r) => r.node.id === focus) ? focus : selectedId && rows.some((r) => r.node.id === selectedId) ? selectedId : rows[0]?.node.id
  const move = (index: number) => {
    const i = Math.max(0, Math.min(rows.length - 1, index)); const item = rows[i]; if (!item) return
    setFocus(item.node.id)
    if (root.current && windowed) {
      const top = i * ROW
      if (top < root.current.scrollTop) root.current.scrollTop = top
      else if (top + ROW > root.current.scrollTop + root.current.clientHeight) root.current.scrollTop = top + ROW - root.current.clientHeight
      setScroll(root.current.scrollTop)
    }
    requestAnimationFrame(() => refs.current[item.node.id]?.focus())
  }
  const keyboard = (event: KeyboardEvent, index: number, row: Row) => {
    const { key } = event
    if (['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(key)) event.preventDefault()
    if (key === 'ArrowDown') move(index + 1)
    else if (key === 'ArrowUp') move(index - 1)
    else if (key === 'Home') move(0)
    else if (key === 'End') move(rows.length - 1)
    else if (key === 'ArrowRight' && row.node.children) { if (!open.has(row.node.id)) toggle(row.node.id, true); else if (row.node.children.length) move(index + 1) }
    else if (key === 'ArrowLeft') { if (row.node.children && open.has(row.node.id)) toggle(row.node.id, false); else if (row.parent) move(rows.findIndex((r) => r.node.id === row.parent)) }
    else if (key === 'Enter' || key === ' ') { if (row.node.children) toggle(row.node.id); else onSelect?.(row.node) }
    else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeahead.current = { text: (Date.now() - typeahead.current.at < 700 ? typeahead.current.text : '') + key.toLowerCase(), at: Date.now() }
      for (let offset = 1; offset <= rows.length; offset++) { const i = (index + offset) % rows.length; if (rows[i].node.label.toLowerCase().startsWith(typeahead.current.text)) { move(i); break } }
    }
  }
  const start = windowed ? Math.max(0, Math.floor(scroll / ROW) - 6) : 0
  const end = windowed ? Math.min(rows.length, start + 42) : rows.length
  const visible = rows.slice(start, end)
  return <div ref={root} role="tree" aria-label={label} className="bui-tree" onScroll={(e) => { if (windowed) setScroll(e.currentTarget.scrollTop) }} style={windowed ? { height: 480, maxHeight: '60dvh', overflow: 'auto' } : undefined}>
    {windowed && <div role="presentation" style={{ height: start * ROW }} />}
    {visible.map((row, offset) => {
      const branch = row.node.children !== undefined; const isOpen = open.has(row.node.id)
      const Icon = branch ? isOpen ? FolderOpen : Folder : /\.(tsx?|jsx?|json|css|html|py|rs|go|sh)$/.test(row.node.label) ? FileCode2 : FileText
      return <div key={row.node.id} role="treeitem" aria-level={row.depth + 1} aria-posinset={row.pos} aria-setsize={row.size} aria-expanded={branch ? isOpen : undefined} aria-selected={row.node.id === selectedId}
        ref={(el) => { if (el) refs.current[row.node.id] = el; else delete refs.current[row.node.id] }} tabIndex={(visible.some((r) => r.node.id === activeId) ? activeId === row.node.id : offset === 0) ? 0 : -1}
        onKeyDown={(e) => keyboard(e, start + offset, row)} onFocus={() => setFocus(row.node.id)} onClick={() => { if (branch) toggle(row.node.id); else onSelect?.(row.node) }}
        className="bui-tree-row group" style={{ paddingInlineStart: 6 + row.depth * 14 }}>
        <ChevronRight size={12} className="shrink-0" style={{ visibility: branch ? 'visible' : 'hidden', transform: isOpen ? 'rotate(90deg)' : undefined }} aria-hidden="true" /><Icon size={14} className="shrink-0 text-[var(--text-3)]" aria-hidden="true" />
        <span className="truncate flex-1">{row.node.label}</span>{renderTrailing && <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100" onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>{renderTrailing(row.node)}</span>}
      </div>
    })}
    {windowed && <div role="presentation" style={{ height: (rows.length - end) * ROW }} />}
  </div>
}
