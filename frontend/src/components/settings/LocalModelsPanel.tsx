/**
 * Local models: find a GGUF on Hugging Face, see whether it fits this machine,
 * and download it into Ollama without leaving Research Engine.
 *
 * Three categories (Official, Abliterated, Optimized). The recommendation comes
 * from a memory estimate for this device (fit.ts), and the person can correct
 * the device numbers. The panel is also opened from the model picker.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cpu, ExternalLink, Download, Trash2, RefreshCw, Search, Sparkles, AlertTriangle } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { Button } from '@/components/ui/heroui/Button'
import { Input } from '@/components/ui/heroui/Input'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { refreshProviderModels } from '@/lib/providers/refresh'
import { QUANTS, FIT_LABEL, estimateGB, fitFor, recommend, type Fit, type Quant } from '@/lib/local-models/fit'
import { detectDevice, loadDeviceOverride, saveDeviceOverride, type DeviceProfile, type DeviceOverride } from '@/lib/local-models/hardware'
import {
  CATEGORIES, installedLocalModels, ollamaNameFor, pullLocalModel, removeLocalModel, searchLocalModels,
  type HfModel, type InstalledModel, type LocalCategory,
} from '@/lib/local-models/client'

interface Progress { status: string; pct: number | null }

const FIT_COLOR: Record<Fit, string> = {
  comfortable: 'var(--success)',
  tight: 'var(--warning)',
  'too-heavy': 'var(--danger)',
  unknown: 'var(--text-3)',
}

const bytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`)
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n))

export function LocalModelsPanel() {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking')
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [device, setDevice] = useState<DeviceProfile>(() => detectDevice(loadDeviceOverride()))
  const [override, setOverride] = useState<DeviceOverride>({})
  const [category, setCategory] = useState<LocalCategory>('official')
  const [quant, setQuant] = useState<Quant>('Q4_K_M')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HfModel[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [notice, setNotice] = useState<{ status: 'success' | 'danger'; title: string; text: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestRef = useRef(0)

  const budget = device.budgetGB
  const selected = CATEGORIES.find((c) => c.id === category)!

  const refreshInstalled = useCallback(async () => {
    const list = await installedLocalModels()
    if (list === null) { setStatus('down'); setInstalled([]); return }
    setStatus('up')
    setInstalled(list)
  }, [])

  const runSearch = useCallback(async (cat: LocalCategory, q: string) => {
    const id = ++requestRef.current
    setSearching(true)
    setSearchError(null)
    try {
      const models = await searchLocalModels(cat, q)
      if (id === requestRef.current) setResults(models)
    } catch (e: any) {
      if (id === requestRef.current) { setResults([]); setSearchError(String(e?.message ?? e)) }
    } finally {
      if (id === requestRef.current) setSearching(false)
    }
  }, [])

  useEffect(() => {
    void refreshInstalled()
    return () => abortRef.current?.abort()
  }, [refreshInstalled])

  useEffect(() => { void runSearch(category, '') }, [category, runSearch])

  const applyOverride = (next: DeviceOverride) => {
    setOverride(next)
    saveDeviceOverride(next)
    setDevice(detectDevice(next))
  }

  const ranked = useMemo(() => {
    if (!results) return []
    return results.map((m) => {
      const gb = m.paramsB === null ? null : estimateGB(m.paramsB, quant)
      return { ...m, gb, fit: fitFor(gb, budget) as Fit }
    })
  }, [results, quant, budget])

  const pick = useMemo(() => (results ? recommend(results, budget, quant) : null), [results, budget, quant])

  const download = async (repo: string) => {
    const name = ollamaNameFor(repo, quant)
    setNotice(null)
    setProgress((p) => ({ ...p, [repo]: { status: 'Starting', pct: null } }))
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await pullLocalModel(name, (f) => {
        const pct = f.total && f.completed !== undefined ? Math.min(100, Math.round((f.completed / f.total) * 100)) : null
        setProgress((p) => ({ ...p, [repo]: { status: f.status || 'Working', pct } }))
      }, controller.signal)
      // Make the new model appear in the model picker, with Ollama added as a provider.
      useStore.setState((s) => ({
        settings: { ...s.settings, addedProviders: Array.from(new Set([...(s.settings.addedProviders ?? []), 'ollama'])) },
      }))
      await refreshProviderModels('ollama').catch(() => [])
      await refreshInstalled()
      setNotice({ status: 'success', title: 'Model installed', text: `${name} is ready. Pick it from the model picker.` })
    } catch (e: any) {
      if (e?.name !== 'AbortError') setNotice({ status: 'danger', title: 'Download failed', text: String(e?.message ?? e) })
    } finally {
      setProgress((p) => {
        const next = { ...p }
        delete next[repo]
        return next
      })
    }
  }

  const remove = async (name: string) => {
    setRemoving(name)
    try {
      await removeLocalModel(name)
      await refreshInstalled()
      void refreshProviderModels('ollama').catch(() => [])
    } catch (e: any) {
      setNotice({ status: 'danger', title: 'Could not remove it', text: String(e?.message ?? e) })
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section className="surface-elevated p-4 mb-5" style={{ borderRadius: 'var(--radius-card)' }} aria-labelledby="local-models-heading">
      <div className="flex items-center gap-2 mb-1">
        <Cpu size={16} strokeWidth={1.6} style={{ color: 'var(--primary)' }} aria-hidden />
        <h3 id="local-models-heading" className="text-[14px] font-semibold">Local models</h3>
      </div>
      <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>
        Run a model on this machine through Ollama, with nothing sent to a provider. Downloads come from Hugging Face.
      </p>

      {status === 'down' && (
        <div className="mb-4">
          <InlineAlert status="warning" title="Ollama is not running">
            Local models need Ollama. Install it from ollama.com, start it, then check again.{' '}
            <Button size="sm" variant="bordered" color="default" onClick={() => { setStatus('checking'); void refreshInstalled() }}>
              <RefreshCw size={12} aria-hidden /> Check again
            </Button>
          </InlineAlert>
        </div>
      )}

      {notice && (
        <div className="mb-4">
          <InlineAlert status={notice.status} title={notice.title} onClose={() => setNotice(null)}>{notice.text}</InlineAlert>
        </div>
      )}

      {(
        <div className="rounded-[14px] p-3 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span><b>This machine:</b> {device.ramGB ? `${device.ramGB} GB memory` : 'memory not reported'}, {device.cores} cores{device.webgpu ? ', WebGPU available' : ''}</span>
            <span style={{ color: 'var(--text-2)' }}>Recommended budget for one model: <b style={{ color: 'var(--text)' }}>{device.budgetGB} GB</b> ({device.basis})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <Input
              label="System memory (GB)"
              type="number"
              value={override.ramGB ? String(override.ramGB) : ''}
              onChange={(v) => applyOverride({ ...override, ramGB: Number(v) || undefined })}
              placeholder={device.ramGB ? String(device.ramGB) : 'e.g. 16'}
              description="Browsers report at most 8 GB. Enter your real amount."
            />
            <Input
              label="Video memory (GB, optional)"
              type="number"
              value={override.vramGB ? String(override.vramGB) : ''}
              onChange={(v) => applyOverride({ ...override, vramGB: Number(v) || undefined })}
              placeholder="e.g. 8"
              description="If you have a dedicated GPU. Browsers cannot read this."
            />
          </div>
          <a className="inline-flex items-center gap-1 text-[11.5px] mt-3 underline" style={{ color: 'var(--text-2)' }} href="https://www.canirun.ai" target="_blank" rel="noreferrer">
            Check your machine on canirun.ai <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      )}

      <div role="group" aria-label="Model category" className="flex flex-wrap gap-2 mb-2">
        {CATEGORIES.map((c) => (
          <Button key={c.id} size="sm" variant={category === c.id ? 'solid' : 'bordered'} color={category === c.id ? 'primary' : 'default'} onClick={() => setCategory(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>
      <p className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>{selected.blurb}</p>
      {selected.caution && (
        <div className="mb-3">
          <InlineAlert status="warning" title="Read before you download">{selected.caution}</InlineAlert>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[180px]">
          <Input label="Search this category" value={query} onChange={setQuery} placeholder="e.g. qwen 7b, llama, coder" onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(category, query) }} />
        </div>
        <Button size="sm" variant="bordered" color="default" isLoading={searching} onClick={() => void runSearch(category, query)}>
          <Search size={12} aria-hidden /> Search
        </Button>
      </div>

      <div role="group" aria-label="Quantisation" className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Quantisation:</span>
        {QUANTS.map((q) => (
          <Button key={q.id} size="sm" variant={quant === q.id ? 'solid' : 'bordered'} color={quant === q.id ? 'primary' : 'default'} onClick={() => setQuant(q.id)}>
            {q.label}
          </Button>
        ))}
        <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{QUANTS.find((q) => q.id === quant)?.hint}</span>
      </div>

      {pick && (
        <div className="rounded-[14px] p-3 mb-4 flex flex-wrap items-center gap-3" style={{ border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}>
          <Sparkles size={15} aria-hidden style={{ color: 'var(--primary)' }} />
          <div className="flex-1 min-w-[200px]">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Recommended for this machine</div>
            <div className="text-[13px] font-semibold break-all">{pick.repo}</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              About {estimateGB(pick.paramsB!, quant)} GB at {quant.replace('_', ' ')} · {FIT_LABEL[fitFor(estimateGB(pick.paramsB!, quant), budget)]}
            </div>
          </div>
          <Button size="sm" disabled={!!progress[pick.repo] || status !== 'up'} onClick={() => void download(pick.repo)}>
            <Download size={12} aria-hidden /> Download
          </Button>
        </div>
      )}

      {searchError && <div className="mb-3"><InlineAlert status="danger" title="Search failed">{searchError}</InlineAlert></div>}

      <div className="surface overflow-hidden" aria-live="polite">
        {results === null || searching ? (
          <div className="p-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>Searching Hugging Face…</div>
        ) : ranked.length === 0 ? (
          <div className="p-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>No GGUF models matched. Try another search.</div>
        ) : ranked.map((m) => {
          const name = ollamaNameFor(m.repo, quant)
          const isInstalled = installed.some((i) => i.name === name)
          const p = progress[m.repo]
          return (
            <div key={m.repo} className="px-3.5 py-2.5 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                  <a href={`https://huggingface.co/${m.repo}`} target="_blank" rel="noreferrer" className="font-medium break-all underline-offset-2 hover:underline">{m.repo}</a>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {m.author} · {compact(m.downloads)} downloads · {compact(m.likes)} likes{m.paramsB ? ` · ${m.paramsB}B parameters` : ''}
                  </div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: FIT_COLOR[m.fit], border: `1px solid ${FIT_COLOR[m.fit]}` }}>
                  {m.gb !== null ? `~${m.gb} GB · ` : ''}{FIT_LABEL[m.fit]}
                </span>
                {isInstalled ? (
                  <span className="text-[11.5px]" style={{ color: 'var(--success)' }}>Installed</span>
                ) : (
                  <Button size="sm" variant="bordered" color="default" disabled={!!p || status !== 'up'} isLoading={!!p} onClick={() => void download(m.repo)}>
                    <Download size={12} aria-hidden /> Download
                  </Button>
                )}
              </div>
              {p && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-border)' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct ?? undefined} aria-label={`Downloading ${m.repo}`}>
                    <div className="h-full transition-[width] duration-300" style={{ width: `${p.pct ?? 8}%`, background: 'var(--primary)' }} />
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{p.status}{p.pct !== null ? ` · ${p.pct}%` : ''}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h4 className="text-[13px] font-semibold mt-5 mb-2">Installed</h4>
      {installed.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
          {status === 'up' ? 'Nothing installed yet.' : 'Start Ollama to see your installed models.'}
        </p>
      ) : (
        <div className="surface overflow-hidden">
          {installed.map((m) => (
            <div key={m.name} className="flex items-center gap-2 px-3.5 py-2 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="flex-1 min-w-0 break-all font-medium">{m.name}</span>
              <span style={{ color: 'var(--text-3)' }}>{m.size ? bytes(m.size) : ''}</span>
              <Button size="sm" variant="ghost" color="danger" isLoading={removing === m.name} onClick={() => void remove(m.name)}>
                <Trash2 size={12} aria-hidden /> Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-3)' }}>
        <AlertTriangle size={11} aria-hidden className="mt-0.5 shrink-0" />
        Fit estimates are approximate. Real memory use depends on context length and what else is running.
      </p>
    </section>
  )
}
