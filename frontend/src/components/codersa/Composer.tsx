import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowUp, Square, Terminal, FolderGit2 } from 'lucide-react'
import type { HarnessProfile } from '@/lib/codersa/api'

const MAX_HEIGHT = 200
const MAX_CHARS = 20_000

interface ComposerProps {
  draft: string
  setDraft: (v: string) => void
  busy: boolean
  canSend: boolean
  onSend: () => void
  onStop: () => void
  /** A new session takes its profile and project from these pickers. */
  isNew: boolean
  profiles: HarnessProfile[]
  profile: 'minimal' | 'standard'
  setProfile: (p: 'minimal' | 'standard') => void
  projects: string[]
  project: string
  setProject: (p: string) => void
  /** The open session's project, when there is one. */
  workspace: string | null
  allowCommands: boolean
  setAllowCommands: (v: boolean) => void
  focusKey: string | null
}

export function Composer(p: ComposerProps) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const hasProject = p.isNew ? !!p.project : !!p.workspace

  // Grow with the text, up to a limit, then scroll. Measured only when the text changes.
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [p.draft])

  // Return focus to the box when the session changes, so typing goes straight to it.
  useEffect(() => { ta.current?.focus({ preventScroll: true }) }, [p.focusKey])

  const submit = () => { if (p.canSend && !p.busy) p.onSend() }

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pb-5 pt-2">
      <div className="rounded-[18px] transition-shadow focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_22%,transparent)]"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
        <label className="sr-only" htmlFor="codersa-input">Message Codersa</label>
        <textarea id="codersa-input" ref={ta} value={p.draft} rows={1} maxLength={MAX_CHARS}
          onChange={(e) => p.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          }}
          placeholder={p.busy ? 'Codersa is working. Stop it to send something new.' : 'Ask Codersa to change code, run the checks, or explain something…'}
          className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[14px] leading-relaxed outline-none"
          style={{ color: 'var(--text)', maxHeight: MAX_HEIGHT }} />

        <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1 min-w-0">
          {p.isNew ? (
            <>
              <div role="radiogroup" aria-label="Profile" className="flex items-center rounded-[10px] p-0.5 gap-0.5"
                style={{ background: 'var(--elevated)' }}>
                {(['standard', 'minimal'] as const).map((id) => {
                  const meta = p.profiles.find((x) => x.id === id)
                  const on = p.profile === id
                  return (
                    <button key={id} role="radio" aria-checked={on} onClick={() => p.setProfile(id)} title={meta?.description}
                      className="px-2 py-1 rounded-[8px] text-[11.5px] font-medium transition-colors"
                      style={{ background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-3)', boxShadow: on ? '0 0 0 1px var(--surface-border)' : 'none' }}>
                      {meta?.title ?? (id === 'standard' ? 'Standard' : 'Minimal')}
                    </button>
                  )
                })}
              </div>
              <label className="flex items-center gap-1 min-w-0 max-w-[240px] rounded-[10px] px-2 py-1 text-[11.5px]"
                style={{ background: 'var(--elevated)', color: p.project ? 'var(--text-2)' : 'var(--text-3)' }}>
                <FolderGit2 size={12} className="shrink-0" />
                <span className="sr-only">Project</span>
                <select value={p.project} onChange={(e) => p.setProject(e.target.value)} className="min-w-0 bg-transparent outline-none truncate"
                  style={{ color: 'inherit' }}>
                  <option value="">No project</option>
                  {p.projects.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </>
          ) : (
            <span className="flex items-center gap-1 min-w-0 rounded-[10px] px-2 py-1 text-[11.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
              <FolderGit2 size={12} className="shrink-0" />
              <span className="truncate">{p.workspace ?? 'No project'}</span>
            </span>
          )}

          <button type="button" role="switch" aria-checked={p.allowCommands} disabled={!hasProject}
            onClick={() => p.setAllowCommands(!p.allowCommands)}
            title={p.allowCommands
              ? 'Codersa may run commands in this project, with a time limit. Turn off to stop that.'
              : 'Off: Codersa can read and edit files but not run commands. Turn on to let it run commands here.'}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 py-1 text-[11.5px] disabled:opacity-40 transition-colors"
            style={{ background: p.allowCommands ? 'color-mix(in srgb, var(--warn, #d59b1c) 16%, transparent)' : 'var(--elevated)', color: p.allowCommands ? 'var(--text)' : 'var(--text-3)' }}>
            <Terminal size={12} />
            Run commands
            <span aria-hidden className="inline-block w-6 h-3.5 rounded-full relative transition-colors"
              style={{ background: p.allowCommands ? 'var(--warn, #d59b1c)' : 'var(--surface-border)' }}>
              <span className="absolute top-[2px] h-2.5 w-2.5 rounded-full bg-white transition-all" style={{ left: p.allowCommands ? 13 : 2 }} />
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="hidden xl:inline whitespace-nowrap text-[10.5px]" style={{ color: 'var(--text-3)' }}>Enter to send · Shift+Enter for a new line</span>
            {p.busy ? (
              <button onClick={p.onStop} aria-label="Stop"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95"
                style={{ background: 'var(--text)', color: 'var(--surface)' }}>
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button onClick={submit} disabled={!p.canSend || !p.draft.trim()} aria-label="Send"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-35"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <ArrowUp size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10.5px]" style={{ color: 'var(--text-3)' }}>
        Codersa works in the project folder you pick, and its commands run there with a time limit.
      </p>
    </div>
  )
}
