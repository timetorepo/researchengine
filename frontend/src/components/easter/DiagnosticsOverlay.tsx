import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Activity, Wifi, Database, Cpu } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { fmt } from '@/lib/utils'

export function DiagnosticsOverlay() {
  const open = useUI((s) => s.diagnostics)
  const totalRequests = useStore((s) => s.totalRequests)
  const log = useStore((s) => s.connectionLog)
  const saved = useStore((s) => s.tokensSavedLifetime)
  const chats = useStore((s) => s.chats)

  const bytes = log.reduce((a, e) => a + e.bytes, 0)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--bg) 80%, transparent)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="surface-elevated p-6 w-[420px] max-w-[calc(100vw-2rem)] font-mono text-[12px]"
            style={{ borderRadius: 'var(--radius-modal)', boxShadow: '0 32px 80px -24px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--success)' }}>
              <Activity size={15} className="animate-pulse" /> NETWORK DIAGNOSTICS — LIVE
            </div>
            <div className="space-y-2.5">
              <Row icon={Wifi} label="outbound requests (lifetime)" value={String(totalRequests)} />
              <Row icon={Activity} label="bytes transferred" value={fmt(bytes)} />
              <Row icon={Database} label="local chats" value={String(chats.length)} />
              <Row icon={Cpu} label="tokens saved by Flow" value={fmt(saved)} />
            </div>
            <div className="mt-4 pt-3 space-y-1 max-h-40 overflow-y-auto" style={{ borderTop: '1px solid var(--surface-border)' }}>
              {log.slice(0, 8).map((e) => (
                <div key={e.id} className="flex gap-2 truncate" style={{ color: 'var(--text-3)' }}>
                  <span>{new Date(e.t).toLocaleTimeString()}</span>
                  <span style={{ color: e.status === 'local' ? 'var(--success)' : 'var(--primary)' }}>{e.endpoint}</span>
                  <span className="ml-auto">{fmt(e.bytes)}B</span>
                </div>
              ))}
              {log.length === 0 && <div style={{ color: 'var(--text-3)' }}>no outbound activity yet — all quiet</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={13} style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span className="ml-auto" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
