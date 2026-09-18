// Coding mode backend: local projects, sandboxed file editing, git, and a
// heavily-guarded command runner. The runner is the ONLY way commands reach
// the machine, and it enforces: cwd confinement, env scrubbing, a hard
// denylist, a confirm-required list, timeouts, and output caps.
import { mkdir, readFile, readdir, rm, stat, writeFile, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Runtime } from '../runtime'

const EXEC_TIMEOUT_MS = 60_000
const OUTPUT_CAP = 200_000
const IMPORT_CAP = 24 * 1024 * 1024

// Never allowed, regardless of confirmation.
const DENY = [
  /\brm\s+(-[a-z]*\s+)*(-[a-z]*\s+)*\/(\s|$)/, // rm -rf /
  /\brm\s+-[a-z]*r[a-z]*\s+~\/?\s*($|;|&|\|)/, // rm -rf ~
  /\bsudo\b/, /\bsu\s+-/, /doas\b/,
  /\bmkfs\b/, /\bdd\s+if=/, /\bfdisk\b/, /\bparted\b/,
  /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, // fork bomb
  /\bshutdown\b/, /\breboot\b/, /\bhalt\b/, /\bpoweroff\b/, /\binit\s+0/,
  /\bchmod\s+(-R\s+)?777\s+\//, /\bchown\s+-R\s+[^\s]+\s+\//,
  /\/dev\/(sd[a-z]|nvme|disk)/,
  /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh/, // pipe-to-shell
  /\beval\s+.*\b(curl|wget)\b/, /\bbase64\s+(-d|--decode)[^\n]*\|\s*(ba)?sh/,
  /\bcrontab\b/, /\bat\s+-f/, /\bsystemctl\b/, /\blaunchctl\b/,
  /\bkill\s+(-9\s+)?1\b/, /\bkillall\b/,
  /\bnpm\s+publish\b/, /\bcargo\s+publish\b/, /\btwine\s+upload\b/,
  /\bgit\s+push\s+(--force\b|.*--force\b|-f\b)/,
  /\biptables\b/, /\bufw\b/, /\bifconfig\b.*\bdown\b/, /\broute\s+(del|add)/,
  /\buseradd\b/, /\buserdel\b/, /\bpasswd\b/, /\bvisudo\b/,
  /\bformat\s+[a-z]:/i, /\bdel\s+\/[sfq]+\s+[a-z]:\\/i, /\brmdir\s+\/s/i,
  /\breg\s+(delete|add)\b/i, /\bnet\s+user\b/i,
  />~?\/(etc|usr|bin|boot|proc|sys)\//, /\bssh\b.*-[iLDR]\b/, /\bscp\b/, /\brsync\b/,
  /\bnc\b.*-[elp]/, /\bnetcat\b/, /\btelnetd\b/, /\bminer\b/i, /xmrig/i,
]

// Allowed only with an explicit user confirmation (surfaced in the UI).
const NEEDS_CONFIRM = [
  /\brm\b/, /\bmv\b/, /\bgit\s+(push|reset|clean|checkout\s+--|restore)\b/,
  /\b(npm|yarn|pnpm|bun)\s+(install|add|remove|update|run\s+build)\b/,
  /\bpip3?\s+install\b/, /\bdocker\b/, /\bkubectl\b/, /\bgit\s+commit\b/,
  /\bmkdir\b/, /\btouch\b/, /\bchmod\b/, /\bnpx\b/, /\bmake\b/,
]

function scrubbedEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (/key|token|secret|passw|credential|auth/i.test(k)) continue
    if (typeof v === 'string') out[k] = v
  }
  return out
}

export function ideRoutes(rt: Runtime) {
  const r = new Hono()
  const projectsRoot = resolve(join(rt.dataDir, 'projects'))
  mkdir(projectsRoot, { recursive: true }).catch(() => {})

  const safeName = (name: string): string | null => {
    const normalized = String(name ?? '').trim().replace(/\s+/g, ' ')
    if (!normalized || normalized.length > 64 || normalized === '.' || normalized === '..') return null
    if (/[\/\\\u0000]/.test(normalized)) return null
    return normalized
  }

  const projectDir = (name: string): string | null => {
    const n = safeName(name)
    if (!n) return null
    const abs = resolve(join(projectsRoot, n))
    return abs.startsWith(projectsRoot + '/') ? abs : null
  }

  const safeRel = (dir: string, rel: string): string | null => {
    if (!rel || rel.startsWith('/') || rel.includes('..')) return null
    const abs = resolve(join(dir, rel))
    return abs.startsWith(dir + '/') ? abs : null
  }

  // ---------- projects ----------
  r.get('/ide/projects', async (c) => {
    await mkdir(projectsRoot, { recursive: true })
    const out: { name: string; files: number; size: number; mtime: number; git: boolean }[] = []
    for (const e of await readdir(projectsRoot, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const dir = join(projectsRoot, e.name)
      let files = 0, size = 0
      const walk = async (d: string, depth: number) => {
        if (depth > 6) return
        for (const f of await readdir(d, { withFileTypes: true })) {
          if (f.name === 'node_modules' || f.name === '.git' || f.name.startsWith('.')) continue
          const p = join(d, f.name)
          if (f.isDirectory()) await walk(p, depth + 1)
          else { files++; try { size += (await stat(p)).size } catch { /* ignore */ } }
        }
      }
      await walk(dir, 0).catch(() => {})
      let mtime = 0
      try { mtime = (await stat(dir)).mtimeMs } catch { /* ignore */ }
      out.push({ name: e.name, files, size, mtime, git: existsSync(join(dir, '.git')) })
    }
    return c.json({ projects: out.sort((a, b) => b.mtime - a.mtime) })
  })

  r.post('/ide/projects', async (c) => {
    let body: { name?: string; files?: Record<string, string> }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = projectDir(body.name ?? '')
    if (!dir) return c.json({ error: 'Project name must be 1-64 characters and cannot contain path separators.' }, 400)
    if (existsSync(dir)) return c.json({ error: 'A project with this name already exists.' }, 409)
    await mkdir(dir, { recursive: true })
    for (const [rel, content] of Object.entries(body.files ?? {})) {
      const abs = safeRel(dir, rel)
      if (!abs || typeof content !== 'string' || content.length > 500_000) continue
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, content, 'utf8')
    }
    return c.json({ ok: true, name: body.name })
  })

  r.delete('/ide/projects/:name', async (c) => {
    const dir = projectDir(c.req.param('name'))
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    await rm(dir, { recursive: true, force: true })
    return c.json({ ok: true })
  })

  // Import a local project archive (.zip / .tar.gz / .tgz), uploaded as base64.
  // Extraction happens in a temp dir first; a single wrapping folder is flattened.
  r.post('/ide/import', async (c) => {
    let body: { name?: string; fileName?: string; dataBase64?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = projectDir(body.name ?? '')
    if (!dir) return c.json({ error: 'Invalid project name.' }, 400)
    if (existsSync(dir)) return c.json({ error: 'A project with this name already exists.' }, 409)
    const buf = Buffer.from(body.dataBase64 ?? '', 'base64')
    if (!buf.length || buf.length > IMPORT_CAP) return c.json({ error: 'Archive missing or larger than 24 MB.' }, 413)
    const fn = (body.fileName ?? 'project.zip').toLowerCase()
    const isZip = fn.endsWith('.zip')
    const isTar = fn.endsWith('.tar.gz') || fn.endsWith('.tgz') || fn.endsWith('.tar')
    if (!isZip && !isTar) return c.json({ error: 'Upload a .zip, .tar.gz or .tgz archive.' }, 400)

    const tmp = join(projectsRoot, `.import-${randomUUID()}`)
    await mkdir(tmp, { recursive: true })
    const archive = join(tmp, isZip ? 'up.zip' : 'up.tar.gz')
    try {
      await writeFile(archive, buf)
      const res = isZip
        ? spawnSync('unzip', ['-q', '-o', archive, '-d', tmp], { timeout: 60_000 })
        : spawnSync('tar', ['-xf', archive, '-C', tmp], { timeout: 60_000 })
      if (res.status !== 0) return c.json({ error: 'Could not extract the archive (it may be corrupted or password-protected).' }, 400)
      await rm(archive, { force: true })
      // Flatten a single wrapping folder (common in GitHub-style zips).
      let entries = (await readdir(tmp)).filter((n) => !n.startsWith('.'))
      if (entries.length === 1 && (await stat(join(tmp, entries[0]))).isDirectory()) {
        const inner = join(tmp, entries[0])
        for (const f of await readdir(inner)) await rename(join(inner, f), join(tmp, f))
        await rm(inner, { force: true })
      }
      await rename(tmp, dir)
      return c.json({ ok: true, name: body.name })
    } catch (e: any) {
      await rm(tmp, { recursive: true, force: true }).catch(() => {})
      return c.json({ error: String(e?.message ?? e) }, 500)
    }
  })

  // ---------- files ----------
  r.get('/ide/tree', async (c) => {
    const dir = projectDir(c.req.query('project') ?? '')
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    type Node = { name: string; path: string; dir: boolean; children?: Node[] }
    const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv'])
    const walk = async (d: string, rel: string, depth: number): Promise<Node[]> => {
      if (depth > 8) return []
      const out: Node[] = []
      for (const e of await readdir(d, { withFileTypes: true })) {
        if (SKIP.has(e.name)) continue
        const p = join(d, e.name)
        const rp = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) out.push({ name: e.name, path: rp, dir: true, children: await walk(p, rp, depth + 1) })
        else out.push({ name: e.name, path: rp, dir: false })
      }
      return out.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
    }
    return c.json({ tree: await walk(dir, '', 0) })
  })

  r.get('/ide/file', async (c) => {
    const dir = projectDir(c.req.query('project') ?? '')
    const abs = dir ? safeRel(dir, c.req.query('path') ?? '') : null
    if (!abs) return c.json({ error: 'Path must stay inside the project.' }, 400)
    try {
      const st = await stat(abs)
      if (st.size > 1_000_000) return c.json({ error: 'File too large to edit here (1 MB limit).' }, 413)
      return c.json({ content: await readFile(abs, 'utf8') })
    } catch {
      return c.json({ error: 'File not found.' }, 404)
    }
  })

  r.post('/ide/file', async (c) => {
    let body: { project?: string; path?: string; content?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = projectDir(body.project ?? '')
    const abs = dir ? safeRel(dir, body.path ?? '') : null
    if (!abs) return c.json({ error: 'Path must stay inside the project.' }, 400)
    if (typeof body.content !== 'string' || body.content.length > 1_000_000) return c.json({ error: 'Content missing or over 1 MB.' }, 413)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, body.content, 'utf8')
    return c.json({ ok: true })
  })

  // ---------- guarded command execution ----------
  // The request must carry the exact command the UI (or the AI) showed the
  // user. Dangerous commands are refused outright; guarded ones require an
  // explicit confirm flag that the UI only sets after the user approves.
  r.post('/ide/exec', async (c) => {
    let body: { project?: string; command?: string; confirmed?: boolean; timeoutMs?: number }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = projectDir(body.project ?? '')
    const command = (body.command ?? '').trim()
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    if (!command || command.length > 2000) return c.json({ error: 'Empty or oversized command.' }, 400)

    const denied = DENY.find((re) => re.test(command))
    if (denied) return c.json({ blocked: true, reason: 'This command matches a hard safety rule and can never run from Research Engine.' }, 200)
    const guarded = NEEDS_CONFIRM.find((re) => re.test(command))
    if (guarded && !body.confirmed) return c.json({ requiresConfirm: true, reason: 'This command modifies files, installs packages, or touches git history. Review and approve it.' }, 200)

    const timeout = Math.min(body.timeoutMs ?? EXEC_TIMEOUT_MS, EXEC_TIMEOUT_MS)
    const t0 = Date.now()
    const out = await new Promise<{ exit: number | null; stdout: string; stderr: string; timedOut: boolean }>((res) => {
      const child = spawn('/bin/sh', ['-c', command], { cwd: dir, env: scrubbedEnv(), timeout })
      let stdout = '', stderr = '', timedOut = false
      const to = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, timeout)
      child.stdout.on('data', (d) => { if (stdout.length < OUTPUT_CAP) stdout += d.toString() })
      child.stderr.on('data', (d) => { if (stderr.length < OUTPUT_CAP) stderr += d.toString() })
      child.on('close', (code) => { clearTimeout(to); res({ exit: code, stdout, stderr, timedOut }) })
      child.on('error', (e) => { clearTimeout(to); res({ exit: -1, stdout, stderr: String(e), timedOut }) })
    })
    console.log(`[re] ide exec [${body.project}] exit=${out.exit} ${command.slice(0, 100)}`)
    return c.json({ ...out, ms: Date.now() - t0, stdout: out.stdout.slice(0, OUTPUT_CAP), stderr: out.stderr.slice(0, OUTPUT_CAP), truncated: out.stdout.length >= OUTPUT_CAP || out.stderr.length >= OUTPUT_CAP })
  })

  // Git passthrough — only git subcommands on a safe list, always inside the project.
  r.get('/ide/git', async (c) => {
    const dir = projectDir(c.req.query('project') ?? '')
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    const ALLOWED: Record<string, string[]> = {
      status: ['status', '--porcelain=v1', '-b'],
      log: ['log', '--oneline', '-30'],
      diff: ['diff', '--stat'],
      branches: ['branch', '-a'],
      remote: ['remote', '-v'],
    }
    const op = c.req.query('op') ?? 'status'
    const args = ALLOWED[op]
    if (!args) return c.json({ error: 'Unknown git op.' }, 400)
    if (!existsSync(join(dir, '.git'))) return c.json({ norepo: true })
    const res = spawnSync('git', args, { cwd: dir, env: scrubbedEnv(), timeout: 15_000, maxBuffer: 2 * 1024 * 1024 })
    return c.json({ exit: res.status, stdout: (res.stdout ?? '').toString().slice(0, OUTPUT_CAP), stderr: (res.stderr ?? '').toString().slice(0, 4000) })
  })

  // Write ops that mutate git state go through exec-style guarding.
  r.post('/ide/git', async (c) => {
    let body: { project?: string; op?: string; message?: string; confirmed?: boolean }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = projectDir(body.project ?? '')
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    const run = (args: string[]) => {
      const res = spawnSync('git', args, { cwd: dir, env: scrubbedEnv(), timeout: 15_000, maxBuffer: 2 * 1024 * 1024 })
      return { exit: res.status, stdout: (res.stdout ?? '').toString().slice(0, OUTPUT_CAP), stderr: (res.stderr ?? '').toString().slice(0, 4000) }
    }
    if (body.op === 'init') return c.json(run(['init']))
    // Every op below needs an existing repository.
    if (!existsSync(join(dir, '.git'))) return c.json({ error: 'Not a git repository.' }, 400)
    if (body.op === 'add') return c.json(run(['add', '-A']))
    if (body.op === 'commit') {
      const msg = (body.message ?? '').trim().slice(0, 500)
      if (!msg) return c.json({ error: 'Commit message required.' }, 400)
      if (!body.confirmed) return c.json({ requiresConfirm: true, reason: 'Commit staged changes to local git history.' })
      run(['add', '-A'])
      // Provide a local fallback identity so commits work even when the
      // machine has no global git user configured (sandboxed env).
      const res = spawnSync('git', [
        '-c', 'user.name=Research Engine', '-c', 'user.email=research-engine@local',
        'commit', '-m', msg,
      ], { cwd: dir, env: scrubbedEnv(), timeout: 15_000, maxBuffer: 2 * 1024 * 1024 })
      return c.json({ exit: res.status, stdout: (res.stdout ?? '').toString().slice(0, OUTPUT_CAP), stderr: (res.stderr ?? '').toString().slice(0, 4000) })
    }
    return c.json({ error: 'Unknown git op.' }, 400)
  })

  return r
}
