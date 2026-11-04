/**
 * What the app costs the machine, sampled on a timer.
 *
 * The numbers come from the local server's own process — it *is* the app's
 * engine — plus the machine it runs on. Two habits keep the meter honest:
 *
 *   • the first CPU reading is null (a percentage needs two samples), and the
 *     meter shows a dash rather than a zero that looks like an idle app;
 *   • a GPU that cannot be read says so, with the reason, instead of showing 0%.
 *
 * Polling stops when the window is hidden: a meter nobody is looking at should
 * not be the reason a laptop fan turns on.
 */
import { useEffect, useRef, useState } from 'react'
import { readJsonResponse } from '@/lib/net/json'

export interface ResourceSample {
  at: number
  rssMB: number
  heapMB: number
  uptimeSec: number
  /** Percent of one core, or null until a second sample exists. */
  cpuPct: number | null
  cpuSec: number
  system: { totalMB: number; freeMB: number; usedMB: number; usedPct: number; load1: number | null; cores: number }
  gpu: { available: boolean; name?: string; source?: string; utilPct?: number; memUsedMB?: number; memTotalMB?: number; reason?: string }
}

const POLL_MS = 2000
const HISTORY = 40

/**
 * The server answers with the three groups it measures; the meter wants one
 * record. Reading them apart is also what keeps an older server from breaking
 * the meter: a response without `gpu` becomes "not readable here" rather than
 * an exception, and a missing CPU reading stays null instead of becoming zero.
 */
function toSample(json: any): ResourceSample {
  const system = json?.system ?? {}
  const total = Number(system.totalMB) || 0
  const used = Number(system.usedMB) || 0
  return {
    at: Number(json?.at) || Date.now(),
    rssMB: Number(json?.process?.rssMB) || 0,
    heapMB: Number(json?.process?.heapMB) || 0,
    uptimeSec: Number(json?.process?.uptimeSec) || 0,
    cpuPct: typeof json?.process?.cpuPct === 'number' ? json.process.cpuPct : null,
    cpuSec: Number(json?.process?.cpuSec) || 0,
    system: {
      totalMB: total,
      freeMB: Number(system.freeMB) || 0,
      usedMB: used,
      usedPct: Number(system.usedPct) || (total ? +((used / total) * 100).toFixed(1) : 0),
      load1: typeof system.load1 === 'number' ? system.load1 : null,
      cores: Number(system.cores) || 1,
    },
    gpu: json?.gpu?.available
      ? {
        available: true,
        name: json.gpu.name,
        source: json.gpu.source,
        utilPct: Number(json.gpu.utilPct) || 0,
        memUsedMB: json.gpu.memUsedMB,
        memTotalMB: json.gpu.memTotalMB,
      }
      : { available: false, reason: json?.gpu?.reason ?? 'This server does not report GPU use.' },
  }
}

export function useResources(enabled = true) {
  const [sample, setSample] = useState<ResourceSample | null>(null)
  const [history, setHistory] = useState<ResourceSample[]>([])
  const [error, setError] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let inFlight = false

    const tick = async () => {
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        const res = await fetch('/api/resources')
        const json: any = await readJsonResponse<any>(res, '/api/resources')
        if (!alive) return
        const next = toSample(json)
        setSample(next)
        setHistory((h) => [...h, next].slice(-HISTORY))
        setError('')
      } catch (e: any) {
        if (alive) setError(String(e?.message ?? e))
      } finally {
        inFlight = false
      }
    }

    void tick()
    timer.current = window.setInterval(() => void tick(), POLL_MS)
    const onVisible = () => { if (!document.hidden) void tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [enabled])

  return { sample, history, error }
}
