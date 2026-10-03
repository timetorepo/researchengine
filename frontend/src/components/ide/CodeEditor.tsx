import React, { useEffect, useMemo, useRef, useState } from 'react'
import { highlight } from '@/lib/highlight'

/**
 * Lightweight code editor: a transparent textarea layered over a highlighted
 * <pre>, with a synced gutter. Keeps the streaming-friendly simplicity of a
 * textarea (undo, IME, selection all work natively) while looking like an IDE.
 */
export function CodeEditor({
  value, onChange, onSave, path, readOnly = false, wrap = false, gotoLine = 0, onCaret,
}: {
  value: string
  onChange: (v: string) => void
  onSave?: () => void
  path: string | null
  readOnly?: boolean
  wrap?: boolean
  /** Scroll to (and select) a 1-based line — used by search results. */
  gotoLine?: number
  /** Report the caret upward for the status bar. Optional: the editor stands alone without it. */
  onCaret?: (c: { line: number; col: number }) => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ top: 0, left: 0 })
  const [caret, setCaret] = useState({ line: 1, col: 1 })

  const html = useMemo(() => highlight(value) + '\n', [value])
  const lineCount = useMemo(() => value.split('\n').length, [value])

  const syncScroll = () => {
    const ta = taRef.current
    if (!ta) return
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft })
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
  }

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    if (gotoLine > 1) {
      // Centre the requested line, then select it so the jump is obvious.
      const lines = value.split('\n')
      const offset = lines.slice(0, gotoLine - 1).reduce((n, l) => n + l.length + 1, 0)
      ta.focus()
      ta.setSelectionRange(offset, offset + (lines[gotoLine - 1]?.length ?? 0))
      ta.scrollTop = Math.max(0, (gotoLine - 3) * 1.62 * 12.5)
      syncScroll()
      setCaret({ line: gotoLine, col: 1 })
      return
    }
    // A fresh file starts at the top.
    ta.scrollTop = 0
    ta.scrollLeft = 0
    syncScroll()
    setCaret({ line: 1, col: 1 })
  }, [path, gotoLine])

  // One call per caret move, and only here: the parent's handler is a ref write.
  useEffect(() => { onCaret?.({ line: caret.line, col: caret.col }) }, [caret.line, caret.col])

  const updateCaret = () => {
    const ta = taRef.current
    if (!ta) return
    const upto = value.slice(0, ta.selectionStart)
    const lines = upto.split('\n')
    setCaret({ line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 })
  }

  const shared: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 12.5,
    lineHeight: 1.62,
    padding: '14px 16px',
    tabSize: 2,
  }

  return (
    <div className="flex-1 min-h-0 flex" style={{ background: 'var(--ide-code-bg, var(--code-bg))' }}>
      {/* gutter */}
      <div ref={gutterRef} aria-hidden
        className="shrink-0 overflow-hidden select-none text-right"
        style={{ width: 52, paddingTop: 14, paddingBottom: 14, borderRight: '1px solid var(--ide-border, var(--surface-border))', background: 'var(--ide-code-bg, var(--code-bg))' }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="tabular-nums pr-3 font-mono"
            style={{ fontSize: 11.5, lineHeight: 1.62 * 12.5, color: caret.line === i + 1 ? 'var(--ide-dim, var(--text-2))' : 'var(--ide-faint, var(--text-3))', opacity: caret.line === i + 1 ? 1 : 0.55 }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* code */}
      <div className="relative flex-1 min-w-0">
        <pre ref={preRef} aria-hidden
          className="absolute inset-0 m-0 overflow-hidden pointer-events-none"
          style={{ ...shared, whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-word' : 'normal', color: 'var(--ide-text, var(--text))' }}
          dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); requestAnimationFrame(updateCaret) }}
          onScroll={syncScroll}
          onClick={updateCaret}
          onKeyUp={updateCaret}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave?.() }
            if (e.key === 'Tab') {
              e.preventDefault()
              const ta = e.currentTarget
              const { selectionStart: s, selectionEnd: en } = ta
              const next = value.slice(0, s) + '  ' + value.slice(en)
              onChange(next)
              requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2))
            }
          }}
          spellCheck={false}
          readOnly={readOnly}
          aria-label={path ? `Editor: ${path}` : 'Code editor'}
          placeholder="Open a file from the explorer — or ask the AI to create one."
          className="absolute inset-0 w-full h-full resize-none outline-none bg-transparent"
          style={{ ...shared, whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-word' : 'normal', color: 'transparent', caretColor: 'var(--ide-accent, var(--primary))', overflow: 'auto' }}
        />
      </div>

      {/* position readout lives in the status bar; keep the gutter clean */}
      <span className="hidden">{caret.line}:{caret.col}:{scroll.top}</span>
    </div>
  )
}
