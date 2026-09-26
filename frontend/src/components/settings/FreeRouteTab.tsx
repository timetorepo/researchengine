import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, Check, X, Loader2, RefreshCw, Zap, ArrowUp, ArrowDown, PlugZap, CircleDot, Gauge, ShieldCheck, Copy,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { smoothCaretProps } from '@/components/input/SmoothText'
import { Button } from '@/components/ui/heroui/Button'

/**
 * Settings → FreeRoute.
 *
 * FreeRoute is one endpoint in front of the free tiers. This page is the
 * console for it: which routes exist, whether they answer right now, which
 * models they actually offer for free, and the order requests walk when one of
 * them rate-limits. A rate limit is a detour, not an error — so the order is
 * the feature, and it is editable here rather than hidden in a config file.
 */

interface RouteRow {
  id: string
  name: string
  baseUrl: string
  note: string
  docs: string | null
  keyFrom: string | null
  keyless: boolean
  freeOnly: boolean
  seedModels: string[]
  hasKey: boolean
}

interface ProbeResult {
  id: string
  ok: boolean
  ms: number
  models: string[]
  usable: string[]
  error?: string
}

const STATUS_TONE = { ok: 'var(--success)', dead: 'var(--danger)', idle: 'var(--text-3)', loading: 'var(--primary)' } as const

export function FreeRouteTab() {
  const settings = useStore((s) => s.settings)
  // Settings are patched onto the store the same way every other tab does it.
  const patch = (p: Partial<typeof settings>) => useStore.setState((st) => ({ settings: { ...st.settings, ...p } }))
  const fr = settings.freeRoute ?? { enabled: true, order: [], keys: {}, disabled: [] }
  const [catalog, setCatalog] = useState<RouteRow[]>([])
  const [results, setResults] = useState<Record<string, ProbeResult>>({})
  const [probing, setProbing] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({})

  const providerKeys = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [id, conf] of Object.entries(settings.providers)) if (conf?.apiKey) out[id] = conf.apiKey
    return out
  }, [settings.providers])

  const headers = useCallback(() => {
    const keys: Record<string, string> = { ...providerKeys }
    for (const [id, key] of Object.entries(fr.keys ?? {})) if (key) keys[id] = key
    return { 'content-type': 'application/json', 'x-re-freeroute-keys': JSON.stringify(keys) }
  }, [providerKeys, fr.keys])

  // The user's order, with anything new appended — a route added in a later
  // release must show up without the settings being reset.
  const order = useMemo(() => {
    const stored = (fr.order ?? []).filter((id) => catalog.some((r) => r.id === id))
    const missing = catalog.map((r) => r.id).filter((id) => !stored.includes(id))
    return [...stored, ...missing]
  }, [fr.order, catalog])

  const ordered = useMemo(() => order.map((id) => catalog.find((r) => r.id === id)!).filter(Boolean), [order, catalog])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/freeroute/catalog', { headers: await freshKeys(settings) })
      const json = await res.json()
      setCatalog(json.routes ?? [])
    } catch {
      useUI.getState().toast('FreeRoute catalogue unavailable', 'The local backend did not answer. Is it running?', 'danger')
    }
  }, [settings])

  useEffect(() => { void load() }, [load])

  const probeAll = useCallback(async () => {
    setProbing(true)
    try {
      const res = await fetch('/api/freeroute/probe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await freshKeys(settings)) },
        body: JSON.stringify({ order }),
      })
      const json = await res.json()
      const map: Record<string, ProbeResult> = {}
      for (const r of json.results ?? []) map[r.id] = r
      setResults(map)
      patch({ freeRoute: { ...fr, lastProbe: Date.now() } })
      useUI.getState().toast(
        json.ok ? `${json.ok} of ${json.total} routes answering` : 'No free route is answering',
        json.ok ? 'FreeRoute will fail over between them in the order below.' : 'Add a key, or start your local model server.',
        json.ok ? 'success' : 'danger',
      )
    } catch (e: any) {
      useUI.getState().toast('Probe failed', e?.message ?? 'The backend did not answer.', 'danger')
    } finally {
      setProbing(false)
    }
  }, [order, settings, fr, patch])

  const testOne = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch('/api/freeroute/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await freshKeys(settings)) },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      setResults((r) => ({ ...r, [id]: json }))
      if (json.ok) {
        useUI.getState().toast(
          json.generation ? `${json.name ?? id} answered “${json.generation}”` : `${id} is reachable`,
          `${json.usable?.length ?? 0} free model${json.usable?.length === 1 ? '' : 's'} · ${json.ms}ms`,
          'success',
        )
      } else {
        useUI.getState().toast(`${id} is not answering`, json.error ?? 'No detail from the provider.', 'danger')
      }
    } catch (e: any) {
      useUI.getState().toast('Test failed', e?.message ?? 'Request failed', 'danger')
    } finally {
      setTesting(null)
    }
  }

  const move = (id: string, delta: number) => {
    const next = [...order]
    const i = next.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    patch({ freeRoute: { ...fr, order: next } })
  }

  const toggleDisabled = (id: string) => {
    const disabled = new Set(fr.disabled ?? [])
    if (disabled.has(id)) disabled.delete(id)
    else disabled.add(id)
    patch({ freeRoute: { ...fr, disabled: [...disabled] } })
  }

  const saveRouteKey = (id: string, value: string) => {
    patch({ freeRoute: { ...fr, keys: { ...(fr.keys ?? {}), [id]: value } } })
  }

  const setAsDefault = () => {
    const first = ordered.find((r) => !(fr.disabled ?? []).includes(r.id) && (r.keyless || r.hasKey || fr.keys?.[r.id]))
    const model = first ? results[first.id]?.usable?.[0] ?? first.seedModels[0] : ''
    patch({ defaultModel: model ? `freeroute:${first!.id}/${model}` : settings.defaultModel })
    useUI.getState().toast('Default model set to FreeRoute', model ? `${first!.name} · ${model}` : 'Pick a route with a key first.', model ? 'success' : 'danger')
  }

  const healthyCount = Object.values(results).filter((r) => r.ok).length

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
          <Route size={19} />
        </span>
        <div className="flex-1">
          <h2 className="text-[15px] font-medium">FreeRoute</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            One OpenAI-compatible route through every free tier — free publicity models, free developer tiers, and the
            models running on your own machine. When one rate-limits, the next answers.
          </p>
        </div>
      </div>

      {/* The endpoint, for anyone who wants to point another tool at it. */}
      <div className="surface p-4 space-y-2">
        <div className="flex items-center gap-2 text-[13px] font-medium"><PlugZap size={15} style={{ color: 'var(--primary)' }} /> Your endpoint</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-[10px] text-[12px] font-mono overflow-x-auto whitespace-nowrap"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
            http://127.0.0.1:8787/api/freeroute/v1
          </code>
          <Button variant="flat" size="sm" startContent={<Copy size={13} />}
            onClick={() => { void navigator.clipboard?.writeText('http://127.0.0.1:8787/api/freeroute/v1'); useUI.getState().toast('Endpoint copied', 'Point any OpenAI-compatible client at it.', 'success') }}>
            Copy
          </Button>
        </div>
        <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Works with the app itself (provider <b>FreeRoute</b>) and with anything that speaks the OpenAI API. The order below is
          sent as <code>x-re-freeroute-order</code>; keys stay in this machine&apos;s vault and are only used for the request in flight.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="solid" size="sm" startContent={probing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          disabled={probing} onClick={() => void probeAll()}>
          {probing ? 'Probing…' : 'Probe all routes'}
        </Button>
        <Button variant="flat" size="sm" startContent={<Zap size={14} />} onClick={setAsDefault}>Use as default model</Button>
        <span className="text-[12px] ml-auto flex items-center gap-1.5" style={{ color: healthyCount ? 'var(--success)' : 'var(--text-3)' }}>
          <CircleDot size={13} /> {healthyCount ? `${healthyCount} route${healthyCount === 1 ? '' : 's'} answering` : 'not probed yet'}
        </span>
      </div>

      <div className="space-y-2.5">
        {ordered.map((r, i) => {
          const res = results[r.id]
          const disabled = (fr.disabled ?? []).includes(r.id)
          const tone = disabled ? STATUS_TONE.idle : res ? (res.ok ? STATUS_TONE.ok : STATUS_TONE.dead) : STATUS_TONE.idle
          const needsKey = !r.keyless && !r.hasKey && !fr.keys?.[r.id]
          return (
            <motion.div key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.15) }}
              className="surface p-4" style={{ opacity: disabled ? 0.55 : 1, borderColor: res?.ok && !disabled ? 'color-mix(in srgb, var(--success) 35%, var(--surface-border))' : 'var(--surface-border)' }}>
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: tone, boxShadow: res?.ok ? `0 0 8px ${tone}` : undefined }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium">{r.name}</span>
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>#{i + 1}</span>
                    {r.keyless && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' }}>no key</span>}
                    {r.freeOnly && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>free ids only</span>}
                    {needsKey && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warning) 18%, transparent)', color: 'var(--warning)' }}>needs a key</span>}
                  </div>
                  <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>{r.note}</p>

                  {res && (
                    <div className="mt-2 text-[11.5px]" style={{ color: res.ok ? 'var(--success)' : 'var(--danger)' }}>
                      {res.ok
                        ? <span className="inline-flex items-center gap-1.5"><Check size={12} /> {res.ms}ms · {res.usable.length ? res.usable.slice(0, 3).join(', ') : 'no free models listed'}{res.usable.length > 3 ? ` +${res.usable.length - 3}` : ''}</span>
                        : <span className="inline-flex items-center gap-1.5"><X size={12} /> {res.error}</span>}
                    </div>
                  )}

                  {needsKey && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="password"
                        value={keyDrafts[r.id] ?? fr.keys?.[r.id] ?? ''}
                        onChange={(e) => setKeyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        placeholder={r.keyFrom ? `Key for ${r.keyFrom} (or paste here)` : 'Route API key'}
                        autoComplete="off"
                        className="flex-1 px-3 py-1.5 rounded-[9px] bg-transparent outline-none text-[12px] font-mono"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                        {...smoothCaretProps()}
                      />
                      <Button variant="flat" size="sm" onClick={() => { saveRouteKey(r.id, keyDrafts[r.id] ?? ''); useUI.getState().toast('Key saved locally', `${r.name} will be used on the next probe.`, 'success') }}>Save</Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button onClick={() => move(r.id, -1)} disabled={i === 0} aria-label={`Move ${r.name} up`}
                    className="p-1.5 rounded-[8px] disabled:opacity-25" style={{ color: 'var(--text-3)' }}><ArrowUp size={14} /></button>
                  <button onClick={() => move(r.id, 1)} disabled={i === ordered.length - 1} aria-label={`Move ${r.name} down`}
                    className="p-1.5 rounded-[8px] disabled:opacity-25" style={{ color: 'var(--text-3)' }}><ArrowDown size={14} /></button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <Button variant="ghost" size="sm" startContent={testing === r.id ? <Loader2 size={13} className="animate-spin" /> : <Gauge size={13} />}
                  disabled={testing === r.id} onClick={() => void testOne(r.id)}>Test</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleDisabled(r.id)}>
                  {disabled ? 'Enable' : 'Disable'}
                </Button>
                {r.docs && (
                  <a className="text-[11.5px] hover:underline" style={{ color: 'var(--text-3)' }} href={r.docs} target="_blank" rel="noreferrer">docs ↗</a>
                )}
                <span className="text-[11px] ml-auto font-mono truncate max-w-[46%]" style={{ color: 'var(--text-3)' }}>{r.baseUrl}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {healthyCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 text-[12px] p-3 rounded-[12px]"
            style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--text-2)' }}>
            <ShieldCheck size={15} style={{ color: 'var(--success)' }} className="mt-0.5 shrink-0" />
            <span>
              Requests go straight from this machine to the provider you picked — ResearchEngine never proxies your prompts
              through us, and the free routes are free because the providers offer them, not because anyone is paying.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Keys for the header, decrypted on demand (the vault may be locked). */
async function freshKeys(settings: any): Promise<Record<string, string>> {
  const { usableKey } = await import('@/lib/providers/keys')
  const keys: Record<string, string> = {}
  for (const [id, conf] of Object.entries<any>(settings.providers ?? {})) {
    if (!conf?.apiKey) continue
    try { keys[id] = await usableKey(conf.apiKey) } catch { /* vault locked — route reports it */ }
  }
  for (const [id, key] of Object.entries<string>(settings.freeRoute?.keys ?? {})) {
    if (key) keys[id] = key
  }
  return { 'x-re-freeroute-keys': JSON.stringify(keys) }
}
