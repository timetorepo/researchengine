/**
 * Projects a Bot owns. A project has a brief and a log. The owner can hand the
 * project to another bot: the old owner writes a brief for the new one, and the
 * log keeps the handoff, so the record of who had it is never lost.
 */
import { useState } from 'react'
import { Trash2, ArrowRightLeft } from 'lucide-react'
import { useBots } from '@/lib/bots/store'
import { handOffProject } from '@/lib/bots/runner'
import { type Project } from '@/lib/bots/logic'
import { useUI } from '@/stores/useUI'
import { BotFace } from './BotFace'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'

export function ProjectsView() {
  const projects = useBots((s) => s.projects)
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const selected = projects.find((p) => p.id === selectedId) ?? null
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="surface p-3 space-y-2 h-fit">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Projects</div>
          <button type="button" onClick={() => setCreating((v) => !v)} className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)' }}>
            {creating ? 'Close' : 'New'}
          </button>
        </div>
        {projects.length === 0 && !creating && <p className="text-[12px] px-1 py-2" style={{ color: 'var(--text-3)' }}>No projects yet. A project has a brief that a bot can own and hand to a teammate.</p>}
        <ul className="space-y-1">
          {projects.map((p) => {
            const owner = useBots.getState().bots.find((b) => b.id === p.ownerId)
            return (
              <li key={p.id}>
                <button type="button" onClick={() => { setSelectedId(p.id); setCreating(false) }} className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-[10px]"
                  style={{ background: p.id === selectedId && !creating ? 'var(--elevated)' : 'transparent' }}>
                  {owner ? <BotFace bot={owner} size={22} /> : <span className="w-[22px] h-[22px] rounded-full" style={{ background: 'var(--elevated)' }} />}
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium truncate">{p.name}</span>
                    <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{owner ? `Owned by ${owner.name}` : 'No owner'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {creating && <NewProjectForm onDone={(id) => { setCreating(false); setSelectedId(id) }} />}
      </aside>
      <section className="min-w-0">
        {selected ? <ProjectDetail project={selected} /> : <div className="surface p-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>Create a project to give a bot something to own.</div>}
      </section>
    </div>
  )
}

function NewProjectForm({ onDone }: { onDone: (id: string) => void }) {
  const bots = useBots((s) => s.bots)
  const ui = useUI()
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [ownerId, setOwnerId] = useState(bots[0]?.id ?? '')
  const create = () => {
    const err = useBots.getState().createProject({ name, brief, ownerId: ownerId || null })
    if (err) { ui.toast('Project not created', err, 'warning'); return }
    const project = useBots.getState().projects.slice(-1)[0]
    if (project) onDone(project.id)
  }
  return (
    <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" aria-label="Project name"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="Brief: the goal, the material, what done looks like" aria-label="Project brief"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none resize-y" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <label className="block text-[11px]" style={{ color: 'var(--text-3)' }}>
        Owner
        <ModernSelect value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1 w-full px-2 py-1 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)' }}>
          <option value="">No owner yet</option>
          {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </ModernSelect>
      </label>
      <button type="button" onClick={create} className="w-full px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create project</button>
    </div>
  )
}

function ProjectDetail({ project }: { project: Project }) {
  const bots = useBots((s) => s.bots)
  const owner = bots.find((b) => b.id === project.ownerId)
  const candidates = bots.filter((b) => b.id !== project.ownerId)
  const [target, setTarget] = useState(candidates[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [note2, setNote2] = useState('')
  const [busy, setBusy] = useState(false)
  const [briefDraft, setBriefDraft] = useState(project.brief)
  const ui = useUI()
  const nameOf = (id?: string | null) => bots.find((b) => b.id === id)?.name ?? 'a bot that was deleted'

  const handOff = async () => {
    if (!target) { ui.toast('Pick a bot', 'Choose who takes the project.', 'warning'); return }
    setBusy(true)
    try {
      const res = await handOffProject(project.id, target, note)
      ui.toast(res.ok ? 'Handed over' : 'Not handed over', res.message, res.ok ? 'success' : 'warning')
      if (res.ok) { setNote(''); setTarget('') }
    } finally { setBusy(false) }
  }

  return (
    <div className="surface p-4 space-y-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold truncate">{project.name}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{owner ? `Owned by ${owner.name}` : 'No owner'}</div>
        </div>
        <button type="button" aria-label={`Delete ${project.name}`} className="p-1.5 rounded-full" style={{ color: 'var(--text-3)' }}
          onClick={() => { if (window.confirm(`Delete the project “${project.name}”? Its log is removed.`)) useBots.getState().deleteProject(project.id) }}>
          <Trash2 size={13} />
        </button>
      </header>

      <section className="space-y-1">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Brief</div>
        <textarea value={briefDraft} onChange={(e) => setBriefDraft(e.target.value)} rows={3} aria-label="Project brief text"
          onBlur={() => { if (briefDraft !== project.brief) useBots.setState((s) => ({ projects: s.projects.map((p) => (p.id === project.id ? { ...p, brief: briefDraft.trim().slice(0, 4000) } : p)) })) }}
          className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none resize-y" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      </section>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Hand off</div>
        {candidates.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Create another bot to hand this project to.</p>
        ) : (
          <div className="space-y-2 p-2.5 rounded-[10px]" style={{ background: 'var(--elevated)' }}>
            <label className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              New owner
              <ModernSelect value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full px-2 py-1 rounded-[8px] text-[12px] outline-none" style={{ background: 'var(--surface)' }}>
                {candidates.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </ModernSelect>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Note for the new owner"
              placeholder="Note for them (optional): what matters most now" className="w-full px-2 py-1 rounded-[8px] text-[12px] outline-none resize-none" style={{ background: 'var(--surface)' }} />
            <button type="button" onClick={() => void handOff()} disabled={busy || !target}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] disabled:opacity-50" style={{ background: 'var(--primary)', color: '#fff' }}>
              <ArrowRightLeft size={12} /> {busy ? 'Writing the brief…' : 'Hand off with a brief'}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Log</div>
        <ul className="space-y-1.5">
          {project.log.map((e) => (
            <li key={e.id} className="text-[12px] leading-snug px-2.5 py-1.5 rounded-[8px]" style={{ background: 'var(--elevated)' }}>
              <span className="text-[10.5px] uppercase tracking-wider mr-1.5" style={{ color: 'var(--text-3)' }}>
                {e.kind === 'handoff' ? `handoff to ${nameOf(e.toId)}` : e.kind}
              </span>
              <span className="whitespace-pre-wrap">{e.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5">
          <input value={note2} onChange={(e) => setNote2(e.target.value)} placeholder="Add a note to the log" aria-label="Log note"
            onKeyDown={(e) => { if (e.key === 'Enter' && note2.trim()) { useBots.getState().noteProject(project.id, note2); setNote2('') } }}
            className="flex-1 px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
          <button type="button" disabled={!note2.trim()} onClick={() => { useBots.getState().noteProject(project.id, note2); setNote2('') }}
            className="px-3 rounded-[10px] text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>Add</button>
        </div>
      </section>
    </div>
  )
}
