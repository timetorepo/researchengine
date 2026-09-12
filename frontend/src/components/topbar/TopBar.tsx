import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Menu, Wind, Settings2, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { PROVIDERS } from '@/lib/providers/registry'
import { refreshAllModels, refreshProviderModels } from '@/lib/providers/refresh'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { AnimatedCounter } from '@/components/ui/reactbits/AnimatedCounter'
import { fmt } from '@/lib/utils'

export function TopBar() {
  const navigate = useNavigate()
  const ui = useUI()
  const settings = useStore((s) => s.settings)
  const saved = useStore((s) => s.tokensSavedSession)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const [curProvider, curModel] = settings.defaultModel.split(':')
  const providerModels = settings.providerModels ?? {}
  const [refreshing, setRefreshing] = useState(false)

  // Model lists come ONLY from live provider fetches (settings.providerModels).
  const hasAnyModels = PROVIDERS.some((p) => (providerModels[p.id]?.length ?? 0) > 0)
  const groups = PROVIDERS.filter((p) =>
    (providerModels[p.id]?.length ?? 0) > 0 || settings.providers[p.id]?.enabled || p.needsKey === false)

  const openProviders = () => {
    setPickerOpen(false)
    ui.set({ settingsOpen: true, settingsTab: 'providers' })
    navigate('/settings')
  }

  const refresh = async () => {
    setRefreshing(true)
    try { await refreshAllModels() } finally { setRefreshing(false) }
  }

  return (
    <header
      className="flex items-center gap-2 px-3 h-12 shrink-0 relative z-30"
      style={{ borderBottom: '1px solid var(--surface-border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(12px)' }}
    >
      <button className="md:hidden p-2 rounded-lg hover:bg-[var(--elevated)]" aria-label="Open menu" onClick={() => ui.set({ sidebarOpenMobile: true })}>
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {/* Model selector */}
      <div className="relative" ref={pickRef}>
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors hover:bg-[var(--elevated)]"
          style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}
          aria-haspopup="listbox" aria-expanded={pickerOpen}
        >
          {curProvider ? <ProviderLogo id={curProvider} size={14} /> : <Plus size={14} style={{ color: 'var(--text-3)' }} />}
          <span className="max-w-[180px] truncate">{curModel || 'Add models'}</span>
          <motion.span animate={{ rotate: pickerOpen ? 180 : 0 }} transition={{ duration: 0.18 }} className="inline-flex">
            <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />
          </motion.span>
        </button>

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute left-0 top-full mt-2 w-72 max-h-[60vh] overflow-y-auto surface-elevated p-1.5 z-50"
              style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
              role="listbox"
            >
              {!hasAnyModels ? (
                /* Empty state — nothing fetched yet */
                <div className="flex flex-col items-center text-center px-4 py-6">
                  <button
                    onClick={openProviders}
                    aria-label="Add models"
                    className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform hover:scale-105"
                    style={{ background: 'var(--primary)', color: '#fff' }}
                  >
                    <Plus size={18} />
                  </button>
                  <div className="text-[13px] font-medium mb-0.5">Add models</div>
                  <div className="text-[11.5px] leading-snug mb-3" style={{ color: 'var(--text-3)' }}>
                    Connect a provider — model names are fetched live, never hardcoded.
                  </div>
                  <button onClick={openProviders}
                    className="px-3.5 py-1.5 rounded-full text-[12px] font-medium"
                    style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                    Add API keys
                  </button>
                </div>
              ) : (
                groups.map((g) => {
                  const models = providerModels[g.id] ?? []
                  return (
                    <div key={g.id} className="mb-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                        <ProviderLogo id={g.id} size={12} /> {g.name}
                        {models.length === 0 && (
                          <button
                            onClick={async (e) => { e.stopPropagation(); try { await refreshProviderModels(g.id) } catch { /* surfaced via toast elsewhere */ } }}
                            className="ml-auto flex items-center gap-1 font-normal normal-case hover:underline" style={{ color: 'var(--primary)' }}>
                            <Plus size={11} /> Add models
                          </button>
                        )}
                      </div>
                      {models.map((m) => {
                        const ref = `${g.id}:${m}`
                        const active = settings.defaultModel === ref
                        return (
                          <button
                            key={ref}
                            role="option" aria-selected={active}
                            onClick={() => { useStore.setState((s) => ({ settings: { ...s.settings, defaultModel: ref } })); setPickerOpen(false) }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] text-[13px] text-left hover:bg-[var(--surface)]"
                            style={{ color: active ? 'var(--primary)' : 'var(--text-2)' }}
                          >
                            <span className="flex-1 truncate font-mono text-[12px]">{m}</span>
                            {active && <Check size={13} />}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
              <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <button
                  onClick={refresh} disabled={refreshing}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)] disabled:opacity-60"
                  style={{ color: 'var(--text-2)' }}
                >
                  {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {refreshing ? 'Fetching models…' : 'Refresh models'}
                </button>
                <button
                  onClick={openProviders}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)]"
                  style={{ color: 'var(--primary)' }}
                >
                  <Settings2 size={14} /> Manage providers…
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Local badge */}
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' }}>
        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--success)' }} /> Local
      </span>

      <div className="flex-1" />

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
