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
import {
  projectDirOf, projectDirFor, isInternalEntry, projectsRootOf,
  isStrictlyWithinDir, normalizeProjectName,
} from '../preview/paths'
import {
  forkTree, mergeTree, changesIn, readBase, worktreePathFor, agentIdOk,
  lineDelta, describeChanges,
} from '../preview/worktree'

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
  const projectsRoot = projectsRootOf(rt.dataDir)
  mkdir(projectsRoot, { recursive: true }).catch(() => {})

  const projectDir = (name: string): string | null => projectDirOf(projectsRoot, name)

  // ---------- parallel agents: one working copy each ----------
  // Agents never edit the same folder as each other (or as you): every one of
  // them gets a private copy under <data>/worktrees/<project>/<agent>, and its
  // work comes back through a checked merge. `agent` is optional on every file
  // route so the same endpoint serves both worlds.
  const worktreesRoot = join(rt.dataDir, 'worktrees')
  mkdir(worktreesRoot, { recursive: true }).catch(() => {})
  const worktreeDir = (project: string, agent: string): string | null => {
    const name = projectDirOf(projectsRoot, project)
    if (!name) return null
    const dir = worktreePathFor(worktreesRoot, project, agent, (p) => projectDir(p) !== null)
    if (!dir) return null
    // Belt and braces: the resolved path must sit inside the worktrees root.
    return isStrictlyWithinDir(worktreesRoot, dir) ? dir : null
  }
  /** The folder a request works in: the agent's copy when one is named. */
  const scopedDir = (project: string, agent?: string | null): string | null => {
    if (agent) {
      const wt = worktreeDir(project, agent)
      if (!wt || !existsSync(wt)) return null
      return wt
    }
    return projectDir(project)
  }
  const agentParam = (c: any, key = 'agent'): string | null => {
    const v = c.req.query(key) ?? null
    return v && agentIdOk(v) ? v : null
  }

  /** Existing folder that matches `name` case-insensitively (any platform). */
  const existingFor = async (name: string): Promise<string | null> => {
    const wanted = name.toLowerCase()
    for (const e of await readdir(projectsRoot, { withFileTypes: true }).catch(() => [] as any[])) {
      if (e.isDirectory() && e.name.toLowerCase() === wanted) return e.name
    }
    return null
  }

  /** A free project name based on `base`: base, base-2, base-3 … */
  const freeName = async (base: string): Promise<string> => {
    if (!(await existingFor(base))) return base
    for (let i = 2; i < 500; i++) {
      const candidate = `${base}-${i}`
      if (!(await existingFor(candidate))) return candidate
    }
    return `${base}-${Date.now()}`
  }

  const safeRel = (dir: string, rel: string): string | null => {
    if (!rel || rel.startsWith('/') || rel.includes('\u0000')) return null
    // Reject genuine traversal ("..", "a/../..") without banning harmless names
    // such as "notes..md" — the resolved path check below is the real guard.
    if (rel.split(/[/\\]/).some((seg) => seg === '..')) return null
    const abs = resolve(join(dir, rel))
    // Separator-aware: on Windows `abs` is `C:\…\demo\a.txt` and `dir` is
    // `C:\…\demo`, so a hardcoded "/" here rejected every file in the project.
    return isStrictlyWithinDir(dir, abs) ? abs : null
  }

  // ---------- projects ----------
  r.get('/ide/projects', async (c) => {
    await mkdir(projectsRoot, { recursive: true })
    const out: { name: string; files: number; size: number; mtime: number; git: boolean }[] = []
    for (const e of await readdir(projectsRoot, { withFileTypes: true })) {
      // Names starting with "." are valid projects — only skip our own temp dirs
      // (hiding them made a freshly created project look like it never existed).
      if (!e.isDirectory() || isInternalEntry(e.name)) continue
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
    let body: { name?: string; files?: Record<string, string>; unique?: boolean; fallback?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    // Creating a project is never refused for its name. An empty, missing or
    // unusable name (an old client sending `name: ""`, a name made only of
    // characters no filesystem can store) is invented here instead of argued
    // about — `fallback` lets the caller suggest what to call it.
    //
    // The name normalises to a single path segment and is joined to the root
    // directly, so this route never depends on a path helper returning a value:
    // a null there used to become "500 Cannot read properties of null
    // (reading 'name')" instead of a project.
    const requested = normalizeProjectName(String(body.name ?? (body as any).projectName ?? ''))
    const invented = !requested
    const fallbackName = normalizeProjectName(String(body.fallback ?? ''))
    const base = (requested ?? fallbackName ?? { name: 'untitled-project' }).name
    // `unique` is what the sample button uses: never dead-end on a collision.
    const wantsUnique = !!body.unique || invented
    const name = wantsUnique ? await freeName(base) : base
    const dir = join(projectsRoot, name)
    const existing = wantsUnique ? null : await existingFor(name)
    if (existing) {
      return c.json({
        error: `A project called “${existing}” already exists.`,
        code: 'exists', existing,
      }, 409)
    }
    await mkdir(dir, { recursive: true })
    let written = 0
    for (const [rel, content] of Object.entries(body.files ?? {})) {
      const abs = safeRel(dir, rel)
      if (!abs || typeof content !== 'string' || content.length > 500_000) continue
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, content, 'utf8')
      written++
    }
    // `invented` = the request had no usable name, so one was made up here;
    // `renamed` = the name was kept but freed up with a numeric suffix.
    return c.json({ ok: true, name, renamed: name !== base, invented, files: written })
  })

  r.delete('/ide/projects/:name', async (c) => {
    const dir = projectDir(c.req.param('name'))
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    await rm(dir, { recursive: true, force: true })
    return c.json({ ok: true })
  })

  // Rename a project: the folder moves, nothing inside it is touched. The IDE
  // uses this for inline editing of the project name in the title bar.
  r.post('/ide/projects/rename', async (c) => {
    let body: { project?: string; from?: string; to?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const fromDir = projectDir(body.from ?? body.project ?? '')
    if (!fromDir || !existsSync(fromDir)) return c.json({ error: 'Project not found.' }, 404)
    // Renaming is never refused either: a name with no letters or digits to
    // build from (or one the filesystem cannot store) means "keep what it is
    // called" rather than an error dialog in the title bar.
    const currentName = await existingFor(String(body.from ?? body.project ?? ''))
    const target = projectDirFor(projectsRoot, body.to ?? '')
    if (!target) {
      return c.json({ ok: true, name: currentName, unchanged: true, kept: true, code: 'bad_name' })
    }
    const toName = target.name
    const toDir = target.dir
    if (toDir === fromDir) return c.json({ ok: true, name: toName, unchanged: true })
    // Renaming "demo" to "Demo" is not a collision — it is the same folder.
    const fromName = currentName
    const sameTarget = !!fromName && fromName.toLowerCase() === toName.toLowerCase()
    const taken = await existingFor(toName)
    if (taken && !sameTarget) {
      return c.json({ error: `A project called “${taken}” already exists.`, code: 'exists', existing: taken }, 409)
    }
    try {
      await rename(fromDir, toDir)
      return c.json({ ok: true, name: toName })
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 500)
    }
  })

  // Import a local project archive (.zip / .tar.gz / .tgz), uploaded as base64.
  // Extraction happens in a temp dir first; a single wrapping folder is flattened.
  r.post('/ide/import', async (c) => {
    let body: { name?: string; fileName?: string; dataBase64?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    // Same rule as creating: an unusable name (usually a filename that is all
    // punctuation) is invented here, never used to refuse the import.
    const wanted = projectDirFor(projectsRoot, body.name ?? '') ?? projectDirFor(projectsRoot, 'imported-project')!
    const name = await freeName(wanted.name)
    const dir = name === wanted.name ? wanted.dir : projectDirFor(projectsRoot, name)!.dir
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
      return c.json({ ok: true, name, renamed: name !== wanted.name })
    } catch (e: any) {
      await rm(tmp, { recursive: true, force: true }).catch(() => {})
      return c.json({ error: String(e?.message ?? e) }, 500)
    }
  })

  // ---------- files ----------
  r.get('/ide/tree', async (c) => {
    const dir = scopedDir(c.req.query('project') ?? '', agentParam(c))
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
    const dir = scopedDir(c.req.query('project') ?? '', agentParam(c))
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
    let body: { project?: string; path?: string; content?: string; agent?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = scopedDir(body.project ?? '', body.agent && agentIdOk(body.agent) ? body.agent : null)
    const abs = dir ? safeRel(dir, body.path ?? '') : null
    if (!abs) return c.json({ error: 'Path must stay inside the project.' }, 400)
    if (typeof body.content !== 'string' || body.content.length > 1_000_000) return c.json({ error: 'Content missing or over 1 MB.' }, 413)
    await mkdir(dirname(abs), { recursive: true })
    // Report what changed, so the UI can show "+12 −3" next to the file the
    // moment the AI touches it (this is the visibility Cursor is famous for).
    let before = ''
    let created = true
    try { before = await readFile(abs, 'utf8'); created = false } catch { before = '' }
    await writeFile(abs, body.content, 'utf8')
    const delta = created ? { added: body.content.split('\n').length, removed: 0 } : lineDelta(before, body.content)
    return c.json({ ok: true, created, added: delta.added, removed: delta.removed, bytes: body.content.length })
  })

  // Delete a file (or an empty folder) inside the project.
  r.delete('/ide/file', async (c) => {
    const dir = scopedDir(c.req.query('project') ?? '', agentParam(c))
    const abs = dir ? safeRel(dir, c.req.query('path') ?? '') : null
    if (!abs) return c.json({ error: 'Path must stay inside the project.' }, 400)
    if (!existsSync(abs)) return c.json({ error: 'File not found.' }, 404)
    await rm(abs, { recursive: true, force: true })
    return c.json({ ok: true })
  })

  // Text search across the project (skips heavy/ignored folders, caps results).
  r.get('/ide/search', async (c) => {
    const dir = scopedDir(c.req.query('project') ?? '', agentParam(c))
    if (!dir || !existsSync(dir)) return c.json({ error: 'Project not found.' }, 404)
    const q = (c.req.query('q') ?? '').trim()
    if (q.length < 2) return c.json({ results: [], note: 'Type at least 2 characters.' })
    const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'coverage', '.turbo', 'out'])
    const results: { path: string; line: number; text: string; kind: 'match' | 'file' }[] = []
    const needle = q.toLowerCase()
    const walk = async (d: string, rel: string, depth: number): Promise<void> => {
      if (depth > 8 || results.length >= 200) return
      let entries
      try { entries = await readdir(d, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        if (results.length >= 200) return
        if (SKIP.has(e.name) || e.name.startsWith('.')) continue
        const abs = join(d, e.name)
        const rp = rel ? rel + '/' + e.name : e.name
        if (e.isDirectory()) { await walk(abs, rp, depth + 1); continue }
        if (/^(.*\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|pdf|zip|gz|mp4|mp3|so|node|dylib))$/i.test(e.name)) continue
        if (rp.toLowerCase().includes(needle) && results.length < 40) results.push({ path: rp, line: 0, text: 'file name match', kind: 'file' })
        let text = ''
        try {
          const st = await stat(abs)
          if (st.size > 512 * 1024) continue
          text = await readFile(abs, 'utf8')
        } catch { continue }
        if (text.indexOf('\u0000') !== -1) continue
        const lines = text.split('\n')
        for (let i = 0; i < lines.length && results.length < 200; i++) {
          const idx = lines[i].toLowerCase().indexOf(needle)
          if (idx === -1) continue
          results.push({ path: rp, line: i + 1, text: lines[i].trim().slice(0, 200), kind: 'match' })
        }
      }
    }
    await walk(dir, '', 0)
    return c.json({ results, truncated: results.length >= 200 })
  })

  // ---------- guarded command execution ----------
  // The request must carry the exact command the UI (or the AI) showed the
  // user. Dangerous commands are refused outright; guarded ones require an
  // explicit confirm flag that the UI only sets after the user approves.
  r.post('/ide/exec', async (c) => {
    let body: { project?: string; command?: string; confirmed?: boolean; timeoutMs?: number; agent?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dir = scopedDir(body.project ?? '', body.agent && agentIdOk(body.agent) ? body.agent : null)
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
    console.log(`[re] ide exec [${body.project}${body.agent ? ` · agent ${body.agent}` : ''}] exit=${out.exit} ${command.slice(0, 100)}`)
    return c.json({ ...out, ms: Date.now() - t0, stdout: out.stdout.slice(0, OUTPUT_CAP), stderr: out.stderr.slice(0, OUTPUT_CAP), truncated: out.stdout.length >= OUTPUT_CAP || out.stderr.length >= OUTPUT_CAP })
  })

  // ---------- parallel agents (Codex-style, without the collisions) ----------
  // fork → work → review → merge. Each agent gets its own copy of the project,
  // so two agents running at once cannot write the same file; the merge is the
  // only place they meet, and it refuses to clobber anything you changed.
  r.post('/ide/agents/fork', async (c) => {
    let body: { project?: string; agent?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const project = body.project ?? ''
    const agent = body.agent ?? ''
    if (!agentIdOk(agent)) return c.json({ error: 'Agent id must be 3-40 chars of a-z, 0-9 or -.' }, 400)
    const src = projectDir(project)
    const dest = worktreeDir(project, agent)
    if (!src || !existsSync(src)) return c.json({ error: 'Project not found.' }, 404)
    if (!dest) return c.json({ error: 'Could not allocate a working copy.' }, 400)
    try {
      const fork = await forkTree(src, dest)
      return c.json({ ok: true, agent, worktree: dest, files: fork.files, bytes: fork.bytes, skipped: fork.skipped.length })
    } catch (e: any) {
      return c.json({ error: `Could not fork the project: ${String(e?.message ?? e)}` }, 500)
    }
  })

  r.get('/ide/agents/changes', async (c) => {
    const project = c.req.query('project') ?? ''
    const agent = c.req.query('agent') ?? ''
    const dest = worktreeDir(project, agent)
    if (!dest || !existsSync(dest)) return c.json({ error: 'No working copy for that agent.' }, 404)
    const changes = await changesIn(dest)
    const src = projectDir(project)
    const base = await readBase(dest)
    // Line counts for the review pane: base content vs the agent's version.
    const files = []
    for (const change of changes.slice(0, 200)) {
      let added = 0, removed = 0, before = ''
      try { before = src && base[change.path] ? await readFile(join(src, change.path), 'utf8') : '' } catch { before = '' }
      try {
        const after = await readFile(join(dest, change.path), 'utf8')
        if (change.kind === 'deleted') { removed = before.split('\n').length }
        else {
          const d = lineDelta(before, after)
          added = d.added; removed = d.removed
        }
      } catch { /* binary */ }
      files.push({ ...change, added, removed, base: before.slice(0, 400_000) })
    }
    return c.json({ changes: files, summary: describeChanges(changes), skipped: changes.length - files.length })
  })

  r.post('/ide/agents/merge', async (c) => {
    let body: { project?: string; agent?: string; files?: string[] }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dest = worktreeDir(body.project ?? '', body.agent ?? '')
    const src = projectDir(body.project ?? '')
    if (!dest || !existsSync(dest)) return c.json({ error: 'No working copy for that agent.' }, 404)
    if (!src || !existsSync(src)) return c.json({ error: 'Project not found.' }, 404)
    const only = Array.isArray(body.files) ? body.files.filter((f) => typeof f === 'string' && !f.includes('..')) : undefined
    const result = await mergeTree({ worktreeDir: dest, projectDir: src, only })
    console.log(`[re] agent merge [${body.project} · ${body.agent}] ${result.merged.length} merged, ${result.conflicts.length} conflicted`)
    return c.json({
      ok: true,
      merged: result.merged,
      conflicts: result.conflicts,
      unchanged: result.unchanged.length,
      missing: result.missing,
      summary: `${result.merged.length} file${result.merged.length === 1 ? '' : 's'} merged${result.conflicts.length ? `, ${result.conflicts.length} conflict(s) kept aside` : ''}`,
    })
  })

  r.post('/ide/agents/discard', async (c) => {
    let body: { project?: string; agent?: string }
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const dest = worktreeDir(body.project ?? '', body.agent ?? '')
    if (!dest) return c.json({ error: 'Unknown agent.' }, 400)
    await rm(dest, { recursive: true, force: true })
    return c.json({ ok: true })
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
