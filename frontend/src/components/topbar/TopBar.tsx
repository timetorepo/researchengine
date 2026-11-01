import React, { useEffect, useState } from 'react'
import { Menu, Wind, ListChecks, ArrowDownToLine, X, Maximize2, Minimize2, Layers } from 'lucide-react'
import { SESSION_SWITCHER_EVENT } from '@/components/sessions/SessionSwitcher'
import { fullscreenSupported, isFullscreen, onFullscreenChange, toggleFullscreen } from '@/lib/dom/fullscreen'
import { useLocation } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { useUpdates } from '@/lib/updates/client'
import { ModelPicker } from '@/components/topbar/ModelPicker'
import { AnimatedCounter } from '@/components/ui/reactbits/AnimatedCounter'
import { FocusPill } from '@/components/shared/FocusPill'
import { BUNDLE_BUILD as BUILD_ID, useRunningVersion } from '@/lib/appVersion'
import { PrivacyShield } from '@/components/sidebar/Sidebar'
import { ResourceMeter } from '@/components/topbar/ResourceMeter'
import { MusicControl } from '@/components/topbar/MusicControl'
import { useAgents } from '@/lib/ide/agents'
import StatusMark from '@/components/ui/reactbits/micro/StatusMark'
// SmoothUI's AIContextMeter — the ring that shows how full the window is.
import AIContextMeter from '@/components/smoothui/ai-context-meter'
import { contextWindowFor } from '@/lib/providers/context-window'

/**
 * Opens the iOS-style session switcher (CardSwap deck of recent sessions).
 * The same switcher is on the alt+shift shortcut.
 */
function SessionSwitcherButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(SESSION_SWITCHER_EVENT))}
      aria-label="Switch session"
      title="Switch session (alt+shift)"
      data-ui="session-switcher-toggle"
      className="p-2 rounded-[10px] hover:bg-[var(--elevated)]"
      style={{ color: 'var(--text-3)' }}
    >
      <Layers size={16} />
    </button>
  )
}

/**
 * One press gives the app the whole window. The icon tracks the browser's
 * real fullscreen state — F11, the webview's own menu and this button all
 * agree — and where the shell has no fullscreen API the button is absent
 * rather than dead.
 */
function FullscreenButton() {
  const [on, setOn] = useState(isFullscreen())
  const [supported] = useState(fullscreenSupported())
  useEffect(() => onFullscreenChange(() => setOn(isFullscreen())), [])
  if (!supported) return null
  return (
    <button
      onClick={() => { void toggleFullscreen().then(() => setOn(isFullscreen())) }}
      aria-label={on ? 'Leave fullscreen' : 'Fullscreen'}
      aria-pressed={on}
      title={on ? 'Leave fullscreen' : 'Fullscreen — the whole window for the app'}
      data-ui="fullscreen-toggle"
      className="p-2 rounded-[10px] hover:bg-[var(--elevated)]"
      style={{ color: on ? 'var(--primary)' : 'var(--text-3)' }}
    >
      {on ? <Minimize2 size={16} strokeWidth={1.6} /> : <Maximize2 size={16} strokeWidth={1.6} />}
    </button>
  )
}

/**
 * Agent activity for the topbar.
 *
 * While any agent is forking or running, a StatusMark with the count sits on the
 * bar. The component is named for the React Bits Status Mark it uses; the mark is
 * the bit that reads at a glance from across the window. With two or more agents
 * the single dot is not enough — a count with no names tells you nothing — so the
 * expanded tooltip lists what each one is doing. One agent keeps the dot alone.
 */
function AgentPulse() {
  const tasks = useAgents((s) => s.tasks)
  const running = tasks.filter((t) => t.status === 'running' || t.status === 'forking')
  const [open, setOpen] = useState(false)
  if (running.length === 0) return null
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${running.length} agent${running.length === 1 ? '' : 's'} working`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}
      >
        <StatusMark status="running" size={9} />
        {running.length > 1 ? `${running.length} agents` : 'Agent'}
      </button>
      {open && running.length > 1 && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[200px] surface p-2 rounded-xl flex flex-col gap-1"
        >
          {running.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              <StatusMark status="running" size={8} />
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const ui = useUI()
  /** Stamped into the bundle, or read from the server when it could not be. */
  const version = useRunningVersion()
  const tasks = useStore((s) => s.tasks)
  const settings = useStore((s) => s.settings)
  const saved = useStore((s) => s.tokensSavedSession)
  const integrations = useStore((s) => s.integrations)
  const anyIntegration = Object.values(integrations).some((i) => i.connected)
  // Quiet update check (nothing downloads without a press) + a pill when there is
  // something newer, so the fix for "I am tired of reinstalling" is visible.
  const { check: updateCheck } = useUpdates({ autoCheck: settings.updates?.autoCheck !== false })
  /**
   * How full the context window is on the chat you are looking at. The prompt
   * size of the last answer is what the model had to read; the window itself
   * comes from a family table because no provider reports it.
   */
  const location = useLocation()
  const openChatId = location.pathname.startsWith('/chat/') ? location.pathname.slice(6).split('/')[0] : ''
  const openChat = useStore((s) => (openChatId ? s.chats.find((c) => c.id === openChatId) : undefined))
  let lastPrompt: { tokens: number; model?: string } | null = null
  if (openChat) {
    for (let i = openChat.messages.length - 1; i >= 0; i--) {
      const m = openChat.messages[i]
      if (m.role === 'assistant' && m.usage && m.usage.prompt > 0) { lastPrompt = { tokens: m.usage.prompt, model: m.model }; break }
    }
  }
  const updateDismissed = settings.updates?.dismissed === updateCheck?.latest
  const showUpdatePill = !!updateCheck?.available && !updateDismissed

  /**
   * "Whenever a new update comes, the user will know."
   *
   * The quiet check the app already ran on open is the trigger — what was
   * missing was a way of being told. A version we have not announced on this
   * machine pops the update modal once; a version the user dismissed is never
   * announced again; and the record lives in settings, so it survives a reload.
   */
  useEffect(() => {
    const latest = updateCheck?.latest
    if (!latest || !updateCheck?.available) return
    const updates = settings.updates ?? {}
    if (updates.prompted === latest || updates.dismissed === latest) return
    // Wait a beat: announcing an update over a page that is still painting is
    // the kind of thing that makes an app feel like it is shouting.
    const id = window.setTimeout(() => {
      if (useUI.getState().updatePopup) return
      useStore.setState((s) => ({
        settings: { ...s.settings, updates: { ...(s.settings.updates ?? {}), prompted: latest } },
      }))
      useUI.setState({ updatePopup: latest })
    }, 4000)
    return () => window.clearTimeout(id)
  }, [updateCheck?.latest, updateCheck?.available, settings.updates?.prompted, settings.updates?.dismissed])

  return (
    <header
      className="re-vt-topbar flex items-center gap-2 px-3 h-12 shrink-0 relative z-30"
      style={{ borderBottom: '1px solid var(--surface-border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(12px)' }}
    >
      <button className="md:hidden p-2 rounded-lg hover:bg-[var(--elevated)]" aria-label="Open menu" onClick={() => ui.set({ sidebarOpenMobile: true })}>
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {/* Model selector — its own component: dock hover, logos, free/paid, unlist */}
      <ModelPicker />

      {/* Local badge */}
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' }}>
        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--success)' }} /> Local
      </span>

      {/* Agent activity. StatusMark sits on the topbar while anything is running;
          with two or more it expands into a list of what each one is doing,
          because a single dot with no names is the same as no indicator. */}
      <AgentPulse />

      <div className="flex-1" />

      {/* Developer Mode: which build you are actually looking at. The first
          question behind any "the fix did not work" is a stale bundle. */}
      {settings.developerMode && (
        <span
          className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono"
          style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}
          title={`Build ${BUILD_ID}`}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--warning)' }} />
          {version}
        </span>
      )}

      {/* Privacy shield — moved up here from the sidebar footer so the state of
          the shield (and the one-tap way into what it is doing) is visible from
          every screen, not just when the sidebar is open. */}
      {/* Tasks: the same list in Research and Coding; pinned rows are the
          main thing, and the panel can hand them straight to the composer. */}
      <button
        onClick={() => ui.set({ tasksOpen: !ui.tasksOpen })}
        aria-label="Tasks"
        aria-pressed={ui.tasksOpen}
        className="relative p-2 rounded-[10px] hover:bg-[var(--elevated)]"
        style={{ color: ui.tasksOpen ? 'var(--primary)' : 'var(--text-3)' }}
      >
        <ListChecks size={16} />
        {(() => {
          const pinned = tasks.filter((t) => t.pinned && !t.done).length
          const openCount = tasks.filter((t) => !t.done).length
          if (!openCount) return null
          return (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9.5px] flex items-center justify-center font-semibold"
              style={{ background: pinned ? 'var(--primary)' : 'var(--elevated)', color: pinned ? '#fff' : 'var(--text-3)' }}>
              {openCount}
            </span>
          )
        })()}
      </button>
      {showUpdatePill && (
        <div className="flex items-center gap-0.5 rounded-full pl-2 pr-1 py-0.5 text-[11px]"
          style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
          <button
            onClick={() => ui.set({ updatePopup: updateCheck?.latest ?? 'latest' })}
            className="flex items-center gap-1 pr-1 font-medium"
            title={`${updateCheck?.latest} is available — see what's new and download it`}
          >
            <ArrowDownToLine size={12} />
            {updateCheck?.latest}
          </button>
          <button
            aria-label="Dismiss update notice"
            onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, updates: { ...(s.settings.updates ?? {}), dismissed: updateCheck?.latest ?? undefined } } }))}
            className="p-0.5 rounded-full hover:bg-[var(--elevated)]"
          >
            <X size={11} />
          </button>
        </div>
      )}
      {/* Fullscreen — the whole window for the app. The icon tracks the real
          fullscreen state (including F11 and the webview's own menus), and on
          a shell without the API the button simply is not there. */}
      <SessionSwitcherButton />
      <FullscreenButton />

      {/* Live machine load — memory, processor and GPU, from the server's own
          samples. Sits beside the privacy shield because it answers the other
          "what is this app doing" question. */}
      {settings.showResourceMeter === true && <ResourceMeter />}

      <PrivacyShield compact amber={anyIntegration} />

      {/* Focus timer — same idea: it belongs to the shell, not the sidebar. */}
      <FocusPill />

      {/* Context window — only while a chat is open and has been answered. */}
      {lastPrompt && (
        <div className="hidden md:flex items-center" title="Estimated from the last request — providers do not report their window size">
          <AIContextMeter used={lastPrompt.tokens} limit={contextWindowFor(lastPrompt.model)} />
        </div>
      )}

      {/* Music control: on by default, and hidden from Settings → Appearance. */}
      {settings.showMusicControl !== false && <MusicControl />}

      {/* Flow savings counter */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px]"
        style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
        title="AIFlowEngine session token savings"
      >
        <Wind size={12.5} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
        Saved <span style={{ color: 'var(--text)' }}><AnimatedCounter value={saved} className="font-semibold" /></span> tokens this session
      </div>
    </header>
  )
}
