import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Wand2, Plus, Trash2, Sparkles } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { Skill, SkillParam, ParamType } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { SKILL_CATEGORIES, SKILL_ICONS } from '@/lib/skills/builtins'
import { PROVIDERS } from '@/lib/providers/registry'

const PARAM_TYPES: ParamType[] = ['string', 'number', 'boolean', 'enum', 'file']

export function SkillBuilderPanel() {
  const source = useUI((s) => s.skillBuilderOpen)
  const ui = useUI()
  const open = source !== null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState('')
  const [params, setParams] = useState<SkillParam[]>([])
  const [outputFormat, setOutputFormat] = useState<'natural' | 'json'>('natural')
  const [modelBinding, setModelBinding] = useState('inherit')
  const [category, setCategory] = useState('Custom')
  const [autoRan, setAutoRan] = useState(false)

  useEffect(() => {
    if (open) {
      setTemplate(source ?? '')
      setName('')
      setDescription('')
      setParams([])
      setAutoRan(false)
      // auto-detect {{placeholders}}
      const found = [...(source ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
      if (found.length) setParams([...new Set(found)].map((n) => ({ name: n, type: 'string' as ParamType })))
    }
  }, [open, source])

  // Auto-parameterize: guess variable parts (quoted strings, numbers, capitalized topics)
  const autoParameterize = () => {
    let t = template
    const newParams: SkillParam[] = [...params]
    // numbers
    t = t.replace(/\b\d{2,}\b/g, (m) => {
      const pname = `number_${newParams.length + 1}`
      newParams.push({ name: pname, type: 'number', default: m, description: 'A numeric value' })
      return `{{${pname}}}`
    })
    // quoted phrases
    t = t.replace(/"([^"]{3,60})"/g, (_m, inner: string) => {
      const pname = inner.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 18) || `phrase_${newParams.length + 1}`
      if (!newParams.find((p) => p.name === pname)) newParams.push({ name: pname, type: 'string', default: inner })
      return `{{${pname}}}`
    })
    setTemplate(t)
    setParams(newParams)
    ui.toast('Auto-parameterized', `${newParams.length} parameter(s) detected. Edit below.`, 'success')
  }

  const save = () => {
    if (!name.trim() || !template.trim()) return
    const skill: Skill = {
      id: 'sk-' + nanoid(8), name: name.trim(), description: description.trim() || 'Custom skill',
      promptTemplate: template, params, outputFormat,
      modelBinding: modelBinding === 'inherit' ? undefined : modelBinding,
      category, icon: 'wand',
    }
    useStore.setState((s) => ({ skills: [...s.skills, skill] }))
    ui.toast('Skill saved', `"${skill.name}" is now callable via / in any chat.`, 'success')
    ui.set({ skillBuilderOpen: null })
  }

  const modelOptions = useMemo(() =>
    PROVIDERS.flatMap((p) => ((useStore.getState().settings.providerModels ?? {})[p.id] ?? []).map((m) => `${p.id}:${m}`)).slice(0, 20), [])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[65] sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => ui.set({ skillBuilderOpen: null })} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-[66] w-full sm:w-[440px] glass flex flex-col"
            style={{ borderLeft: '1px solid var(--surface-border)' }}
            role="dialog" aria-label="Skill builder"
          >
            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--secondary) 18%, transparent)', color: 'var(--secondary)' }}>
                <Wand2 size={16} strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <div className="font-semibold text-[15px]">SkillBuilder</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Turn a prompt into a reusable, parameterized skill</div>
              </div>
              <button onClick={() => ui.set({ skillBuilderOpen: null })} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--elevated)]"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <Field label="Prompt template" hint="Wrap variable parts in {{double_braces}} to create parameters.">
                <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={5}
                  className="w-full px-3 py-2 rounded-[12px] outline-none text-[13px] resize-y font-mono"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                <button onClick={autoParameterize} className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--secondary)' }}>
                  <Sparkles size={12} /> Auto-parameterize
                </button>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summarize paper"
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                </Field>
                <Field label="Category">
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    {SKILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this skill do?"
                  className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
              </Field>

              {/* Input schema */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12.5px] font-medium">Input schema</span>
                  <button onClick={() => setParams((p) => [...p, { name: `param_${p.length + 1}`, type: 'string' }])}
                    className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--primary)' }}>
                    <Plus size={12} /> Add parameter
                  </button>
                </div>
                {params.length === 0 && <div className="text-[11.5px] py-2" style={{ color: 'var(--text-3)' }}>No parameters — this skill runs as-is.</div>}
                <div className="space-y-2">
                  {params.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                      <input value={p.name} onChange={(e) => setParams((ps) => ps.map((x, j) => j === i ? { ...x, name: e.target.value.replace(/[^a-z0-9_]/gi, '') } : x))}
                        className="w-24 bg-transparent outline-none text-[12px] font-mono" style={{ color: 'var(--primary)' }} />
                      <select value={p.type} onChange={(e) => setParams((ps) => ps.map((x, j) => j === i ? { ...x, type: e.target.value as ParamType } : x))}
                        className="flex-1 bg-transparent outline-none text-[12px]" style={{ background: 'transparent' }}>
                        {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={p.default ?? ''} placeholder="default"
                        onChange={(e) => setParams((ps) => ps.map((x, j) => j === i ? { ...x, default: e.target.value } : x))}
                        className="w-20 bg-transparent outline-none text-[12px]" style={{ color: 'var(--text-2)' }} />
                      <button onClick={() => setParams((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove parameter" style={{ color: 'var(--text-3)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Output format">
                  <div className="flex gap-1.5">
                    {(['natural', 'json'] as const).map((f) => (
                      <button key={f} onClick={() => setOutputFormat(f)}
                        className="flex-1 px-2 py-1.5 rounded-[10px] text-[12px]"
                        style={{ background: outputFormat === f ? 'var(--primary)' : 'var(--elevated)', color: outputFormat === f ? '#fff' : 'var(--text-2)' }}>
                        {f === 'natural' ? 'Natural' : 'JSON'}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Model binding">
                  <select value={modelBinding} onChange={(e) => setModelBinding(e.target.value)}
                    className="w-full px-2 py-2 rounded-[10px] outline-none text-[12px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    <option value="inherit">Inherit from agent</option>
                    {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <button onClick={save} disabled={!name.trim() || !template.trim()}
                className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                Save skill
              </button>
              <button onClick={() => ui.set({ skillBuilderOpen: null })}
                className="px-4 py-2.5 rounded-[12px] text-[13px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Cancel
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12.5px] font-medium mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  )
}
