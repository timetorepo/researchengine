import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderGit2, Settings2, Sparkles, X } from 'lucide-react'
import { CodersaMascot, type MascotState } from './CodersaMascot'
import { PanelLeft } from 'lucide-react'
import { CodingTabs } from './CodingTabs'
import { SessionRail } from './SessionRail'
import { Thread } from './Thread'
import { Composer } from './Composer'
import { useCodersa } from './useCodersa'
import './codersa.css'

const SUGGESTIONS = [
  'Explain how this project is laid out, and where the main logic lives.',
  'Find the failing test, fix it, and run the checks again.',
  'Add a small, well-tested feature and show me the changes.',
]

/**
 * Codersa: the agent harness as a page of the Coding section. The rail holds
 * the sessions, the middle is the conversation, and the composer at the foot
 * takes the next instruction. All state lives in useCodersa.
 */
export function CodersaPage() {
  const c = useCodersa()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  // Below the md breakpoint the session rail is an overlay, opened from the top bar.
  const [railOpen, setRailOpen] = useState(false)
  const openSession = (id: string) => { setRailOpen(false); void c.openSession(id) }

  const isNew = !c.activeId
  const workspace = c.active?.workspace ?? null
  const title = c.active?.title ?? (isNew ? 'New session' : 'Session')
  const profileTitle = c.profiles.find((p) => p.id === (c.active?.profile ?? c.prefs.profile))?.title ?? (c.active?.profile ?? c.prefs.profile)
  const canSend = c.model.ok && !c.busy

  const mascot: MascotState = c.busy ? 'busy' : c.error ? 'error' : c.outcome?.outcome === 'done' ? 'done' : 'idle'

  const send = useCallback(async () => {
    const text = draft
    const started = await c.send(text)
    // Clear the box only when the turn started, and only if the person has not typed something new since.
    if (started) setDraft((d) => (d === text ? '' : d))
  }, [c, draft])

  const pick = (s: string) => { setDraft(s) }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--bg, var(--surface))' }}>
      <div className="flex items-center justify-between gap-3 px-5 h-14 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setRailOpen((v) => !v)} aria-label="Sessions" aria-expanded={railOpen}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-[10px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <PanelLeft size={15} />
          </button>
          <CodingTabs active="codersa" />
        </div>
        <button onClick={() => navigate('/settings')} title="Model and provider settings"
          className="flex items-center gap-1.5 text-[11.5px] rounded-[10px] px-2 py-1 max-w-[260px] min-w-0"
          style={{ background: 'var(--elevated)', color: c.model.ok ? 'var(--text-2)' : 'var(--danger)' }}>
          <Settings2 size={12} className="shrink-0" />
          <span className="truncate">{c.model.ok ? c.model.label : 'No model for Codersa'}</span>
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {railOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setRailOpen(false)} aria-hidden />}
        <div className={railOpen ? 'fixed inset-y-0 left-0 z-40 flex md:static md:z-auto' : 'hidden md:flex'}>
          <SessionRail
            sessions={c.sessions}
            activeId={c.activeId}
            busy={c.busy}
            onNew={() => { setRailOpen(false); c.newSession() }}
            onOpen={openSession}
            onDelete={(id) => void c.removeSession(id)}
            onSearch={c.searchSessions}
          />
        </div>

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {c.active || c.items.length > 0 ? (
            <header className="flex items-center gap-3 px-6 h-12 shrink-0 min-w-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <h1 className="text-[14px] font-semibold truncate min-w-0">{title}</h1>
              <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] px-1.5 py-0.5 rounded-[6px] shrink-0" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{profileTitle}</span>
                {workspace && (
                  <button onClick={() => navigate(`/code?project=${encodeURIComponent(workspace)}`)} title="Open this project in the workbench"
                    className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-[6px] min-w-0 hover:underline"
                    style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                    <FolderGit2 size={11} className="shrink-0" /><span className="truncate">{workspace}</span>
                  </button>
                )}
              </div>
            </header>
          ) : null}

          {c.error && (
            <div role="alert" className="mx-6 mt-3 flex items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px]"
              style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--text)' }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
              <span className="flex-1 min-w-0 break-words">{c.error}</span>
              {!c.model.ok && (
                <button onClick={() => navigate('/settings')} className="shrink-0 underline" style={{ color: 'var(--primary)' }}>Settings</button>
              )}
              <button onClick={c.dismissError} aria-label="Dismiss" className="shrink-0 p-0.5" style={{ color: 'var(--text-3)' }}><X size={13} /></button>
            </div>
          )}

          {!c.model.ok && !c.error && (
            <div className="mx-6 mt-3 flex items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} />
              <span>{c.model.reason}</span>
            </div>
          )}

          {isNew && c.items.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="mx-auto max-w-[620px] px-6 pt-[9vh] pb-8 text-center">
                <div className="flex justify-center mb-5"><CodersaMascot state={mascot} size={96} /></div>
                <h1 className="text-[26px] font-semibold tracking-tight">What should we build?</h1>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  Codersa reads, changes and tests code in a project folder you choose. Pick a project below, then say what you need.
                </p>
                <div className="mt-7 grid gap-2 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => pick(s)}
                      className="group flex items-center gap-3 rounded-[14px] px-4 py-3 text-left text-[13px] transition-colors hover:bg-[var(--elevated)]"
                      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}>
                      <Sparkles size={14} className="shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="flex-1">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Thread
              items={c.items}
              hidden={c.hidden}
              busy={c.busy}
              outcome={c.outcome}
              onFork={(at) => void c.forkAt(at)}
              canFork={!c.busy && !!c.activeId}
              sessionKey={c.activeId}
            />
          )}

          {c.loading && <p className="sr-only" role="status">Opening session…</p>}

          <Composer
            draft={draft}
            setDraft={setDraft}
            busy={c.busy}
            canSend={canSend}
            onSend={send}
            onStop={c.stop}
            isNew={isNew}
            profiles={c.profiles}
            profile={c.prefs.profile}
            setProfile={c.setProfile}
            projects={c.projects}
            project={c.prefs.project}
            setProject={c.setProject}
            workspace={workspace}
            allowCommands={c.prefs.allowCommands}
            setAllowCommands={c.setAllowCommands}
            focusKey={c.activeId ?? 'new'}
          />
        </main>
      </div>
    </div>
  )
}
