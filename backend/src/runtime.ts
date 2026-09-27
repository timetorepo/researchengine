// Runtime resolution for the single-process Research Engine server.
// Precedence everywhere: CLI flag > env var > config.json > default.
//
//   research-engine serve --port 3847 --profile eco --data-dir ~/.research-engine
//
// Data layout (same on every platform):
//   <data-dir>/
//     db.sqlite      SQLite database (or in-memory fallback)
//     media/         uploaded images and exports
//     notebooks/     document pipeline working files
//     cache/         search + generation cache
//     config.json    remembered port / profile / flags
//     keys.enc       encrypted key material (browser vault is primary; reserved)
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createServer } from 'node:net'

export interface ProfileCaps {
  floodWorkers: number
  searchResults: number
  concurrentStreams: number
  backgroundIndexing: boolean
  description: string
}

export const PROFILES: Record<'eco' | 'balanced' | 'performance', ProfileCaps> = {
  eco: {
    floodWorkers: 1, searchResults: 5, concurrentStreams: 1, backgroundIndexing: false,
    description: '1 concurrent stream, smaller retrieval, no background work. Best on ≤8 GB RAM.',
  },
  balanced: {
    floodWorkers: 2, searchResults: 7, concurrentStreams: 2, backgroundIndexing: true,
    description: 'Normal multi-tab use. Background indexing allowed.',
  },
  performance: {
    floodWorkers: 4, searchResults: 9, concurrentStreams: 4, backgroundIndexing: true,
    description: 'Parallel agents, faster preloading, larger caches.',
  },
}
export type ProfileId = keyof typeof PROFILES

export interface RuntimeConfig {
  port?: number
  profile?: ProfileId
  dataDir?: string
}

interface Flags {
  port?: number
  host?: string
  dataDir?: string
  profile?: ProfileId
  frontendDist?: string
  serve: boolean
}

/* ---------- CLI parsing ---------- */
export function parseFlags(argv: string[]): Flags {
  const f: Flags = { serve: argv[0] !== 'serve' ? true : true }
  const args = argv.filter((a) => a !== 'serve')
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    const val = () => args[++i]
    if (a === '--port') f.port = Number(val())
    else if (a === '--host') f.host = val()
    else if (a === '--data-dir') f.dataDir = val()
    else if (a === '--profile') {
      const p = val()
      if (p in PROFILES) f.profile = p as ProfileId
    } else if (a === '--frontend-dist') f.frontendDist = val()
    else if (a === '--help' || a === '-h') {
      console.log(`Research Engine — single-process server

Usage: research-engine serve [options]
  --port <n>          HTTP port (default 3847; auto-picks next free if busy)
  --host <addr>       Bind address (default 127.0.0.1)
  --data-dir <path>   Data directory (default ~/.research-engine)
  --profile <p>       eco | balanced | performance (default balanced)
  --frontend-dist <p> Path to built frontend (default ../frontend/dist)

Environment: RE_PORT, RE_HOST, RESEARCH_ENGINE_DATA_DIR, RE_PROFILE, FRONTEND_DIST`)
      process.exit(0)
    }
  }
  return f
}

/* ---------- config.json ---------- */
export function configPath(dataDir: string) { return join(dataDir, 'config.json') }

export function loadConfig(dataDir: string): RuntimeConfig {
  try {
    return JSON.parse(readFileSync(configPath(dataDir), 'utf8'))
  } catch {
    return {}
  }
}

export function saveConfig(dataDir: string, patch: RuntimeConfig) {
  const merged = { ...loadConfig(dataDir), ...patch }
  writeFileSync(configPath(dataDir), JSON.stringify(merged, null, 2))
  return merged
}

/* ---------- data directory ---------- */
export function ensureDataDir(dataDir: string) {
  for (const sub of ['', 'media', 'notebooks', 'cache']) {
    mkdirSync(join(dataDir, sub), { recursive: true })
  }
  if (!existsSync(configPath(dataDir))) writeFileSync(configPath(dataDir), '{}\n')
}

export function dirSize(dir: string): number {
  try {
    let total = 0
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) total += dirSize(p)
      else if (entry.isFile()) total += statSync(p).size
    }
    return total
  } catch {
    return 0
  }
}

/* ---------- port availability ---------- */
export function portFree(port: number, host: string): Promise<boolean> {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.listen({ port, host, exclusive: true }, () => { srv.close(() => res(true)) })
  })
}

export async function pickPort(preferred: number, host: string): Promise<number> {
  for (let i = 0; i < 20; i++) {
    if (await portFree(preferred + i, host)) return preferred + i
  }
  return preferred
}

/* ---------- resolution ---------- */
export interface Runtime {
  port: number
  host: string
  dataDir: string
  profile: ProfileId
  caps: ProfileCaps
  frontendDist: string | null
  dbPath: string
  rememberedPort: boolean
}

export async function resolveRuntime(argv: string[]): Promise<Runtime> {
  const flags = parseFlags(argv)

  const dataDir = resolve(flags.dataDir ?? process.env.RESEARCH_ENGINE_DATA_DIR ?? join(homedir(), '.research-engine'))
  ensureDataDir(dataDir)
  const saved = loadConfig(dataDir)

  const host = flags.host ?? process.env.RE_HOST ?? '127.0.0.1'
  const envPort = Number(process.env.RE_PORT ?? process.env.PORT ?? '')
  // Dev loop (tsx from src/) targets 8787 — the frontend dev proxy — and never
  // reuses a remembered port from a previous single-process run; built bundles
  // keep the remembered-port behaviour with a 3847 default.
  const isDev = import.meta.url.includes('/src/')
  const preferredPort = flags.port ?? (envPort || (isDev ? 8787 : (saved.port || 3847)))
  const port = await pickPort(preferredPort, host)
  const rememberedPort = port !== preferredPort

  const profileRaw = flags.profile ?? process.env.RE_PROFILE ?? saved.profile ?? 'balanced'
  const profile: ProfileId = profileRaw in PROFILES ? profileRaw as ProfileId : 'balanced'

  // Frontend dist: explicit flag > env > sibling frontend/dist relative to the backend package
  const candidates = [
    flags.frontendDist,
    process.env.FRONTEND_DIST,
    resolve(import.meta.dirname, '../../frontend/dist'),
    resolve(process.cwd(), 'frontend/dist'),
  ].filter(Boolean) as string[]
  const frontendDist = candidates.find((d) => existsSync(join(d, 'index.html'))) ?? null

  // SQLite lives inside the data directory unless overridden
  const dbPath = process.env.DB_PATH ?? join(dataDir, 'db.sqlite')
  process.env.DB_PATH = dbPath

  // Remember a port we had to move to — but never from the dev loop, where the
  // proxy target is fixed and a stray write would poison single-process config.
  if (rememberedPort && !isDev) saveConfig(dataDir, { port })

  return { port, host, dataDir, profile, caps: PROFILES[profile], frontendDist, dbPath, rememberedPort }
}
