/**
 * What this machine can give a local model. A browser cannot read GPU memory, so
 * the detected numbers are a floor, and the person can enter their own RAM and
 * VRAM in the panel. Those entries are kept on this device only.
 */

export interface DeviceProfile {
  /** System RAM in GB, or null if the browser does not say. Chromium caps this at 8. */
  ramGB: number | null
  cores: number
  /** WebGPU is present; that alone does not tell us how much video memory there is. */
  webgpu: boolean
  /** The budget for one model, in GB. */
  budgetGB: number
  /** How the budget was reached, for display. */
  basis: string
}

export interface DeviceOverride { ramGB?: number; vramGB?: number }

const KEY = 'researchengine:device-override'

export function loadDeviceOverride(): DeviceOverride {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const v = JSON.parse(raw)
    return { ramGB: positive(v?.ramGB), vramGB: positive(v?.vramGB) }
  } catch {
    return {}
  }
}

export function saveDeviceOverride(o: DeviceOverride): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)) } catch { /* private mode: keep it for this session only */ }
}

function positive(n: unknown): number | undefined {
  const x = Number(n)
  return Number.isFinite(x) && x > 0 && x < 4096 ? Math.round(x * 10) / 10 : undefined
}

/**
 * Budget rule. With a dedicated GPU the model should live in video memory, so the
 * budget is most of the VRAM. Without one it runs on system RAM, and the machine
 * still has to run its own apps, so half the RAM is the budget.
 */
export function budgetFor(ramGB: number | null, vramGB: number | undefined): { budgetGB: number; basis: string } {
  if (vramGB) return { budgetGB: Math.round(vramGB * 0.85 * 10) / 10, basis: `${vramGB} GB video memory (entered)` }
  const ram = ramGB ?? 8
  return {
    budgetGB: Math.round(ram * 0.5 * 10) / 10,
    basis: ramGB ? `half of ${ramGB} GB system memory` : 'half of 8 GB (the browser did not report memory)',
  }
}

export function detectDevice(override: DeviceOverride = loadDeviceOverride()): DeviceProfile {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const reported = typeof (nav as any)?.deviceMemory === 'number' ? ((nav as any).deviceMemory as number) : null
  const ramGB = override.ramGB ?? reported
  const { budgetGB, basis } = budgetFor(ramGB, override.vramGB)
  return { ramGB, cores: nav?.hardwareConcurrency ?? 4, webgpu: !!(nav as any)?.gpu, budgetGB, basis }
}
