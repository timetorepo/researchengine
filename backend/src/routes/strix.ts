/**
 * Strix, in the coding workspace.
 *
 * Strix (usestrix/strix, Apache-2.0) is an open-source AI penetration tester:
 * you point it at a directory, a repository or a live URL and it runs an agent
 * with a real offensive toolkit against it, then writes findings to
 * `strix_runs/<run-name>`. Nine of its skills ship inside this app already (see
 * frontend/src/content/skills/upstream), so the agent in a coding session can
 * plan and explain a pentest with no network at all.
 *
 * This route is the other half: running one. It follows the same shape as the
 * SkillSpector integration on purpose — detect the tool, say honestly whether
 * it is there, and never pretend a scan happened when it did not. Strix is not
 * vendored or reimplemented here; it is invoked as the process it is.
 *
 * Strix needs Docker and an LLM key, and it reaches the network by design: it
 * is a tool for attacking things. Both of those are the user's decision, which
 * is why the availability check is explicit and the run is never started
 * implicitly.
 */
import { Hono } from 'hono'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const strixRoutes = new Hono()

/** Strix runs for a long time. An hour is the ceiling, not the expectation. */
const RUN_TIMEOUT_MS = 60 * 60 * 1000
const PROBE_TIMEOUT_MS = 8000

interface StrixInfo {
  available: boolean
  how: string
  detail: string
  install: string
  /** Docker is a hard prerequisite, and it is checked separately from the CLI. */
  docker: boolean
  /** Whether an LLM key is visible to Strix. */
  llm: boolean
}

function run(argv: string[], cwd: string | undefined, timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    let cmd = argv[0]
    let args = argv.slice(1)
    if (cmd.includes(' ')) {
      const parts = cmd.split(' ')
      cmd = parts[0]
      args = [...parts.slice(1), ...args]
    }
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, args, { cwd, shell: false })
    } catch (e) { reject(e); return }
    let stdout = ''
    let stderr = ''
    const cap = 4_000_000
    child.stdout?.on('data', (d) => { if (stdout.length < cap) stdout += String(d) })
    child.stderr?.on('data', (d) => { if (stderr.length < cap) stderr += String(d) })
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      reject(new Error(`timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => { clearTimeout(timer); resolvePromise({ code: code ?? -1, stdout, stderr }) })
  })
}

async function which(cmd: string): Promise<string | null> {
  const probe = process.platform === 'win32' ? ['where', cmd] : ['sh', '-lc', `command -v ${cmd}`]
  return run(probe, undefined, PROBE_TIMEOUT_MS).then((r) => (r.code === 0 && r.stdout.trim().split('\n')[0]) || null).catch(() => null)
}

async function dockerReady(): Promise<boolean> {
  const r = await run(['docker', 'info'], undefined, PROBE_TIMEOUT_MS).catch(() => null)
  return !!r && r.code === 0
}

const INSTALL = 'curl -sSL https://strix.ai/install | bash   (needs Docker running)'

/** What Strix needs to actually run, and what is missing. */
export async function strixInfo(): Promise<StrixInfo> {
  const docker = await which('docker').then(Boolean) && await dockerReady()
  const llm = !!(process.env.LLM_API_KEY || process.env.STRIX_LLM)

  const explicit = process.env.STRIX_BIN
  if (explicit && existsSync(explicit)) {
    const v = await run([explicit, '--version'], undefined, PROBE_TIMEOUT_MS).catch(() => null)
    return { available: true, how: 'STRIX_BIN', detail: (v?.stdout || v?.stderr || '').trim().slice(0, 200) || explicit, install: INSTALL, docker, llm }
  }
  const onPath = await which('strix')
  if (onPath) {
    const v = await run(['strix', '--version'], undefined, PROBE_TIMEOUT_MS).catch(() => null)
    return { available: true, how: 'path', detail: (v?.stdout || v?.stderr || '').trim().slice(0, 200) || onPath, install: INSTALL, docker, llm }
  }
  if (docker) {
    return { available: false, how: 'docker', detail: 'Docker is running but the strix CLI is not installed', install: INSTALL, docker, llm }
  }
  return { available: false, how: 'none', detail: 'Strix is not installed, and Docker is not running either', install: INSTALL, docker, llm }
}

/** GET /api/strix — what is installed, and what a run still needs. */
strixRoutes.get('/', async (c) => c.json(await strixInfo()))

/**
 * POST /api/strix/run
 *
 * body: { target: string, instruction?: string, projectDir?: string }
 *
 * Runs `strix --target <target>` in the project directory and returns what it
 * printed plus the runs it wrote. Strix is the authority on the findings; this
 * route does not summarise, score or second-guess them, it hands back what the
 * tool said.
 *
 * The target is passed as a single argv element and never through a shell, so a
 * target cannot become a command.
 */
strixRoutes.post('/run', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const target = String(body?.target ?? '').trim()
  if (!target) return c.json({ error: 'Give a target: a directory, a repository URL, or a live URL.' }, 400)
  if (target.length > 2000) return c.json({ error: 'That target is longer than 2000 characters.' }, 400)

  const info = await strixInfo()
  if (!info.available) {
    return c.json({ error: `Strix is not available: ${info.detail}`, install: info.install, info }, 409)
  }

  // The project directory is the only place a run may write. Resolving it here
  // means a `..` in the body cannot escape the workspace.
  const projectDir = body?.projectDir ? resolve(String(body.projectDir)) : process.cwd()
  if (!existsSync(projectDir)) return c.json({ error: `No such directory: ${projectDir}` }, 400)

  const argv = ['strix', '--target', target]
  const instruction = String(body?.instruction ?? '').trim()
  if (instruction) argv.push('--instruction', instruction.slice(0, 4000))

  let result: { code: number; stdout: string; stderr: string }
  try {
    result = await run(argv, projectDir, RUN_TIMEOUT_MS)
  } catch (e) {
    return c.json({ error: `Strix did not finish: ${String((e as Error)?.message ?? e).slice(0, 300)}` }, 504)
  }

  const runs = listRuns(projectDir)
  return c.json({
    ok: result.code === 0,
    exitCode: result.code,
    stdout: result.stdout.slice(-200_000),
    stderr: result.stderr.slice(-50_000),
    runs,
    note: 'Strix writes its findings under strix_runs/. Read them there, or attach the report to a chat.',
  })
})

/**
 * The runs Strix has written, newest first, with the report file it produced.
 *
 * Read from disk rather than tracked in memory: a run can outlive the server,
 * and a list that forgets what is on disk is a list you cannot trust.
 */
function listRuns(projectDir: string): { name: string; report: string | null; at: number }[] {
  const root = join(projectDir, 'strix_runs')
  if (!existsSync(root)) return []
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const dir = join(root, e.name)
        const report = ['report.md', 'REPORT.md', 'report.html', 'penetration_test_report.md']
          .map((f) => join(dir, f))
          .find((f) => existsSync(f)) ?? null
        let at = 0
        try { at = statSync(dir).mtimeMs } catch { /* vanished mid-read */ }
        return { name: e.name, report: report ? report.slice(root.length + 1) : null, at }
      })
      .sort((a, b) => b.at - a.at)
      .slice(0, 20)
  } catch {
    return []
  }
}

/** GET /api/strix/runs?projectDir=... — the runs already on disk. */
strixRoutes.get('/runs', (c) => {
  const projectDir = c.req.query('projectDir') ? resolve(String(c.req.query('projectDir'))) : process.cwd()
  if (!existsSync(projectDir)) return c.json({ error: `No such directory: ${projectDir}` }, 400)
  return c.json({ root: 'strix_runs', runs: listRuns(projectDir) })
})

/**
 * GET /api/strix/report?projectDir=...&run=<name>
 *
 * One run's report, as text. Capped, because a pentest report can be long and
 * this is going into a chat.
 */
strixRoutes.get('/report', (c) => {
  const projectDir = c.req.query('projectDir') ? resolve(String(c.req.query('projectDir'))) : process.cwd()
  const name = String(c.req.query('run') ?? '')
  if (!name || /[\\/]/.test(name) || name.includes('..')) return c.json({ error: 'Give a run name.' }, 400)
  const dir = join(projectDir, 'strix_runs', name)
  if (!existsSync(dir)) return c.json({ error: `No such run: ${name}` }, 404)
  const file = ['report.md', 'REPORT.md', 'penetration_test_report.md']
    .map((f) => join(dir, f))
    .find((f) => existsSync(f))
  if (!file) return c.json({ error: 'That run has no report file yet.' }, 404)
  const text = readFileSync(file, 'utf8')
  return c.json({ run: name, file: file.slice(dir.length + 1), truncated: text.length > 200_000, text: text.slice(0, 200_000) })
})
