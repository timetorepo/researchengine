/**
 * The dependencies the open project actually uses, and the ones AI coding
 * usually reaches for.
 *
 * The top half reads the project's package.json through the backend and says
 * what is installed, what is only declared, and whether a lockfile pins the
 * tree. The bottom half is a curated list of the dependencies people build AI
 * features with, each with a one-click copy of its install command.
 */
import { useEffect, useState } from 'react'
import { Package, Boxes, Sparkles, Copy, Loader2 } from 'lucide-react'
import { copyText } from '@/lib/utils'
import { useUI } from '@/stores/useUI'

interface Dep { name: string; version: string; dev: boolean }

const AI_DEPS: { name: string; why: string }[] = [
  { name: 'openai', why: 'The official OpenAI SDK — chat, embeddings, tool calls.' },
  { name: '@anthropic-ai/sdk', why: 'Claude API with streaming and tool use.' },
  { name: 'ollama', why: 'Run local models from Node, no key at all.' },
  { name: 'ai', why: 'The Vercel AI SDK — one streaming API over every provider.' },
  { name: '@ai-sdk/react', why: 'React hooks for the AI SDK streams.' },
  { name: 'zod', why: 'Validate model inputs and tool arguments with schemas.' },
  { name: '@langchain/core', why: 'Chains, retrievers and agents when a single call is not enough.' },
  { name: 'hono', why: 'A tiny server to expose your model endpoints.' },
]

export function DepsPanel({ project }: { project: string }) {
  const ui = useUI()
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading')
  const [deps, setDeps] = useState<Dep[]>([])
  const [meta, setMeta] = useState<{ installed: boolean; lock: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/ide/deps?project=${encodeURIComponent(project)}`)
        const j = await res.json()
        if (!alive) return
        if (!res.ok || j.error) { setState('error'); return }
        if (!j.packageJson) { setState('none'); return }
        setDeps(j.deps)
        setMeta({ installed: j.installed, lock: j.lock })
        setState('ready')
      } catch {
        if (alive) setState('error')
      }
    })()
    return () => { alive = false }
  }, [project])

  const copyInstall = async (name: string) => {
    const ok = await copyText(`npm install ${name}`)
    ui.toast(ok ? 'Install command copied' : 'Copy blocked', ok ? `npm install ${name}` : 'The clipboard refused.', ok ? 'success' : 'warning')
  }

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-3 text-[11px]">
      <div className="ide-section px-0.5 pt-2 pb-1.5">Installed dependencies</div>
      {state === 'loading' && <div className="flex items-center gap-1.5 px-1" style={{ color: 'var(--ide-faint)' }}><Loader2 size={11} className="animate-spin" /> reading package.json…</div>}
      {state === 'error' && <p className="px-1" style={{ color: 'var(--ide-faint)' }}>Could not read the project's package.json.</p>}
      {state === 'none' && <p className="px-1 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>This project has no package.json, so there are no dependencies to list.</p>}
      {state === 'ready' && (
        <>
          {meta && (
            <p className="px-1 pb-1.5 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
              {deps.length} declared · {meta.installed ? 'node_modules present' : 'not installed yet'}{meta.lock ? ` · pinned by ${meta.lock}` : ' · no lockfile'}
            </p>
          )}
          {deps.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 px-1.5 py-1 rounded-[6px] hover:bg-[var(--ide-hover)]">
              <Package size={10} style={{ color: d.dev ? 'var(--ide-faint)' : 'var(--ide-accent)' }} />
              <span className="flex-1 truncate font-mono text-[10.5px]" style={{ color: 'var(--ide-text)' }}>{d.name}</span>
              <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--ide-dim)' }}>{d.version}</span>
              {d.dev && <span className="text-[9px] px-1 rounded" style={{ background: 'var(--ide-hover)', color: 'var(--ide-faint)' }}>dev</span>}
            </div>
          ))}
          {!deps.length && <p className="px-1" style={{ color: 'var(--ide-faint)' }}>package.json declares nothing.</p>}
        </>
      )}

      <div className="ide-section px-0.5 pt-3.5 pb-1.5">Usually used for AI coding</div>
      <p className="px-1 pb-1.5 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        The staples of an AI feature. Copy an install command, paste it in the terminal below.
      </p>
      {AI_DEPS.map((d) => (
        <div key={d.name} className="group flex items-start gap-1.5 px-1.5 py-1.5 rounded-[6px] hover:bg-[var(--ide-hover)]">
          <Sparkles size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--ide-cyan, var(--ide-accent))' }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10.5px]" style={{ color: 'var(--ide-text)' }}>{d.name}</span>
              <button onClick={() => void copyInstall(d.name)} title={`Copy npm install ${d.name}`}
                className="opacity-60 hover:opacity-100">
                <Copy size={10} />
              </button>
            </div>
            <p className="leading-snug" style={{ color: 'var(--ide-dim)' }}>{d.why}</p>
          </div>
        </div>
      ))}

      <p className="px-1 pt-2 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        <Boxes size={9} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
        Installs always ask for your approval first, here and when the agent runs them.
      </p>
    </div>
  )
}
