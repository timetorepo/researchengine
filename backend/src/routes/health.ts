import { Hono } from 'hono'
import { dbStats } from '../db'
import { installMode, sourceVersion, webBuild } from '../build-info'

// Re-exported so the server entry and the CLI read the fingerprint from one place.
export { installMode, sourceVersion, webBuild } from '../build-info'
export type { WebBuild } from '../build-info'

export function healthRoutes(frontendDist?: string | null) {
  const app = new Hono()
  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'research-engine-backend',
      time: new Date().toISOString(),
      db: dbStats(),
      // Frontend fingerprint, so the UI can warn about a stale self-hosted copy.
      web: { served: webBuild(frontendDist), source: sourceVersion(), mode: installMode() },
      // Which OS and Node this server actually runs on. Platform-specific bugs
      // (a Windows path separator, a missing POSIX binary) are invisible until
      // someone names the platform, so the diagnostics report carries it.
      runtime: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        pathSep: process.platform === 'win32' ? '\\' : '/',
      },
    }),
  )
  return app
}
