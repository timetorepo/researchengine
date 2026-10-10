import React, { useEffect, useState } from 'react'
import { Gauge, Leaf, Rocket, Activity, HardDrive, Database, Cpu, Check, MonitorPlay, RefreshCw } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import {
  PROFILE_CAPS, type PerfProfileId, fetchResources, type ResourceSnapshot,
} from '@/lib/system/performance'
import { useFrameHealth, remeasure } from '@/lib/system/frame-budget'
import { Button } from '@/components/ui/heroui/Button'

const ORDER: PerfProfileId[] = ['eco', 'balanced', 'performance']
const ICONS: Record<PerfProfileId, any> = { eco: Leaf, balanced: Gauge, performance: Rocket }

export function PerformanceTab() {
  const settings = useStore((s) => s.settings)
  const profile = settings.performanceProfile ?? 'balanced'
  const high = settings.highMemoryMode ?? false
  const [snap, setSnap] = useState<ResourceSnapshot | null>(null)
  const [checked, setChecked] = useState(false)
  const health = useFrameHealth()
  const adaptive = settings.adaptiveQuality !== false

  useEffect(() => {
    const ctrl = new AbortController()
    const poll = async () => {
      const s = await fetchResources(ctrl.signal)
      setSnap(s)
      setChecked(true)
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => { ctrl.abort(); clearInterval(iv) }
  }, [])

  const set = (patch: Partial<typeof settings>) =>
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <Activity size={20} style={{ color: 'var(--primary)' }} /> Performance
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Startup profiles keep Research Engine light on purpose. Pick what fits this machine.
      </p>

      {/* Profile picker */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
        {ORDER.map((p) => {
          const Icon = ICONS[p]
          const caps = PROFILE_CAPS[p]
          const active = profile === p
          return (
            <button key={p} onClick={() => set({ performanceProfile: p })}
              className="text-left p-4 rounded-[16px] transition-all hover:scale-[1.015]"
              style={{
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
                background: active ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)',
              }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: active ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)', color: active ? 'var(--primary)' : 'var(--text-2)' }}>
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span className="text-[13.5px] font-semibold capitalize flex-1">{p}</span>
                {active && <Check size={14} style={{ color: 'var(--primary)' }} />}
              </div>
              <p className="text-[11.5px] leading-relaxed mb-2" style={{ color: 'var(--text-3)' }}>{caps.description}</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{caps.floodWorkers} flood worker{caps.floodWorkers > 1 ? 's' : ''}</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{caps.concurrentStreams} stream{caps.concurrentStreams > 1 ? 's' : ''}</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>top-{caps.searchResults} search</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* High memory mode */}
      <button onClick={() => set({ highMemoryMode: !high })}
        className="w-full surface p-4 mb-6 flex items-center gap-3 text-left">
        <div className="flex-1">
          <div className="text-[13px] font-medium">High memory mode</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            Off by default. Turn on if this machine has RAM to spare — adds one flood worker and one concurrent stream; leave off on 8 GB laptops.
          </div>
        </div>
        <span className="relative w-10 h-[22px] rounded-full transition-colors shrink-0"
          style={{ background: high ? 'var(--primary)' : 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
          <span className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all"
            style={{ left: high ? 20 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
        </span>
      </button>

      {/* Adaptive quality — the measured frame rate, not a guess */}
      <div className="surface p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MonitorPlay size={15} strokeWidth={1.6} style={{ color: 'var(--primary)' }} />
          <div className="text-[13px] font-medium flex-1">Adaptive quality</div>
          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
            {health.samples ? `${health.fps} fps · ${health.frameMs} ms` : 'measuring…'}
          </span>
        </div>
        <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: 'var(--text-3)' }}>
          The real frame rate, sampled for about two seconds shortly after startup and again when the window
          comes back. On a machine that cannot hold frames the animated layers give way — the glow is thinned
          first, then the canvas effects settle to a still frame. Nothing is switched off silently: this is
          what was measured. Currently: <b style={{ color: 'var(--text-2)' }}>{health.reason}</b>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="flat" size="sm" onClick={() => remeasure()} startContent={<RefreshCw size={13} />}>
            Re-measure now
          </Button>
          <Button variant={adaptive ? 'flat' : 'solid'} size="sm" onClick={() => set({ adaptiveQuality: !adaptive })}>
            {adaptive ? 'Turn adaptive quality off' : 'Turn adaptive quality on'}
          </Button>
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {adaptive ? 'On by default.' : 'Off: every layer always draws fully.'}
          </span>
        </div>
      </div>

      {/* Live resource panel */}
      <h3 className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
        <Cpu size={13} style={{ color: 'var(--primary)' }} /> Live resources
      </h3>
      {checked && !snap ? (
        <div className="surface p-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          The single-process server is not reachable — you are running in browser-only mode.
          Start it with <code className="px-1.5 py-0.5 rounded font-mono text-[11px]" style={{ background: 'var(--elevated)' }}>npm start</code> from
          the repo root to see live memory, database and cache stats here.
        </div>
      ) : snap ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Metric icon={Activity} label="Process RAM" value={`${snap.process.rssMB} MB`} sub={`heap ${snap.process.heapMB} MB`} />
          <Metric icon={Database} label="SQLite" value={`${snap.db.sizeMB} MB`} sub={snap.db.engine} />
          <Metric icon={HardDrive} label="Data dir" value={`${snap.dataDir.totalMB} MB`} sub={`cache ${snap.cacheMB} MB`} />
          <Metric icon={Gauge} label="Uptime" value={fmtUptime(snap.process.uptimeSec)} sub={`profile ${snap.profile}`} />
        </div>
      ) : (
        <div className="surface p-4 text-[12.5px]" style={{ color: 'var(--text-3)' }}>Sampling…</div>
      )}
      {snap && (
        <p className="text-[10.5px] mt-3" style={{ color: 'var(--text-3)' }}>
          Data lives at <span className="font-mono">{snap.dataDir.path}</span> · Node {snap.process.node} · refreshes every 5s
        </p>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>
        <Icon size={11} /> {label}
      </div>
      <div className="text-[18px] font-semibold tabular-nums" style={{ letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

function fmtUptime(sec: number) {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}
