/**
 * What the agent can work in, and what this project actually is.
 *
 * Two halves that answer different questions: the top says which frameworks the
 * open project matches (so the run command and the agent's own context are
 * right), and the list below is the honest menu — each framework either creates
 * a working project here in one click, or names the official create command the
 * agent will run in its terminal, with the toolchain it needs stated up front.
 */
import React, { useMemo, useState } from 'react'
import { Boxes, Check, Copy, ExternalLink, Hammer, Loader2, Play, Plus, Terminal as TerminalIcon } from 'lucide-react'
import { FRAMEWORKS, KIND_LABEL, detectFrameworks, type Framework } from '@/lib/ide/frameworks'
import { createProjectRobust, postJson } from '@/lib/ide/create'
import { useUI } from '@/stores/useUI'

export function FrameworksPanel({ project, files, onCreated }: { project: string; files: string[]; onCreated?: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useUI((s) => s.toast)
  const detected = useMemo(() => detectFrameworks(files), [files])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FRAMEWORKS
    return FRAMEWORKS.filter((f) => f.name.toLowerCase().includes(q) || f.note.toLowerCase().includes(q) || f.kind.includes(q) || f.id.includes(q))
  }, [query])

  const create = async (f: Framework) => {
    if (!f.scaffold) return
    setBusy(f.id)
    try {
      const filesFor = f.scaffold(`${project}-${f.id}`)
      const outcome = await createProjectRobust(postJson, {
        name: `${project}-${f.id}`, fallback: `${f.id}-project`, files: filesFor, taken: [], unique: true,
      })
      if (outcome.ok) {
        toast(`${f.name} project created`, `${outcome.name} — open it from the project switcher.`, 'success')
        onCreated?.(outcome.name ?? '')
      } else {
        toast('Could not create the project', outcome.error ?? 'The server refused it.', 'danger')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3" data-frameworks>
      <header className="flex items-center gap-2">
        <Boxes size={13} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>Frameworks the agent can build in</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>{FRAMEWORKS.length} with real commands</span>
      </header>

      {/* what this project is */}
      <div className="rounded-[10px] px-3 py-2" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
        {project ? (
          detected.length ? (
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]" style={{ color: 'var(--ide-dim)' }}>
              <span style={{ color: 'var(--ide-text)' }}>{project} looks like</span>
              {detected.slice(0, 4).map((f) => (
                <span key={f.id} className="px-2 py-0.5 rounded-full text-[10.5px]"
                  style={{ background: 'color-mix(in srgb, var(--ide-accent) 15%, transparent)', color: 'var(--ide-accent)' }}>{f.name}</span>
              ))}
            </div>
          ) : (
            <span className="text-[11.5px]" style={{ color: 'var(--ide-dim)' }}>
              {project} is open, and no framework signature was recognised in its files. The agent will read the files
              itself before it assumes anything.
            </span>
          )
        ) : (
          <span className="text-[11.5px]" style={{ color: 'var(--ide-dim)' }}>Open a project and this line says which framework it is.</span>
        )}
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter — react, flutter, java, mobile, backend…"
        className="ide-input w-full text-[11.5px]" aria-label="Filter frameworks" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {shown.map((f) => <FrameworkCard key={f.id} f={f} busy={busy === f.id} onCopy={(t) => { void navigator.clipboard.writeText(t); toast('Copied', t, 'success') }} onCreate={() => void create(f)} />)}
      </div>
    </div>
  )
}

function FrameworkCard({ f, busy, onCopy, onCreate }: { f: Framework; busy: boolean; onCopy: (t: string) => void; onCreate: () => void }) {
  const cmds = [f.create, f.dev, f.build, f.test].filter(Boolean) as string[]
  return (
    <div className="rounded-[10px] p-2.5 flex flex-col gap-1.5" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>{f.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-faint)' }}>
          {KIND_LABEL[f.kind]}
        </span>
        <a href={f.docs} target="_blank" rel="noreferrer noopener" className="ml-auto text-[10.5px] inline-flex items-center gap-1" style={{ color: 'var(--ide-accent)' }}>
          docs <ExternalLink size={9} />
        </a>
      </div>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--ide-dim)' }}>{f.note}</p>
      <div className="flex flex-wrap gap-1">
        {cmds.map((c) => (
          <button key={c} onClick={() => onCopy(c)} title="Copy"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-mono"
            style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-dim)' }}>
            <Copy size={9} /> {c}
          </button>
        ))}
      </div>
      {f.requires && (
        <span className="text-[10.5px] inline-flex items-center gap-1" style={{ color: 'var(--ide-faint)' }}>
          <Hammer size={10} /> needs {f.requires}
        </span>
      )}
      <div className="flex items-center gap-1.5 mt-0.5">
        {f.scaffold ? (
          <button onClick={onCreate} disabled={busy} className="ide-btn primary" style={{ height: 24 }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create a project
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
            <TerminalIcon size={10} /> run the create command below in the agent terminal
          </span>
        )}
        {f.dev && (
          <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
            <Play size={10} /> {f.dev}
          </span>
        )}
        {f.scaffold && <Check size={11} style={{ color: 'var(--success, #16a34a)' }} />}
      </div>
    </div>
  )
}
