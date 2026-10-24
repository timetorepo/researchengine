/**
 * Skill import and the security scan in front of it.
 *
 * Importing a skill means running someone else's instructions with this app's
 * permissions, so the two halves belong together: you bring a skill in, and
 * before it can be saved it is scanned. The scanner is NVIDIA's SkillSpector
 * (github.com/NVIDIA/SkillSpector) — the real tool, invoked as a process, not a
 * reimplementation of it:
 *
 *   skillspector scan <dir> --format json --no-llm
 *
 * `--no-llm` on purpose. SkillSpector's default sends the skill's file
 * contents to a configured model provider; a security scan that quietly
 * uploads the thing it is inspecting is the wrong default for an app whose
 * whole promise is that your work stays on your machine. The static pass
 * (regex, Python AST, YARA) needs no key, no network, and no egress.
 *
 * When the binary is not installed we say so instead of failing: the skill is
 * still scanned by this app's own static pass, and the verdict is labelled
 * `local-static` so a scan by the real tool and a scan by ours can never be
 * confused for one another. `GET /api/skills/scanner` reports what is
 * available, and the UI links to the install command.
 */
import { Hono } from 'hono'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { db } from '../db'
import { scanForTrojan, type TrojanReport } from '../../../frontend/src/lib/security/trojan'

export const skillsRoutes = new Hono()

const TIMEOUT_MS = 120_000
const MAX_FILES = 200
const MAX_FILE_BYTES = 400_000
const MAX_TOTAL_BYTES = 4_000_000

export type SkillFile = { path: string; text: string }

/* -------------------------------------------------------- the scanner ---- */

/**
 * Which binary to run, in the order the project itself documents: an explicit
 * `SKILLSPECTOR_BIN`, then the local virtualenv the README creates, then
 * whatever is on PATH, then the published Docker image.
 */
export function scannerCandidates(): { kind: 'bin' | 'docker'; cmd: string; args: string[] }[] {
  const out: { kind: 'bin' | 'docker'; cmd: string; args: string[] }[] = []
  if (process.env.SKILLSPECTOR_BIN) out.push({ kind: 'bin', cmd: process.env.SKILLSPECTOR_BIN, args: [] })
  const venv = process.env.SKILLSPECTOR_VENV && join(process.env.SKILLSPECTOR_VENV, 'bin', 'skillspector')
  if (venv) out.push({ kind: 'bin', cmd: venv, args: [] })
  out.push({ kind: 'bin', cmd: 'skillspector', args: [] })
  out.push({ kind: 'bin', cmd: 'skillspector.exe', args: [] })
  out.push({ kind: 'bin', cmd: 'python3 -m skillspector', args: [] })
  out.push({ kind: 'docker', cmd: 'docker', args: ['run', '--rm', '-v'] })
  return out
}

interface ScannerInfo { available: boolean; how: string; detail: string; install: string; llm: false }

export async function scannerInfo(): Promise<ScannerInfo> {
  const install = 'pipx install graph-skillspector  (or: docker pull skillspector)'
  const explicit = process.env.SKILLSPECTOR_BIN
  if (explicit && existsSync(explicit)) {
    const v = await run([explicit, '--version'], undefined, 8000).catch(() => null)
    return { available: true, how: 'SKILLSPECTOR_BIN', detail: (v?.stdout || v?.stderr || '').trim().slice(0, 200) || explicit, install, llm: false }
  }
  const onPath = await which('skillspector')
  if (onPath) {
    const v = await run(['skillspector', '--version'], undefined, 8000).catch(() => null)
    return { available: true, how: 'path', detail: (v?.stdout || v?.stderr || '').trim().slice(0, 200) || onPath, install, llm: false }
  }
  const docker = await which('docker')
  if (docker) {
    const info = await run(['docker', 'image', 'inspect', 'skillspector'], undefined, 8000).catch(() => null)
    if (info && info.code === 0) {
      return { available: true, how: 'docker', detail: 'image skillspector', install, llm: false }
    }
    return { available: false, how: 'docker', detail: 'docker is installed but the skillspector image is not pulled', install: 'docker pull skillspector', llm: false }
  }
  return { available: false, how: 'none', detail: 'SkillSpector is not installed on this machine', install, llm: false }
}

function which(cmd: string): Promise<string | null> {
  const probe = process.platform === 'win32' ? ['where', cmd] : ['sh', '-lc', `command -v ${cmd}`]
  return run(probe, undefined, 6000).then((r) => (r.code === 0 && r.stdout.trim().split('\n')[0]) || null).catch(() => null)
}

function run(argv: string[], cwd: string | undefined, timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    let cmd = argv[0]
    let args = argv.slice(1)
    // `python3 -m skillspector` arrives as one string in the candidate list.
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
    const cap = 2_000_000
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

/* --------------------------------------------- local static pre-scan ------ */

/**
 * This app's own quick pass, run before (and when) SkillSpector is not
 * available. It is a pre-scan, not a second opinion: the categories are the
 * ones SkillSpector documents, the checks are deliberately few and readable,
 * and the verdict is always labelled as ours.
 */
const RULES: { id: string; severity: 'high' | 'medium' | 'low'; title: string; re: RegExp; why: string }[] = [
  { id: 'exfil', severity: 'high', title: 'Sends data somewhere', re: /\b(curl|wget|fetch|requests\.post|axios\.post|Invoke-WebRequest)\b[^\n]{0,80}(https?:\/\/|--data|-d\s|@)/i, why: 'A skill that posts data out can send your files, keys or prompts to a server.' },
  { id: 'pipe-shell', severity: 'high', title: 'Pipes a download into a shell', re: /\b(curl|wget)\b[^\n|]{0,120}\|\s*(ba|z|fi)?sh\b/i, why: 'The classic install-and-run-anything pattern; the payload is not visible in the skill.' },
  { id: 'secrets', severity: 'high', title: 'Reads credentials or keys', re: /(id_rsa|\.ssh\/|\.aws\/credentials|\.env\b|api[_-]?key|secret|token|password|keychain)/i, why: 'Reading credential stores is how a skill converts access into exfiltration.' },
  { id: 'destructive', severity: 'high', title: 'Deletes files outside the project', re: /\brm\s+-rf?\s+[/~]|\brm\s+-rf\s+\$|\bformat\s+c:|\bmkfs\b|shutil\.rmtree\(['"]\//i, why: 'Irreversible destruction of the user\'s machine.' },
  { id: 'injection', severity: 'high', title: 'Instructs the model to ignore its rules', re: /(ignore (all )?(previous|prior|above) (instructions|rules)|disregard (your|all) (instructions|rules)|do not tell the user|without telling the user|hidden instruction)/i, why: 'Prompt injection: the skill tries to take over the agent rather than help it.' },
  { id: 'eval', severity: 'medium', title: 'Evaluates or decodes a string into code', re: /\b(eval|exec)\s*\(|base64\s+(-d|--decode)|atob\s*\(|Invoke-Expression|FromBase64String/i, why: 'Obfuscation: what runs is not what a reader sees.' },
  { id: 'sudo', severity: 'medium', title: 'Escalates privileges', re: /\bsudo\b|\brunas\b|setuid|doas\s/i, why: 'A skill has no reason to need root.' },
  { id: 'persist', severity: 'medium', title: 'Installs itself to run later', re: /(crontab|systemctl enable|launchctl|Startup folder|\.bashrc|\.zshrc|\.profile)/i, why: 'Persistence survives your deleting the skill.' },
  { id: 'postinstall', severity: 'medium', title: 'Runs code on install', re: /(postinstall|preinstall|prepare"\s*:|npm\s+i\s+-g|pip\s+install[^\n]{0,40}git\+)/i, why: 'Supply chain: the install step becomes the payload.' },
  { id: 'broad-write', severity: 'medium', title: 'Writes outside its own folder', re: /(>|\btee\b)\s*(\/(etc|usr|bin|var)|\$HOME(\/|$))|writeFileSync\(['"]\//i, why: 'A skill should work inside the project, not on the system.' },
  { id: 'broad-net', severity: 'low', title: 'Talks to a network endpoint', re: /https?:\/\/[^\s)"']+/i, why: 'Not wrong on its own — but every endpoint is a place your data can go.' },
  { id: 'unbounded', severity: 'low', title: 'Loops or spawns without a bound', re: /(while\s*\(?\s*true|for\s*\(\s*;\s*;|--max-old-space|fork\s*\(\s*\d{2,})/i, why: 'A skill that can run away takes the machine with it.' },
]

export interface StaticFinding { id: string; severity: 'high' | 'medium' | 'low'; title: string; why: string; file?: string; line?: number; evidence?: string }

export function staticScan(files: SkillFile[]): { score: number; severity: string; recommendation: string; findings: StaticFinding[] } {
  const findings: StaticFinding[] = []
  for (const f of files) {
    const lines = f.text.split('\n')
    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!rule.re.test(line)) continue
        // One finding per rule per file is enough to act on; the line numbers
        // are what make it checkable.
        findings.push({
          id: rule.id, severity: rule.severity, title: rule.title, why: rule.why,
          file: f.path, line: i + 1, evidence: line.trim().slice(0, 200),
        })
        break
      }
    }
  }
  const weight = { high: 34, medium: 14, low: 5 }
  const score = Math.min(100, findings.reduce((n, f) => n + weight[f.severity], 0))
  const severity = score >= 67 ? 'HIGH' : score >= 34 ? 'MEDIUM' : score > 0 ? 'LOW' : 'NONE'
  const recommendation = score > 50 ? 'DO_NOT_INSTALL' : score > 0 ? 'CAUTION' : 'SAFE'
  return { score, severity, recommendation, findings }
}

/* ----------------------------------------------------------------- routes - */

skillsRoutes.get('/scanner', async (c) => c.json(await scannerInfo()))

/**
 * POST /api/skills/trojan
 *
 * body: { files: [{ path, text }], kind?: 'auto' | 'document' | 'stylesheet' }
 *
 * The Trojan Horse pass: text a person cannot see, and sentences that order a
 * model what to do. It runs before anything is handed to a model, because the
 * one thing a scan cannot undo is a model having already read the file.
 *
 * Deliberately separate from `/scan`. That route answers "should this skill be
 * installed" and is a security review of code; this one answers "is this text
 * safe to put in a context window", which is a different question with a
 * different verdict vocabulary. Kept apart so neither can be mistaken for the
 * other, and so a `DO_NOT_TRUST` here is never softened by a `SAFE` there.
 *
 * No network, no model, no file ever leaves the machine.
 */
skillsRoutes.post('/trojan', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const files: SkillFile[] = Array.isArray(body?.files)
    ? body.files.slice(0, MAX_FILES)
      .map((f: any) => ({ path: String(f?.path ?? 'file.md').slice(0, 200), text: String(f?.text ?? '').slice(0, MAX_FILE_BYTES) }))
      .filter((f: SkillFile) => f.text)
    : []
  if (!files.length) return c.json({ error: 'Nothing to scan — give at least one file.' }, 400)
  const total = files.reduce((n, f) => n + f.text.length, 0)
  if (total > MAX_TOTAL_BYTES) return c.json({ error: 'That is larger than this scanner accepts (4 MB of text).' }, 400)

  const kind = body?.kind === 'stylesheet' || body?.kind === 'document' ? body.kind : 'auto'
  const reports = files.map((f) => ({ path: f.path, report: scanForTrojan(f.text, kind) }))

  // The worst verdict across the set wins: one hidden order in ten files makes
  // the whole batch untrusted, because the batch is what a model would read.
  const level: TrojanReport['level'] = reports.some((r) => r.report.level === 'do-not-trust')
    ? 'do-not-trust'
    : reports.some((r) => r.report.level === 'review')
      ? 'review'
      : 'clean'

  const hiddenOrders = reports.reduce((n, r) => n + r.report.counts.hiddenOrders, 0)
  const orders = reports.reduce((n, r) => n + r.report.counts.orders, 0)
  const invisible = reports.reduce((n, r) => n + r.report.counts.invisible, 0)

  const verdict = level === 'do-not-trust'
    ? `${hiddenOrders} hidden instruction${hiddenOrders === 1 ? '' : 's'} aimed at a model across ${reports.length} file${reports.length === 1 ? '' : 's'}. Do not let a model read ${reports.length === 1 ? 'it' : 'them'} until a person has read the same lines.`
    : level === 'review'
      ? `${orders} instruction${orders === 1 ? '' : 's'} aimed at a model and ${invisible} line${invisible === 1 ? '' : 's'} of hidden text, all in plain sight. Read them before a model does.`
      : 'No hidden text and no instructions aimed at a model. Nothing to act on.'

  return c.json({
    scanner: 'trojan-detector',
    scannerNote: 'Local scan by this app: invisible text, orders aimed at a model, and the red lines where the two overlap. Nothing was uploaded.',
    level,
    verdict,
    counts: { invisible, orders, hiddenOrders },
    files: reports,
  })
})

/**
 * POST /api/skills/scan
 *
 * body: { name, files: [{ path, text }] }
 *
 * Writes the skill to a scratch folder under the data directory (never inside
 * the app), runs SkillSpector against it when it exists, and returns both the
 * tool's verdict and this app's own static pass. The folder is removed either
 * way; a skill is data the user is about to install, not something we keep
 * lying around.
 */
skillsRoutes.post('/scan', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const files: SkillFile[] = Array.isArray(body?.files)
    ? body.files.slice(0, MAX_FILES)
      .map((f: any) => ({ path: String(f?.path ?? 'SKILL.md').slice(0, 200), text: String(f?.text ?? '').slice(0, MAX_FILE_BYTES) }))
      .filter((f: SkillFile) => f.text)
    : []
  if (!files.length) return c.json({ error: 'Nothing to scan — give the skill at least one file.' }, 400)
  const total = files.reduce((n, f) => n + f.text.length, 0)
  if (total > MAX_TOTAL_BYTES) return c.json({ error: 'That skill is larger than this scanner accepts (4 MB of text).' }, 400)

  const local = staticScan(files)
  const info = await scannerInfo()
  if (!info.available) {
    return c.json({
      scanner: 'local-static',
      scannerNote: `${info.detail}. This is this app's own static pass, not NVIDIA's SkillSpector — install it to get the full scan.`,
      install: info.install,
      verdict: local,
      files: files.map((f) => f.path),
    })
  }

  const dir = join(process.env.RE_DATA_DIR || join(process.cwd(), '.data'), 'skill-scans', randomUUID())
  mkdirSync(dir, { recursive: true })
  try {
    for (const f of files) {
      // Paths are relative and flat-ish: a skill never writes outside its own
      // scratch folder, and a traversal attempt is refused rather than escaped.
      const rel = f.path.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..').join('/')
      if (!rel) continue
      const target = join(dir, rel)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, f.text)
    }

    const argv = info.how === 'docker'
      ? ['docker', 'run', '--rm', '-v', `${dir}:/scan`, 'skillspector', 'scan', '/scan', '--format', 'json', '--no-llm']
      : [process.env.SKILLSPECTOR_BIN || 'skillspector', 'scan', dir, '--format', 'json', '--no-llm']

    const out = await run(argv, undefined, TIMEOUT_MS)
    // Exit 0 and 1 both mean "the scan completed" (0 = SAFE/CAUTION, 1 = bad
    // enough to fail a CI gate). 2 is a real error.
    if (out.code === 2 || (out.code !== 0 && out.code !== 1)) {
      return c.json({
        scanner: 'local-static',
        scannerNote: `SkillSpector exited ${out.code}: ${(out.stderr || out.stdout).trim().slice(0, 300) || 'no output'}`,
        install: info.install,
        verdict: local,
        files: files.map((f) => f.path),
      })
    }
    const json = extractJson(out.stdout) ?? extractJson(out.stderr)
    if (!json) {
      return c.json({
        scanner: 'local-static',
        scannerNote: 'SkillSpector ran but its report could not be read; the local pass is shown instead.',
        install: info.install,
        verdict: local,
        files: files.map((f) => f.path),
      })
    }
    const verdict = {
      score: Number(json.risk_score ?? json.score ?? local.score),
      severity: String(json.severity ?? local.severity),
      recommendation: String(json.recommendation ?? json.verdict ?? local.recommendation),
      safeToInstall: json.safe_to_install !== undefined ? !!json.safe_to_install : (Number(json.risk_score ?? 100) <= 50),
      findings: Array.isArray(json.findings) ? json.findings.slice(0, 200) : [],
      llmUsed: !!(json.llm_used ?? json?.metadata?.llm_used),
    }
    return c.json({ scanner: 'skillspector', scannerNote: 'Scanned by NVIDIA SkillSpector (static pass, no model, nothing uploaded).', verdict, local, files: files.map((f) => f.path) })
  } catch (e: any) {
    return c.json({
      scanner: 'local-static',
      scannerNote: `SkillSpector could not be run (${String(e?.message ?? e).slice(0, 200)}); the local pass is shown instead.`,
      install: info.install,
      verdict: local,
      files: files.map((f) => f.path),
    })
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
})

/** The JSON report, even when the CLI prints progress lines around it. */
function extractJson(text: string): any | null {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

/**
 * POST /api/skills/import
 *
 * The skill as the user brought it, recorded locally. Kept in the same
 * database as everything else so the scan verdict travels with it: an imported
 * skill always has a report attached, even if that report is "our static pass
 * only".
 */
skillsRoutes.post('/import', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return c.json({ error: 'The skill needs a name.' }, 400)
  const record = {
    id: String(body?.id ?? `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    kind: 'skill',
    title: name.slice(0, 200),
    snippet: String(body?.description ?? '').slice(0, 4000),
    tags: Array.isArray(body?.tags) ? body.tags.slice(0, 12) : ['skill'],
    savedAt: Date.now(),
    extra: { source: body?.source ?? 'imported', files: Number(body?.files) || 0, security: body?.security ?? null },
  }
  db.insertLibraryItem(record)
  return c.json({ ok: true, record })
})
