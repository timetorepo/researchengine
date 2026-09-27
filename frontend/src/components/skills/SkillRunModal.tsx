import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Play, X } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { runChat } from '@/lib/chat/runChat'

export function SkillRunModal() {
  const run = useUI((s) => s.skillRun)
  const skills = useStore((s) => s.skills)
  const ui = useUI()
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<string, string>>({})

  const skill = run ? skills.find((s) => s.id === run.skillId) : null

  useEffect(() => {
    if (skill) {
      const init: Record<string, string> = {}
      for (const p of skill.params) init[p.name] = p.default ?? ''
      setValues(init)
    }
  }, [run?.skillId])

  if (!skill) return null

  const execute = () => {
    let prompt = skill.promptTemplate
    for (const p of skill.params) {
      prompt = prompt.split(`{{${p.name}}}`).join(values[p.name] ?? p.default ?? '')
    }
    if (skill.outputFormat === 'json') {
      prompt += '\n\nRespond with valid JSON only, no prose.'
    }
    ui.set({ skillRun: null, island: { kind: 'skill', name: skill.name } })

    const active = useStore.getState().activeChatId
    const chatId = active ?? useStore.getState().newChat()
    if (!active) navigate(`/chat/${chatId}`)
    setTimeout(() => {
      runChat({ chatId, prompt, modelOverride: skill.modelBinding })
      setTimeout(() => useUI.setState((s) => ({ island: s.island.kind === 'skill' ? { kind: 'idle' } : s.island })), 1500)
    }, 100)
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[70] sheet-scrim flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => ui.set({ skillRun: null })}>
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-[440px] surface-elevated overflow-hidden"
          style={{ borderRadius: 'var(--radius-modal)', boxShadow: '0 32px 80px -24px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog" aria-label={`Run skill ${skill.name}`}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <div className="flex-1">
              <div className="font-semibold text-[15px]">{skill.name}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{skill.description}</div>
            </div>
            <button onClick={() => ui.set({ skillRun: null })} aria-label="Close"><X size={16} style={{ color: 'var(--text-3)' }} /></button>
          </div>

          <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
            {skill.params.length === 0 && (
              <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>No inputs needed — this skill runs immediately.</p>
            )}
            {skill.params.map((p) => (
              <div key={p.name}>
                <label className="text-[12px] font-medium mb-1 block">
                  <span className="font-mono" style={{ color: 'var(--primary)' }}>{p.name}</span>
                  <span className="ml-1.5 text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>{p.type}</span>
                </label>
                {p.type === 'boolean' ? (
                  <div className="flex gap-1.5">
                    {['true', 'false'].map((v) => (
                      <button key={v} onClick={() => setValues((val) => ({ ...val, [p.name]: v }))}
                        className="flex-1 py-1.5 rounded-[10px] text-[12px]"
                        style={{ background: values[p.name] === v ? 'var(--primary)' : 'var(--surface)', color: values[p.name] === v ? '#fff' : 'var(--text-2)' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                ) : p.type === 'enum' ? (
                  <select value={values[p.name]} onChange={(e) => setValues((val) => ({ ...val, [p.name]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                    {(p.options ?? []).map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : p.type === 'string' && (p.description?.includes('Paste') || p.name.includes('text') || p.name.includes('notes') || p.name.includes('sources')) ? (
                  <textarea value={values[p.name]} onChange={(e) => setValues((val) => ({ ...val, [p.name]: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px] resize-y"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                ) : (
                  <input value={values[p.name]} onChange={(e) => setValues((val) => ({ ...val, [p.name]: e.target.value }))}
                    type={p.type === 'number' ? 'number' : 'text'}
                    className="w-full px-3 py-2 rounded-[10px] outline-none text-[13px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <button onClick={execute}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[12px] text-[13px] font-medium"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              <Play size={14} /> Run skill
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
