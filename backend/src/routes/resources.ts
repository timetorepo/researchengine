// Live resource + runtime-config endpoints for the Settings → Performance panel.
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { dbStats } from '../db'
import {
  PROFILES, type ProfileId, type Runtime, dirSize, loadConfig, saveConfig,
} from '../runtime'

export function resourceRoutes(rt: Runtime) {
  const r = new Hono()

  r.get('/resources', (c) => {
    const mem = process.memoryUsage()
    const dbFile = rt.dbPath
    return c.json({
      ok: true,
      process: {
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
      },
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
