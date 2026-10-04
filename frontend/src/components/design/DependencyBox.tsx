/**
 * The box.
 *
 * A cart, but for install lines. You save components and packages from any
 * provider as you browse, and when you are done you copy the whole thing once —
 * instead of walking back to five websites and copy-pasting nine commands.
 *
 * The lines are derived from the entries and the package manager *at copy time*,
 * so switching from npm to pnpm silently rewrites every line rather than leaving
 * a stale command in the box.
 */
import React, { useMemo, useState } from 'react'
import { ClipboardCopy, Check, Trash2, PackageMinus, Terminal } from 'lucide-react'
import { boxAsScript, boxLines, useDesign } from '@/stores/useDesign'
import { MANAGERS } from '@/lib/design/providers'

export function DependencyBox({ compact = false }: { compact?: boolean }) {
  const box = useDesign((s) => s.box)
  const manager = useDesign((s) => s.manager)
  const setManager = useDesign((s) => s.setManager)
  const removeFromBox = useDesign((s) => s.removeFromBox)
  const clearBox = useDesign((s) => s.clearBox)
  const [copied, setCopied] = useState<'all' | string | null>(null)

  const lines = useMemo(() => boxLines(box, manager), [box, manager])

  const copy = async (text: string, key: 'all' | string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1400)
    } catch { /* clipboard blocked — the user can still select the text */ }
  }

  const script = boxAsScript(box, manager)

  return (
    <div className="flex flex-col gap-2 min-h-0" data-dependency-box>
      <div className="flex items-center gap-2">
        <Terminal size={12} style={{ color: 'var(--ide-dim, var(--text-3))' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>
          Dependency box
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          {box.length ? `${box.length} saved` : 'empty'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {MANAGERS.map((m) => (
            <button key={m.id} onClick={() => setManager(m.id)}
              className="px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-mono"
              style={{
                background: manager === m.id ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'transparent',
                color: manager === m.id ? 'var(--primary)' : 'var(--ide-faint, var(--text-3))',
              }}>
              {m.id}
            </button>
          ))}
        </div>
      </div>

      {!box.length ? (
        <p className={compact ? 'text-[11px]' : 'text-[11.5px]'} style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          Nothing saved yet. Go to Components and press <b>Save</b> on anything you want, then come back here and copy the whole
          block in one go.
        </p>
      ) : (
        <>
          <div className="min-h-0 overflow-y-auto flex flex-col gap-1 pr-1" style={{ maxHeight: compact ? 240 : 320 }}>
            {lines.map((l) => (
              <div key={l.command} className="group flex items-center gap-2 rounded-[8px] px-2 py-1"
                style={{ background: 'var(--ide-hover, var(--elevated))' }}>
                <code className="flex-1 min-w-0 truncate text-[11px] font-mono" style={{ color: 'var(--ide-text, var(--text))' }}>
                  {l.command}
                </code>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{l.provider}</span>
                <button title="Copy this line" onClick={() => copy(l.command, l.command)}
                  className="opacity-0 group-hover:opacity-100 p-1" style={{ color: 'var(--ide-dim, var(--text-3))' }}>
                  {copied === l.command ? <Check size={11} style={{ color: 'var(--success)' }} /> : <ClipboardCopy size={11} />}
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => copy(script, 'all')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11.5px] font-medium"
              style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
              {copied === 'all' ? <Check size={12} /> : <ClipboardCopy size={12} />}
              {copied === 'all' ? 'Copied all' : `Copy all ${lines.length} line${lines.length === 1 ? '' : 's'}`}
            </button>
            <button onClick={() => copy(box.map((b) => b.item).join(' '), 'names')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11.5px]"
              style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
              {copied === 'names' ? <Check size={12} /> : <PackageMinus size={12} />} Copy names only
            </button>
            <button onClick={clearBox} className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-[9px] text-[11px]"
              style={{ color: 'var(--ide-faint, var(--text-3))' }}>
              <Trash2 size={11} /> Empty the box
            </button>
          </div>

          <details className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            <summary className="cursor-pointer">What gets copied</summary>
            <pre className="mt-1 p-2 rounded-[8px] overflow-x-auto text-[10.5px] font-mono"
              style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>{script}</pre>
          </details>

          {!compact && (
            <div className="flex flex-wrap gap-1 pt-1">
              {box.map((b) => (
                <button key={b.id} onClick={() => removeFromBox(b.id)} title={`Remove ${b.item}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px]"
                  style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
                  {b.item} <Trash2 size={9} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Emitted once here so the box and the hub agree on the managers. */
export const MANAGER_NOTE = 'Switching manager rewrites every line in the box.'
