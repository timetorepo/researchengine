// Right slide-over for node configuration: dynamic fields from the library
// definition, inline validation, variable injection, and a live single-node
// test against a sample input.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Braces, FlaskConical, X } from 'lucide-react'
import type { Workflow, WorkflowNode } from '@/lib/workflows/types'
import { nodeDef, type FieldDef } from '@/lib/workflows/library'
import { WorkflowExecutor } from '@/lib/workflows/executor'
import { useStore } from '@/stores/useStore'
import { nanoid } from 'nanoid'
import { toDisplay } from '@/lib/workflows/vars'

interface Props {
  wf: Workflow
  nodeId: string | null
  onClose: () => void
  onChange: (nodeId: string, patch: Partial<WorkflowNode>) => void
}

export function ConfigPanel({ wf, nodeId, onClose, onChange }: Props) {
  const node = wf.nodes.find((n) => n.id === nodeId) ?? null
  const def = node ? nodeDef(node.type) : undefined
  const skills = useStore((s) => s.skills)

  const [sample, setSample] = useState('Paste sample input here')
  const [testing, setTesting] = useState(false)
  const [testOut, setTestOut] = useState<string | null>(null)
  const [testErr, setTestErr] = useState<string | null>(null)
  const [varMenu, setVarMenu] = useState<string | null>(null)
  const activeInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  useEffect(() => { setTestOut(null); setTestErr(null) }, [nodeId])

  const upstreamLabels = useMemo(() => {
    if (!node) return []
    // labels of nodes that can reach this node
    const reach = new Set<string>()
    const edgesTo = (id: string) => wf.edges.filter((e) => e.to === id).map((e) => e.from)
    const stack = edgesTo(node!.id)
    while (stack.length) {
      const id = stack.pop()!
      if (reach.has(id)) continue
      reach.add(id)
      stack.push(...edgesTo(id))
    }
    return wf.nodes.filter((n) => reach.has(n.id)).map((n) => n.label)
  }, [wf, node])

  const validation: Record<string, string | null> = {}
  if (node && def) {
    for (const f of def.fields) {
      if ((f.type === 'textarea' || f.type === 'text') && (f.key === 'prompt' || f.key === 'template')) {
        if (!String(node.config[f.key] ?? '').trim()) validation[f.key] = 'Required — this node has nothing to work with yet.'
      }
    }
  }

  const runTest = async () => {
    if (!node) return
    setTesting(true); setTestOut(null); setTestErr(null)
    const tmpId = nanoid(4)
    const tmp: Workflow = {
      id: 'test', name: 'test', createdAt: 0, updatedAt: 0,
      nodes: [
        { id: 'trg', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
        { ...node, id: tmpId },
      ],
      edges: [{ id: 'e1', from: 'trg', to: tmpId }],
    }
    const logs: string[] = []
    const ex = new WorkflowExecutor(tmp, {
      onNodeStart: () => {}, onNodeEnd: () => {}, onEdge: () => {},
      onLog: (l) => logs.push(l), onDone: (rec) => {
        if (rec.status === 'ok') setTestOut(toDisplay(rec.output))
        else setTestErr(rec.error ?? 'Failed')
      },
    }, { input: sample })
    try { await ex.start() } catch (e: any) { setTestErr(String(e?.message ?? e)) }
    setTesting(false)
  }

  const insertVar = (fieldKey: string, v: string) => {
    if (!node) return
    const cur = String(node.config[fieldKey] ?? '')
    const el = activeInputRef.current
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? cur.length
      const next = cur.slice(0, start) + v + cur.slice(el.selectionEnd ?? start)
      onChange(node.id, { config: { ...node.config, [fieldKey]: next } })
    } else {
      onChange(node.id, { config: { ...node.config, [fieldKey]: cur + v } })
    }
    setVarMenu(null)
  }

  return (
    <AnimatePresence>
      {node && def && (
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      )}
      {node && def && (
      <motion.aside
        key="panel"
        initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="absolute right-0 top-0 bottom-0 z-40 w-[400px] flex flex-col"
        style={{ background: 'var(--elevated)', borderLeft: '1px solid var(--surface-border)', boxShadow: '-16px 0 48px -16px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}>
            {def.kind}
          </span>
          <span className="text-[14px] font-semibold flex-1 truncate">{def.name}</span>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-[8px] hover:bg-[var(--surface)]"><X size={15} style={{ color: 'var(--text-3)' }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-[12px] leading-relaxed -mt-1" style={{ color: 'var(--text-3)' }}>{def.desc}</p>

          <Field label="Node label">
            <input value={node.label} onChange={(e) => onChange(node.id, { label: e.target.value })}
              className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
          </Field>

          {def.fields.map((f) => (
            <Field key={f.key} label={f.label} error={validation[f.key]}>
              {f.type === 'select' && f.key === 'skillId' ? (
                <select value={String(node.config[f.key] ?? '')}
                  onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: e.target.value } })}
                  className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
                  <option value="">Choose a skill…</option>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : f.type === 'select' ? (
                <select value={String(node.config[f.key] ?? f.options?.[0]?.value ?? '')}
                  onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: e.target.value } })}
                  className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'number' ? (
                <input type="number" value={Number(node.config[f.key] ?? 0)}
                  onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: Number(e.target.value) } })}
                  className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
              ) : f.type === 'toggle' ? (
                <input type="checkbox" checked={!!node.config[f.key]}
                  onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: e.target.checked } })} />
              ) : f.type === 'textarea' ? (
                <div className="relative">
                  <textarea
                    ref={(el) => { if (varMenu === f.key) activeInputRef.current = el }}
                    value={String(node.config[f.key] ?? '')}
                    onFocus={(e) => { activeInputRef.current = e.target }}
                    onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: e.target.value } })}
                    rows={4}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none resize-y font-mono leading-relaxed"
                    style={{ background: 'var(--surface)', border: `1px solid ${validation[f.key] ? 'var(--danger)' : 'var(--surface-border)'}`, color: 'var(--text-1)' }}
                  />
                  {f.vars && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setVarMenu(varMenu === f.key ? null : f.key) }}
                      className="absolute right-2 top-2 w-6 h-6 rounded-[7px] flex items-center justify-center"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}
                      title="Insert variable" aria-label="Insert variable"
                    ><Braces size={12} /></button>
                  )}
                  {varMenu === f.key && (
                    <div className="absolute right-2 top-9 z-10 w-52 rounded-[12px] py-1 max-h-44 overflow-y-auto"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5)' }}>
                      <VarItem label="input" onClick={() => insertVar(f.key, '{{input}}')} />
                      {upstreamLabels.map((l) => <VarItem key={l} label={l} onClick={() => insertVar(f.key, `{{${l}}}`)} />)}
                      {upstreamLabels.length === 0 && <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-3)' }}>Connect upstream nodes to use their outputs.</div>}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  ref={(el) => { if (document.activeElement?.tagName !== 'INPUT') activeInputRef.current = el }}
                  value={String(node.config[f.key] ?? '')}
                  onFocus={(e) => { activeInputRef.current = e.target }}
                  onChange={(e) => onChange(node.id, { config: { ...node.config, [f.key]: e.target.value } })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}
                />
              )}
              {f.help && <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{f.help}</div>}
            </Field>
          ))}

          {/* test */}
          <div className="rounded-[14px] p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5">
              <FlaskConical size={13} style={{ color: 'var(--secondary)' }} /> Test with sample input
            </div>
            <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-[10px] text-[12px] outline-none resize-y mb-2"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            <button onClick={runTest} disabled={testing}
              className="px-3 py-1.5 rounded-[10px] text-[12px] font-medium"
              style={{ background: 'var(--secondary)', color: '#0b1020', opacity: testing ? 0.6 : 1 }}>
              {testing ? 'Running…' : 'Run this node'}
            </button>
            {testOut !== null && (
              <pre className="mt-2 p-2.5 rounded-[10px] text-[11px] whitespace-pre-wrap break-words max-h-40 overflow-y-auto"
                style={{ background: 'var(--elevated)', border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)', color: 'var(--text-2)' }}>{testOut}</pre>
            )}
            {testErr !== null && (
              <div className="mt-2 p-2.5 rounded-[10px] text-[11px]"
                style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{testErr}</div>
            )}
          </div>
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  )
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{label}</div>
      {children}
      {error && <div className="text-[11px] mt-1" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  )
}

function VarItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-1.5 text-[12px] font-mono hover:bg-[var(--surface)]" style={{ color: 'var(--text-2)' }}>
      {`{{${label}}}`}
    </button>
  )
}
