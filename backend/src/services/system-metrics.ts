/**
 * What this app costs the machine it is running on.
 *
 * The Performance panel always knew the process's memory; it could not say what
 * that memory was competing with, or how much processor the app was using right
 * now, or whether a GPU was involved at all. Those are the three numbers a
 * person watches when an app "feels heavy", so they are sampled here.
 *
 * Two rules shaped this file:
 *
 *   • A percentage needs two samples. `process.cpuUsage()` is a total, so the
 *     first call cannot answer "how busy is it" — the reading is a delta against
 *     the previous one, and a request that arrives without a previous sample
 *     says so rather than inventing a number.
 *   • A GPU either reports itself or it does not. There is no portable way to
 *     ask across Linux, macOS and Windows, so the probe looks for the tools that
 *     exist (NVIDIA's `nvidia-smi`, and the Linux `gpu_busy_percent` that AMD and
 *     Intel expose through DRM) and otherwise returns a reason. "No telemetry on
 *     this machine" is a truthful answer; a made-up zero is not.
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { cpus, freemem, loadavg, totalmem } from 'node:os'

export interface CpuReading {
  /** CPU used by this server process, as a percentage of one core. */
  pct: number | null
  /** CPU this process has consumed since it started, in seconds. */
  usedSec: number
  /** System load average over one minute, when the platform has it. */
  load1: number | null
  cores: number
}

export interface GpuReading {
  available: boolean
  /** Where the number came from, so the UI can name it. */
  source?: 'nvidia-smi' | 'drm'
  name?: string
  utilPct?: number
  memUsedMB?: number
  memTotalMB?: number
  reason?: string
}

const mb = (bytes: number) => Math.round(bytes / 1048576)

let lastCpu: { at: number; usage: NodeJS.CpuUsage } | null = null

/**
 * The process's CPU use as a percentage of one core, from the gap since the
 * previous call. Null on the first call: there is nothing to compare against
 * yet, and a number pulled out of the air would be worse than a dash.
 */
export function sampleProcessCpu(): CpuReading {
  const now = Date.now()
  const usage = process.cpuUsage()
  const usedSec = (usage.user + usage.system) / 1e6
  let pct: number | null = null
  if (lastCpu) {
    const elapsedMs = now - lastCpu.at
    const deltaUs = (usage.user - lastCpu.usage.user) + (usage.system - lastCpu.usage.system)
    if (elapsedMs > 0) pct = +((deltaUs / 1000 / elapsedMs) * 100).toFixed(1)
  }
  lastCpu = { at: now, usage }
  const loads = loadavg()
  return { pct, usedSec: +usedSec.toFixed(1), load1: loads[0] ? +loads[0].toFixed(2) : null, cores: cpus().length }
}

export function systemMemory() {
  const total = totalmem()
  const free = freemem()
  return { totalMB: mb(total), freeMB: mb(free), usedMB: mb(total - free), usedPct: +(((total - free) / total) * 100).toFixed(1) }
}

/* ------------------------------------------------------------------ GPU --- */

let gpuCache: { at: number; value: GpuReading } | null = null
const GPU_TTL_MS = 3000

/** NVIDIA's own tool, if the machine has it. */
function probeNvidia(): Promise<GpuReading | null> {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 900, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null)
        const first = String(stdout).trim().split('\n')[0]
        const [name, util, used, total] = first.split(',').map((p) => p.trim())
        const utilPct = Number(util)
        if (!Number.isFinite(utilPct)) return resolve(null)
        resolve({
          available: true, source: 'nvidia-smi', name: name || 'NVIDIA GPU',
          utilPct,
          memUsedMB: Number.isFinite(Number(used)) ? Number(used) : undefined,
          memTotalMB: Number.isFinite(Number(total)) ? Number(total) : undefined,
        })
      },
    )
  })
}

/** AMD and Intel expose utilisation through DRM on Linux. */
function probeDrm(): GpuReading | null {
  if (process.platform !== 'linux') return null
  try {
    const base = '/sys/class/drm'
    if (!existsSync(base)) return null
    for (const entry of readdirSync(base)) {
      const file = `${base}/${entry}/device/gpu_busy_percent`
      if (!existsSync(file)) continue
      const utilPct = Number(readFileSync(file, 'utf8').trim())
      if (!Number.isFinite(utilPct)) continue
      return { available: true, source: 'drm', name: entry.replace(/^card\d+-?/, '') || entry, utilPct }
    }
  } catch { /* not readable — treated the same as absent */ }
  return null
}

/**
 * GPU utilisation, cached briefly: the nvidia-smi call is a process spawn and a
 * two-second poll must not become a fork bomb.
 */
export async function gpuReading(): Promise<GpuReading> {
  if (gpuCache && Date.now() - gpuCache.at < GPU_TTL_MS) return gpuCache.value
  const value =
    (await probeNvidia()) ??
    probeDrm() ?? {
      available: false,
      reason:
        process.platform === 'darwin'
          ? 'macOS reports GPU use to its own Activity Monitor and to nothing else — the app cannot read it.'
          : 'No GPU telemetry on this machine: neither nvidia-smi nor a Linux DRM counter answered.',
    }
  gpuCache = { at: Date.now(), value }
  return value
}

export function resetMetricsCache() {
  lastCpu = null
  gpuCache = null
}
