/**
 * The machine, in the top bar.
 *
 * Three numbers, always the same three: how much memory this app is holding,
 * how much processor it is using, and what the GPU is doing — because "why is my
 * laptop hot" is answered by exactly those. Every value is measured (the server
 * samples its own process, and the GPU is asked directly), and the two cases
 * where a number does not exist are shown as what they are:
 *
 *   • the first CPU sample is a dash, since a percentage needs two readings;
 *   • a machine with no readable GPU says so, and the panel explains why.
 *
 * Hover opens the detail card; the traces are the last forty samples, so a spike
 * is still visible two seconds after it happened.
 */
import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Activity, Cpu, MemoryStick, Gauge, ShieldQuestion } from 'lucide-react'
import { useResources, type ResourceSample } from '@/hooks/useResources'

const fmtMB = (mb?: number) => {
  if (mb === undefined || mb === null) return '—'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

const fmtUptime = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

/** A trace with no axes: the shape is the information. */
function Trace({ values, max, tone }: { values: (number | null)[]; max: number; tone: string }) {
  const pts = useMemo(() => {
    const clean = values.map((v) => (v === null || Number.isNaN(v) ? 0 : v))
    const peak = Math.max(max, ...clean, 1)
    return clean
      .map((v, i) => `${(i / Math.max(1, clean.length - 1)) * 100},${28 - (v / peak) * 26}`)
      .join(' ')
  }, [values, max])
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-[54px] h-[16px]" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function ResourceMeter() {
  const { sample, history, error } = useResources(true)
  const [open, setOpen] = useState(false)

  const cpuSeries = useMemo(() => history.map((h) => h.cpuPct), [history])
  const ramSeries = useMemo(() => history.map((h) => h.rssMB), [history])
  const gpuSeries = useMemo(() => history.map((h) => (h.gpu.available ? h.gpu.utilPct ?? 0 : null)), [history])

  const cpu = sample?.cpuPct
  const cpuTone = cpu === null || cpu === undefined ? 'var(--text-3)' : cpu > 70 ? 'var(--danger)' : cpu > 35 ? 'var(--warning)' : 'var(--success)'
  const gpu = sample?.gpu

  return (
    <div className="relative hidden md:block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="flex items-center gap-2.5 px-2.5 py-1 rounded-full text-[11px] tabular-nums"
        style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
        aria-label="Live resource use"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5" title="Memory this app is holding">
          <MemoryStick size={11.5} strokeWidth={1.6} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: 'var(--text)' }}>{sample ? fmtMB(sample.rssMB) : '—'}</span>
        </span>
        <span className="w-px h-3" style={{ background: 'var(--surface-border)' }} />
        <span className="flex items-center gap-1.5" title="Processor use, as a share of one core">
          <Cpu size={11.5} strokeWidth={1.6} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: cpuTone }}>{cpu === null || cpu === undefined ? '—' : `${cpu.toFixed(0)}%`}</span>
        </span>
        <span className="w-px h-3" style={{ background: 'var(--surface-border)' }} />
        <span className="flex items-center gap-1.5" title={gpu?.available ? `GPU use (${gpu.source})` : gpu?.reason ?? 'GPU use'}>
          <Activity size={11.5} strokeWidth={1.6} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: gpu?.available ? 'var(--text)' : 'var(--text-3)' }}>
            {gpu?.available ? `${Math.round(gpu.utilPct ?? 0)}%` : '—'}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] w-[310px] p-3 rounded-[14px] z-40 text-[11.5px]"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.55)' }}
            data-ui="resource-meter"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={13} style={{ color: 'var(--primary)' }} />
              <span className="font-medium" style={{ color: 'var(--text)' }}>Research Engine right now</span>
            </div>

            {error && <p className="mb-2" style={{ color: 'var(--danger)' }}>{error}</p>}

            <Row label="Memory" value={sample ? fmtMB(sample.rssMB) : '—'} sub={sample ? `${sample.system.usedPct}% of the machine's ${fmtMB(sample.system.totalMB)} is in use` : ''}
              trace={<Trace values={ramSeries} max={Math.max(400, sample?.rssMB ?? 0)} tone="var(--primary)" />} />
            <Row label="Processor" value={cpu === null || cpu === undefined ? 'measuring…' : `${cpu.toFixed(1)}% of one core`}
              sub={sample
                ? (cpu === null || cpu === undefined
                  ? 'The first reading cannot be a percentage — it needs two samples.'
                  : `${sample.system.cores} cores · load ${sample.system.load1 ?? '—'}`)
                : ''}
              trace={<Trace values={cpuSeries} max={100} tone={cpuTone} />} />

            <div className="flex items-start gap-2 mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <Activity size={12} className="mt-[1px]" style={{ color: 'var(--text-3)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--text)' }}>GPU</span>
                  <span style={{ color: 'var(--text-3)' }}>
                    {gpu?.available ? `${Math.round(gpu.utilPct ?? 0)}%${gpu.memUsedMB !== undefined ? ` · ${fmtMB(gpu.memUsedMB)}${gpu.memTotalMB ? ` / ${fmtMB(gpu.memTotalMB)}` : ''}` : ''}` : 'not readable here'}
                  </span>
                </div>
                <p className="mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {gpu?.available
                    ? `${gpu.name ?? 'GPU'} · read from ${gpu.source === 'nvidia-smi' ? 'nvidia-smi' : 'the Linux DRM counters'}`
                    : gpu?.reason ?? 'No GPU reading yet.'}
                </p>
                {gpu?.available && <div className="mt-1"><Trace values={gpuSeries} max={100} tone="var(--success)" /></div>}
              </div>
              {!gpu?.available && <ShieldQuestion size={12} className="mt-[1px]" style={{ color: 'var(--warning)' }} />}
            </div>

            <div className="flex items-center justify-between mt-2 pt-1.5 text-[10.5px]" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
              <span>up {sample ? fmtUptime(sample.uptimeSec) : '—'}</span>
              <span>heap {sample ? fmtMB(sample.heapMB) : '—'}</span>
              <span>sampled every 2s while this window is visible</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value, sub, trace }: { label: string; value: string; sub?: string; trace?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-3)' }}>{label}</span>
          <span className="tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
        </div>
        {sub && <p className="mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      {trace}
    </div>
  )
}
