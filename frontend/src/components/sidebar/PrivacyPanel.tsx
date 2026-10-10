import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ShieldCheck, ShieldOff, ShieldAlert, X, ArrowUpRight, Download, ScanSearch } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { timeAgo } from '@/lib/utils'
import { download } from '@/lib/utils'
import { PRIVACY_MODES, getScanLog, clearScanLog, type PrivacyMode } from '@/lib/privacy/shield'

export function PrivacyPanel() {
  const [open, setOpen] = useState(false)
  const log = useStore((s) => s.connectionLog)
  const integrations = useStore((s) => s.integrations)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const h = () => setOpen((o) => !o)
    window.addEventListener('re:open-privacy', h)
    return () => window.removeEventListener('re:open-privacy', h)
  }, [])

  const anyIntegration = Object.values(integrations).some((i) => i.connected)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            className="fixed right-4 bottom-4 top-16 z-[61] w-[400px] max-w-[calc(100vw-2rem)] surface-elevated flex flex-col overflow-hidden"
            style={{ borderRadius: 'var(--radius-modal)', boxShadow: '0 24px 80px -24px rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog" aria-label="Privacy shield"
          >
            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <ShieldCheck size={20} strokeWidth={1.5} style={{ color: anyIntegration ? 'var(--warning)' : 'var(--success)' }} />
              <div className="flex-1">
                <div className="font-semibold text-[15px] tracking-tight">Privacy Shield</div>
                <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>Exactly what goes where</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--surface)]"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Shield mode</h4>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {PRIVACY_MODES.map((m) => {
                    const active = settings.privacyMode === m.id
                    const Icon = m.id === 'none' ? ShieldOff : m.id === 'private' ? ShieldCheck : ShieldAlert
                    return (
                      <button key={m.id}
                        onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, privacyMode: m.id as PrivacyMode } }))}
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-[12px] text-[11px] font-medium transition-colors"
                        style={{
                          background: active ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--surface)',
                          border: `1px solid ${active ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                          color: active ? 'var(--primary)' : 'var(--text-2)',
                        }}>
                        <Icon size={15} strokeWidth={1.6} />
                        {m.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {PRIVACY_MODES.find((m) => m.id === settings.privacyMode)?.desc}
                </p>
                <ScanLogView />
              </section>

              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Stays on this device</h4>
                <ul className="space-y-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  {['All chats, articles, quizzes and notes (local database)', 'Your API keys (AES-GCM encrypted vault)', 'AIFlowEngine cache and token accounting', 'Skills, spaces and knowledge cards'].map((t) => (
                    <li key={t} className="flex gap-2 items-start"><span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--success)' }} />{t}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Leaves the device — only when you ask</h4>
                <ul className="space-y-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2 items-start"><span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
                    Chat requests go <b>directly</b> to the provider you configured ({settings.defaultModel.split(':')[0]}). Nothing is proxied through Research Engine servers — there are none.</li>
                  <li className="flex gap-2 items-start"><span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
                    Web search queries go to your configured search backend.</li>
                  {anyIntegration && (
                    <li className="flex gap-2 items-start"><span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
                      {Object.values(integrations).filter((i) => i.connected).length} integration(s) connected — OAuth tokens encrypted locally.</li>
                  )}
                </ul>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Live outbound connections</h4>
                  <button
                    onClick={() => download('connection-log.csv', 'time,endpoint,purpose,bytes,status\n' + log.map((e) => `${new Date(e.t).toISOString()},${e.endpoint},"${e.purpose}",${e.bytes},${e.status}`).join('\n'), 'text/csv')}
                    className="flex items-center gap-1 text-[11px] hover:underline" style={{ color: 'var(--primary)' }}
                  ><Download size={12} /> Export</button>
                </div>
                {log.length === 0 ? (
                  <p className="text-[12.5px] py-3" style={{ color: 'var(--text-3)' }}>No outbound requests yet. The moment one happens, it appears here.</p>
                ) : (
                  <div className="space-y-1">
                    {log.slice(0, 30).map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-[10px]" style={{ background: 'var(--surface)' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.status === 'local' ? 'var(--success)' : e.status === 'error' ? 'var(--danger)' : 'var(--primary)' }} />
                        <span className="flex-1 truncate font-mono text-[11px]" title={e.endpoint}>{e.endpoint}</span>
                        <span style={{ color: 'var(--text-3)' }}>{timeAgo(e.t)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <p className="text-[11px] leading-relaxed pb-2" style={{ color: 'var(--text-3)' }}>
                No telemetry. No analytics. No update pings. Every network request on this screen is the complete list.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ScanLogView() {
  const [, force] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => force((n) => n + 1), 1500)
    return () => clearInterval(iv)
  }, [])
  const log = getScanLog()
  if (!log.length) return null
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-3)' }}>
          <ScanSearch size={11} /> Shield scans
        </span>
        <button onClick={() => { clearScanLog(); force((n) => n + 1) }} className="text-[10.5px] hover:underline" style={{ color: 'var(--text-3)' }}>clear</button>
      </div>
      <div className="space-y-1">
        {log.slice(0, 5).map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded-[8px]" style={{ background: 'var(--surface)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.blocked ? 'var(--danger)' : 'var(--warning)' }} />
            <span className="flex-1 truncate" style={{ color: 'var(--text-2)' }}>
              {e.where}: {e.findings.map((f) => `${f.label}×${f.count}`).join(', ')}{e.blocked ? ' — blocked' : ' — redacted'}
            </span>
            <span style={{ color: 'var(--text-3)' }}>{timeAgo(e.t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
