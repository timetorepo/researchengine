import React, { useRef, useState } from 'react'
import { Download, Wand2, Trash2, ShieldCheck, Package, Eye } from 'lucide-react'
import { SKILL_PACKS, packText } from '@/lib/skills/packs'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'
import { SkillImport } from './SkillImport'

export function SkillsTab() {
  const skills = useStore((s) => s.skills)
  const security = useStore((s) => s.skillSecurity)
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)

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
        {/* Two doors, named for what they take: a JSON export of skills this
            app made, or a skill from anywhere else — which is scanned before it
            can be installed. */}
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Download size={14} /> Import JSON
        </button>
        <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-[13px] font-medium"
          style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--surface-border)' }}>
          <ShieldCheck size={14} /> Import a skill &amp; scan it
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        <SkillImport open={importOpen} onClose={() => setImportOpen(false)} />
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
            {/* The verdict stays attached to the skill, so what was learned at
                import time is still visible weeks later. */}
            {security[s.id] && (
              <span title={security[s.id].scannerNote}
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                style={{
                  background: security[s.id].score > 50 ? 'color-mix(in srgb, var(--danger) 14%, transparent)'
                    : security[s.id].score > 0 ? 'color-mix(in srgb, var(--warning) 14%, transparent)'
                    : 'color-mix(in srgb, var(--success) 14%, transparent)',
                  color: security[s.id].score > 50 ? 'var(--danger)' : security[s.id].score > 0 ? 'var(--warning)' : 'var(--success)',
                }}>
                <ShieldCheck size={10} />
                {security[s.id].scanner === 'skillspector' ? 'SkillSpector' : 'static'} {security[s.id].score}
              </span>
            )}
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

      <h3 className="text-[13px] font-semibold mt-7 mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
        <Package size={13} /> Upstream packs, vendored in full
      </h3>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
        Apple-style design knowledge (emilkowalski/skills) and the ian-xiaohei illustration pack with a cross-model adapter.
        Attach up to three to the open chat; their rules ride along in the context.
      </p>
      <PacksSection />
    </div>
  )
}

function PacksSection() {
  const activeChatId = useStore((st) => st.activeChatId)
  const attached = useStore((st) => st.chats.find((c) => c.id === st.activeChatId)?.skillPacks ?? [])
  const [view, setView] = useState<{ id: string; text: string } | null>(null)
  const toggle = (id: string) => {
    if (!activeChatId) return
    useStore.setState((st) => ({
      chats: st.chats.map((c) => c.id === activeChatId
        ? { ...c, skillPacks: (c.skillPacks ?? []).includes(id) ? (c.skillPacks ?? []).filter((x) => x !== id) : [...(c.skillPacks ?? []), id].slice(0, 3) }
        : c),
    }))
  }
  return (
    <>
      <div className="space-y-2">
        {SKILL_PACKS.map((p) => (
          <div key={p.id} className="surface p-3.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
              <Package size={15} strokeWidth={1.5} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium">{p.name}</div>
              <div className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{p.description}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{p.origin} · {p.files.length} files</div>
            </div>
            <button className="p-1.5 rounded hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }} title="Read the SKILL.md"
              onClick={() => { void packText(p.id, 20000).then((t) => setView({ id: p.id, text: t ?? 'missing' })) }}>
              <Eye size={13} />
            </button>
            <button
              disabled={!activeChatId}
              onClick={() => toggle(p.id)}
              className="px-2.5 py-1.5 rounded-[10px] text-[11px] font-medium disabled:opacity-40"
              style={{ background: attached.includes(p.id) ? 'var(--primary)' : 'var(--elevated)', color: attached.includes(p.id) ? '#fff' : 'var(--text-2)' }}>
              {attached.includes(p.id) ? 'Attached' : 'Attach to chat'}
            </button>
          </div>
        ))}
      </div>
      {view && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-6" style={{ background: 'rgb(0 0 0 / .5)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-[12.5px] font-medium flex-1" style={{ color: 'var(--text-1)' }}>{view.id}/SKILL.md</span>
              <button className="px-2.5 py-1 rounded-lg text-[10.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }} onClick={() => setView(null)}>close</button>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{view.text}</pre>
          </div>
        </div>
      )}
    </>
  )
}
