import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Package, RefreshCw } from 'lucide-react'
import type { DependencySuggestion, ProjectDependency, ProjectDependencyReport } from '@/lib/ide/dependencies'
import { dependencyInstallCommand, dependencySuggestions } from '@/lib/ide/dependencies'
import { useUI } from '@/stores/useUI'

export function DependenciesPanel({ project }: { project: string }) {
  const [report, setReport] = useState<ProjectDependencyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const toast = useUI((state) => state.toast)

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/ide/dependencies?project=${encodeURIComponent(project)}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
      setReport(body as ProjectDependencyReport)
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : cause))
      setReport(null)
    } finally { setLoading(false) }
  }, [project])

  useEffect(() => { void refresh() }, [refresh])

  const suggestions = useMemo(() => report ? dependencySuggestions(report.ecosystem) : [], [report])
  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(command)
      setTimeout(() => setCopied(null), 1300)
      toast('Install line copied', 'Run it in the project terminal when you decide to install the package.', 'success')
    } catch {
      toast('Clipboard unavailable', command, 'info')
    }
  }

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3" data-dependencies>
      <header className="flex items-center gap-2">
        <Package size={13} style={{ color: 'var(--ide-accent)' }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[12.5px] font-medium" style={{ color: 'var(--ide-text)' }}>Project dependencies</h2>
          <p className="text-[10px]" style={{ color: 'var(--ide-faint)' }}>{project}</p>
        </div>
        {report && <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--ide-hover)', color: 'var(--ide-faint)' }}>
          {report.manager === 'unknown' ? report.ecosystem : report.manager}
        </span>}
        <button onClick={() => void refresh()} title="Refresh dependency list" className="ide-icon-btn" style={{ width: 23, height: 23 }}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {loading && <p className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>Reading the project manifest and installed packages…</p>}
      {!!error && <p className="text-[11px] p-2 rounded-[8px]" style={{ color: 'var(--ide-danger)', background: 'color-mix(in srgb, var(--ide-danger) 10%, transparent)' }}>{error}</p>}
      {!loading && report?.error && <p className="text-[10.5px]" style={{ color: 'var(--ide-warn)' }}>{report.error}</p>}

      {!!report?.manifest && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[11.5px] font-medium" style={{ color: 'var(--ide-text)' }}>Direct dependencies</h3>
            <span className="text-[10px]" style={{ color: 'var(--ide-faint)' }}>{report.dependencies.length} · {report.manifest}</span>
          </div>
          {!report.dependencies.length ? (
            <p className="text-[10.5px] p-2 rounded-[8px]" style={{ background: 'var(--ide-hover)', color: 'var(--ide-faint)' }}>The manifest has no direct dependencies yet.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-[210px] overflow-y-auto pr-1">
              {report.dependencies.map((dependency) => <DependencyRow key={`${dependency.name}:${dependency.kind}`} dependency={dependency} ecosystem={report.ecosystem} />)}
            </div>
          )}
          <p className="text-[9.5px] leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
            Node packages are checked against this project’s node_modules folder. Python packages are checked in its .venv or venv; other ecosystems show manifest entries.
          </p>
        </section>
      )}

      {!loading && !report?.manifest && !error && (
        <div className="rounded-[9px] p-2.5 text-[10.5px] leading-relaxed" style={{ background: 'var(--ide-hover)', color: 'var(--ide-dim)' }}>
          No supported dependency manifest was found. Suggestions appear after the project has a package.json, requirements.txt, pyproject.toml, Cargo.toml or go.mod.
        </div>
      )}

      {!!suggestions.length && (
        <section className="flex flex-col gap-2">
          <div>
            <h3 className="text-[11.5px] font-medium" style={{ color: 'var(--ide-text)' }}>Useful for AI-assisted development</h3>
            <p className="text-[9.8px]" style={{ color: 'var(--ide-faint)' }}>Optional picks for this stack. Copying a line does not install anything.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
            {suggestions.map((suggestion) => {
              const dep = report?.dependencies.find((entry) => entry.name.toLowerCase() === suggestion.name.toLowerCase())
              const command = report ? dependencyInstallCommand(report.manager, suggestion.name, suggestion.dev) : null
              return (
                <SuggestionRow key={suggestion.name} suggestion={suggestion} dependency={dep} command={command}
                  copied={!!command && copied === command} onCopy={() => command && void copy(command)} />
              )
            })}
          </div>
        </section>
      )}

      {!!report?.manifest && report.manager === 'unknown' && (
        <p className="text-[10px]" style={{ color: 'var(--ide-faint)' }}>The ecosystem was detected, but its package manager could not be inferred. Check the manifest before installing.</p>
      )}
    </div>
  )
}

function DependencyRow({ dependency, ecosystem }: { dependency: ProjectDependency; ecosystem: ProjectDependencyReport['ecosystem'] }) {
  const canCheckInstall = ecosystem === 'node' || ecosystem === 'python'
  const status = dependency.installed
    ? `Installed · ${dependency.installedVersion ?? dependency.version}`
    : canCheckInstall ? `Declared · not found locally · ${dependency.version}` : `Declared · ${dependency.version}`
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-[7px]" style={{ background: 'var(--ide-hover)' }}>
      <span className="flex-1 min-w-0 truncate text-[10.5px] font-mono" style={{ color: 'var(--ide-text)' }}>{dependency.name}</span>
      <span className="text-[9px]" style={{ color: 'var(--ide-faint)' }}>{dependency.kind}</span>
      <span className="text-[9px] shrink-0" style={{ color: dependency.installed ? 'var(--ide-accent)' : 'var(--ide-faint)' }}>{status}</span>
    </div>
  )
}

function SuggestionRow({ suggestion, dependency, command, copied, onCopy }: {
  suggestion: DependencySuggestion
  dependency?: ProjectDependency
  command: string | null
  copied: boolean
  onCopy: () => void
}) {
  const installed = !!dependency?.installed
  const declared = !!dependency
  return (
    <article className="rounded-[8px] p-2 flex flex-col gap-1" style={{ background: 'var(--ide-hover)' }} data-dependency-suggestion={suggestion.name}>
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-mono font-medium truncate" style={{ color: 'var(--ide-text)' }}>{suggestion.name}</span>
        <span className="text-[8.5px] px-1 py-0.5 rounded-full shrink-0" style={{ background: 'var(--ide-surface)', color: installed ? 'var(--ide-accent)' : 'var(--ide-faint)' }}>
          {installed ? `installed ${dependency?.installedVersion ?? ''}` : declared ? 'declared' : suggestion.dev ? 'dev tool' : 'suggested'}
        </span>
      </div>
      <span className="text-[9.5px] leading-snug" style={{ color: 'var(--ide-dim)' }}>{suggestion.description}</span>
      {command && (
        <button onClick={onCopy} title={`Copy ${command}`} className="mt-0.5 flex items-center gap-1.5 text-left px-1.5 py-1 rounded-[6px] text-[9px] font-mono"
          style={{ background: 'var(--ide-surface)', color: 'var(--ide-faint)' }}>
          {copied ? <Check size={9} style={{ color: 'var(--ide-accent)' }} /> : <ClipboardCopy size={9} />}
          <span className="truncate">{command}</span>
        </button>
      )}
    </article>
  )
}
