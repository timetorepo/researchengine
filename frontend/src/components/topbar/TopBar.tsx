import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Menu, Wind, Settings2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { PROVIDERS } from '@/lib/providers/registry'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
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
  const providerMeta = PROVIDERS.find((p) => p.id === curProvider)

  // models grouped by provider: registry defaults + any user-added baseUrl providers
  const groups = PROVIDERS.filter((p) => p.defaultModels.length > 0 || settings.providers[p.id]?.enabled || p.needsKey === false)

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
          <ProviderLogo id={curProvider} size={14} />
          <span className="max-w-[180px] truncate">{curModel || 'Choose model'}</span>
          <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />
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
              {groups.map((g) => (
                <div key={g.id} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                    <ProviderLogo id={g.id} size={12} /> {g.name}
                    {g.needsKey && !settings.providers[g.id]?.apiKey && <span className="ml-auto font-normal normal-case">no key</span>}
                  </div>
                  {(g.defaultModels.length ? g.defaultModels : ['local']).map((m) => {
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
              ))}
              <button
                onClick={() => { setPickerOpen(false); ui.set({ settingsOpen: true, settingsTab: 'providers' }); navigate('/settings') }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)]"
                style={{ color: 'var(--primary)' }}
              >
                <Settings2 size={14} /> Manage providers…
              </button>
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
        Saved <b style={{ color: 'var(--text)' }}>{fmt(saved)}</b> tokens this session
      </div>
    </header>
  )
}
