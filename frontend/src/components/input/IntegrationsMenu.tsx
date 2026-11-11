import { openMarketplace } from '@/lib/composio/sync'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check, ChevronRight, Github, HardDrive, Loader2, Mail, Calendar, Settings2, GraduationCap,
  StickyNote, Hash, FolderOpen, Plug, AlertCircle, Unplug,
} from 'lucide-react'
import { INTEGRATIONS, FIELD_LABELS, integrationById, type IntegrationId } from '@/lib/integrations/registry'
import {
  integrationSummary, probeIntegration, readIntegrationItem, saveCreds, searchIntegrations,
  type IntHit,
} from '@/lib/integrations/client'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  files: FolderOpen, drive: HardDrive, gmail: Mail, gcal: Calendar, github: Github, notion: StickyNote, slack: Hash,
}

export interface IntegrationPick { integration: IntegrationId; id: string; title: string }

/**
 * The composer's plug menu.
 *
 * It is both the *entry point* to connected data and the place you connect an
 * account: search across everything that is connected, read an item into the
 * chat as context, and — when something is not connected — paste its token
 * right here (it is encrypted in this browser exactly like a provider key) and
 * test it against the real service before you rely on it.
 */
export function IntegrationsMenu({
  anchor, onPick, onClose,
}: {
  anchor: HTMLElement | null
  onPick: (pick: IntegrationPick) => void
  onClose: () => void
}) {
  const settings = useStore((s) => s.settings)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<IntHit[]>([])
  const [problems, setProblems] = useState<{ integration: string; name: string; error?: string; needs?: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null)
  const [connecting, setConnecting] = useState<IntegrationId | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Anchoring: same contract as the mode menu — computed from the trigger, so
  // nothing can be clipped by the composer's own box.
  useEffect(() => {
    const r = anchor?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(384, window.innerWidth - 24)
    setPos({
      left: Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12)),
      bottom: Math.max(12, window.innerHeight - r.top + 8),
      width,
    })
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Scrolling the page closes the popover — but scrolling the result list does not.
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return
      onClose()
    }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  // Recompute which accounts are connected whenever credentials change.
  const summary = useMemo(() => integrationSummary(), [settings.integrations])
  const connected = summary.filter((s) => s.connected && s.auth !== 'none')
  const disconnected = summary.filter((s) => !s.connected)

  useEffect(() => {
    let live = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const reply = await searchIntegrations(query.trim(), { limit: 8 })
        if (!live) return
        setHits(reply.results ?? [])
        setProblems(reply.errors ?? [])
      } catch (e: any) {
        if (live) { setHits([]); setProblems([{ integration: '', name: 'Search', error: String(e?.message ?? e) }]) }
      } finally {
        if (live) setLoading(false)
      }
    }, 180)
    return () => { live = false; clearTimeout(t) }
  }, [query, settings.integrations])

  const openSettings = useCallback(() => {
    useUI.getState().set({ connectorsTab: 'builtin' }); openMarketplace()
    onClose()
  }, [onClose])

  const attach = useCallback(async (hit: IntHit) => {
    // Local files are read straight away; remote items carry their id and are
    // fetched when the message is sent (or through the agent's tools). Then the
    // menu gets out of the way: picking something is the end of the interaction.
    onPick({ integration: hit.integration, id: hit.id, title: hit.title })
    onClose()
  }, [onPick, onClose])

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Connected data"
        data-int-menu=""
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[80] flex flex-col overflow-hidden rounded-[16px] re-int-menu"
        style={{
          left: pos?.left ?? -9999,
          bottom: pos?.bottom ?? -9999,
          width: pos?.width ?? 384,
          maxHeight: 'min(70vh, 460px)',
          background: 'var(--elevated)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 22px 50px -18px rgba(0,0,0,.62)',
        }}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <Plug size={13} strokeWidth={1.8} style={{ color: 'var(--text-3)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>Connected data</span>
          <span className="flex-1" />
          <button onClick={() => { useUI.getState().set({ integrationTutorial: true }); openSettings() }}
            className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ color: 'var(--text-3)' }} title="A step-by-step walk: the console, the credential, the real test">
            <GraduationCap size={11} /> Tutorial
          </button>
          <button onClick={openSettings} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ color: 'var(--text-2)', background: 'var(--surface)' }}>
            <Settings2 size={11} /> Manage
          </button>
        </div>

        {/* search */}
        <div className="px-3 pt-2.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={connected.length ? 'Search mail, docs, events, code…' : 'Search your local files…'}
            aria-label="Search connected data"
            className="w-full px-2.5 py-2 rounded-[10px] text-[12.5px] outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
          />
        </div>

        {/* accounts strip */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
          {summary.filter((s) => s.auth !== 'none').map((s) => {
            const Icon = ICONS[s.id] ?? Plug
            const isConnected = s.connected
            return (
              <button key={s.id} onClick={() => setConnecting(isConnected ? null : s.id)}
                title={isConnected ? `${s.name}${s.account ? ` — ${s.account}` : ''}` : `Connect ${s.name}`}
                aria-label={isConnected ? `${s.name} connected` : `Connect ${s.name}`}
                data-connected={isConnected ? '' : undefined}
                className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-[11px] transition-colors"
                style={{
                  background: isConnected ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'var(--surface)',
                  color: isConnected ? 'var(--success)' : 'var(--text-3)',
                  border: '1px solid var(--surface-border)',
                }}>
                <Icon size={12} strokeWidth={1.8} />
                {s.name.replace('Google ', '')}
                {isConnected ? <Check size={10} strokeWidth={3} /> : <ChevronRight size={10} />}
              </button>
            )
          })}
        </div>

        {/* inline connect form */}
        {connecting && <ConnectForm id={connecting} onDone={() => setConnecting(null)} />}

        {/* results */}
        <div className="flex-1 overflow-y-auto px-1.5 py-2 min-h-[64px]">
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>
              <Loader2 size={13} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && hits.length === 0 && query.trim() !== '' && (
            <div className="px-2.5 py-3 text-[12px]" style={{ color: 'var(--text-3)' }}>
              No match for “{query}” in {connected.length ? `your ${connected.length} connected source${connected.length === 1 ? '' : 's'}` : 'your workspace'}.
            </div>
          )}
          {/* Empty query: the whole catalogue, with the state of each one. */}
          {!loading && hits.length === 0 && query.trim() === '' && (
            <div className="py-1">
              <div className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--text-3)' }}>
                Sources
              </div>
              {summary.map((s) => {
                const Icon = ICONS[s.id] ?? Plug
                const hue = integrationById(s.id)?.hue ?? 210
                const isConnected = s.auth === 'none' ? true : s.connected
                return (
                  <div key={s.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] hover:bg-[var(--surface)] transition-colors">
                    <span className="w-6 h-6 rounded-[8px] shrink-0 grid place-items-center"
                      style={{ background: `hsl(${hue} 50% 45% / 0.18)`, color: `hsl(${hue} 62% 62%)` }}>
                      <Icon size={13} strokeWidth={1.6} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] truncate" style={{ color: 'var(--text)' }}>{s.name}</span>
                      <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>
                        {s.auth === 'none' ? 'This machine · no account needed'
                          : isConnected ? `Connected${s.account ? ` as ${s.account}` : ''}`
                          : 'Not connected'}
                      </span>
                    </span>
                    {s.auth !== 'none' && !isConnected && (
                      <button onClick={() => setConnecting(s.id)} aria-label={`Connect ${s.name}`}
                        className="px-2 py-0.5 rounded-full text-[11px] shrink-0"
                        style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--surface-border)' }}>
                        Connect
                      </button>
                    )}
                    {isConnected && (
                      <span className="shrink-0" style={{ color: 'var(--success)' }}><Check size={12} strokeWidth={2.6} /></span>
                    )}
                  </div>
                )
              })}
              <div className="px-2.5 pt-1.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                Type to search everything connected — results attach to your message as context the agent can read.
              </div>
            </div>
          )}
          {!loading && hits.map((hit) => {
            const def = integrationById(hit.integration)
            const Icon = ICONS[hit.integration] ?? Plug
            return (
              <button key={`${hit.integration}-${hit.id}`} onClick={() => void attach(hit)}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[10px] text-left hover:bg-[var(--surface)] transition-colors">
                <span className="mt-0.5 w-6 h-6 rounded-[8px] shrink-0 grid place-items-center"
                  style={{ background: `hsl(${def?.hue ?? 210} 50% 45% / 0.18)`, color: `hsl(${def?.hue ?? 210} 62% 62%)` }}>
                  <Icon size={13} strokeWidth={1.6} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] truncate" style={{ color: 'var(--text)' }}>{hit.title}</span>
                  <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>
                    {def?.name ?? hit.integration}{hit.subtitle ? ` · ${hit.subtitle}` : ''}
                  </span>
                </span>
              </button>
            )
          })}
          {!loading && problems.map((p) => (
            <div key={`${p.integration}-${p.error}`} className="flex items-start gap-2 px-2.5 py-2 text-[11.5px]"
              style={{ color: p.needs === 'auth' ? 'var(--warning)' : 'var(--danger)' }}>
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="flex-1">{p.name}: {p.error}</span>
              {p.needs === 'auth' && p.integration && (
                <button onClick={() => setConnecting(p.integration as IntegrationId)}
                  className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: 'var(--surface)', color: 'var(--text-2)' }}>
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** Paste a credential for one integration, test it for real, keep it encrypted. */
function ConnectForm({ id, onDone }: { id: IntegrationId; onDone: () => void }) {
  const def = integrationById(id)!
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<{ kind: 'idle' | 'ok' | 'err'; message?: string }>({ kind: 'idle' })
  const toast = useUI((s) => s.toast)

  const save = async () => {
    setBusy(true)
    setState({ kind: 'idle' })
    try {
      await saveCreds(id, values)
      const out = await probeIntegration(id)
      setState({ kind: 'ok', message: out.account ? `Connected as ${out.account}` : out.detail })
      toast(`${def.name} connected`, out.account ? `Reading as ${out.account}.` : 'The token works.', 'success')
      setTimeout(onDone, 650)
    } catch (e: any) {
      setState({ kind: 'err', message: String(e?.message ?? e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-3 mt-2.5 mb-1 p-2.5 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>Connect {def.name}</span>
        <span className="flex-1" />
        <button onClick={onDone} className="text-[11px]" style={{ color: 'var(--text-3)' }}>Close</button>
      </div>
      <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--text-3)' }}>
        {def.hint}
        {def.docs && <> <a href={def.docs} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Get a token</a></>}
      </p>
      {def.fields.map((field) => {
        const meta = FIELD_LABELS[field]
        return (
          <label key={field} className="block mb-1.5">
            <span className="block text-[10.5px] mb-0.5" style={{ color: 'var(--text-3)' }}>{meta.label}</span>
            <input
              type={meta.secret ? 'password' : 'text'}
              value={values[field] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              placeholder={meta.placeholder}
              aria-label={`${def.name} ${meta.label}`}
              className="w-full px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none font-mono"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            />
          </label>
        )
      })}
      <div className="flex items-center gap-2 mt-1">
        <button onClick={() => void save()} disabled={busy || !Object.values(values).some((v) => v?.trim())}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {busy ? 'Testing…' : 'Save & test'}
        </button>
        <button
          onClick={async () => { await saveCreds(id, {}, { clear: true }); toast(`${def.name} disconnected`, 'The saved credential was deleted.', 'info'); onDone() }}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[11.5px]"
          style={{ color: 'var(--text-3)' }}>
          <Unplug size={11} /> Disconnect
        </button>
      </div>
      {state.message && (
        <div className="mt-1.5 text-[11px]" style={{ color: state.kind === 'ok' ? 'var(--success)' : 'var(--danger)' }}>{state.message}</div>
      )}
    </div>
  )
}
