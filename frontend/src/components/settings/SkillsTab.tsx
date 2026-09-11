import React, { useRef } from 'react'
import { Download, Upload, Wand2, Trash2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'

export function SkillsTab() {
  const skills = useStore((s) => s.skills)
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportAll = () => {
    download('research-engine-skills.json', JSON.stringify(skills.filter((s) => !s.builtin), null, 2), 'application/json')
  }

  const importFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result))
        const incoming = Array.isArray(arr) ? arr : [arr]
        useStore.setState((s) => ({ skills: [...s.skills, ...incoming.map((x: any) => ({ ...x, id: 'sk-' + Math.random().toString(36).slice(2, 8), builtin: false }))] }))
        ui.toast('Skills imported', `${incoming.length} skill(s) added.`, 'success')
      } catch {
        ui.toast('Import failed', 'That file is not valid skill JSON.', 'danger')
      }
    }
    reader.readAsText(f)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Skills</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Reusable, parameterized prompts your agents can call. Invoke any of them with <code className="font-mono">/</code> in the input.
      </p>

      <div className="flex gap-2 mb-5">
        <button onClick={() => ui.set({ skillBuilderOpen: '' })}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Wand2 size={14} /> New skill
        </button>
        <button onClick={exportAll} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Download size={14} /> Export
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Upload size={14} /> Import
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
      </div>

      <div className="space-y-2">
        {skills.map((s) => (
          <div key={s.id} className="surface p-3.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--secondary) 16%, transparent)', color: 'var(--secondary)' }}>
              <Wand2 size={15} strokeWidth={1.5} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium flex items-center gap-2">
                {s.name}
                {s.builtin && <span className="px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>built-in</span>}
              </div>
              <div className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{s.description}</div>
            </div>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{s.category}</span>
            <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{s.params.length} params</span>
            {!s.builtin && (
              <button onClick={() => useStore.setState((st) => ({ skills: st.skills.filter((x) => x.id !== s.id) }))}
                aria-label="Delete skill" className="p-1.5 rounded hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
