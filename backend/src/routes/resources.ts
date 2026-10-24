// Live resource + runtime-config endpoints for the Settings → Performance panel.
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { dbStats } from '../db'
import {
  PROFILES, type ProfileId, type Runtime, dirSize, loadConfig, saveConfig,
} from '../runtime'
import { gpuReading, sampleProcessCpu, systemMemory } from '../services/system-metrics'

export function resourceRoutes(rt: Runtime) {
  const r = new Hono()

  r.get('/resources', async (c) => {
    const mem = process.memoryUsage()
    const dbFile = rt.dbPath
    // The live half: what the app costs right now, next to what the machine has.
    // `cpu.pct` is null on the very first call — a percentage needs two samples,
    // so the honest first answer is a dash, not a zero.
    const cpu = sampleProcessCpu()
    const gpu = await gpuReading()
    return c.json({
      ok: true,
      at: Date.now(),
      process: {
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        cpuPct: cpu.pct,
        cpuSec: cpu.usedSec,
      },
      system: { ...systemMemory(), load1: cpu.load1, cores: cpu.cores },
      gpu,
      dataDir: {
        path: rt.dataDir,
        totalMB: +(dirSize(rt.dataDir) / 1048576).toFixed(1),
      },
      db: {
        ...dbStats(),
        sizeMB: existsSync(dbFile) ? +(statSync(dbFile).size / 1048576).toFixed(2) : 0,
      },
      cacheMB: +(dirSize(join(rt.dataDir, 'cache')) / 1048576).toFixed(1),
      profile: rt.profile,
      caps: rt.caps,
      profiles: Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, { description: v.description }])),
    })
  })

  r.get('/config', (c) => c.json({
    ok: true,
    port: rt.port,
    dataDir: rt.dataDir,
    profile: rt.profile,
    caps: rt.caps,
    frontendServed: !!rt.frontendDist,
  }))

  r.post('/config', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    if (body.profile && body.profile in PROFILES) {
      const profile = body.profile as ProfileId
      rt.profile = profile
      rt.caps = PROFILES[profile]
      saveConfig(rt.dataDir, { profile })
      return c.json({ ok: true, profile, caps: rt.caps })
    }
    return c.json({ ok: false, error: 'Unknown profile' }, 400)
  })

  return r
}
