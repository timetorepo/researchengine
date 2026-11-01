/**
 * Tools for the harness, each one a plugin that registers with the `tools`
 * service. A tool never sees more than the environment it is handed for one
 * call: the workspace it may touch, whether shell is approved, and the access
 * policy the user has set. Output is clipped before it returns to the model.
 *
 * Safety:
 *  - `bash` runs only when the session was approved for shell, and only through
 *    the same access check the IDE uses (services/agent-access). It runs inside
 *    the workspace, with a timeout.
 *  - The editor and file tools resolve every path, follow symlinks, and refuse
 *    anything that lands outside the workspace.
 */
import { spawn } from 'node:child_process'
import { readFile, writeFile, readdir, realpath, stat, mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep, isAbsolute } from 'node:path'
import { definePlugin } from './kernel'
import type { AgentAccess } from '../services/agent-access'
import { checkCommand } from '../services/agent-access'

export const TOOL_OUTPUT_MAX = 12_000

export interface ToolEnv {
  /** Absolute workspace folder, or null when the session has none. */
  workspace: string | null
  /** The user's shell approval for this session. Off unless the user turned it on. */
  approve: boolean
  /** The user's agent-access policy (project / selected folders / full). */
  access: AgentAccess
  /** Aborts a running tool when the user stops the turn. */
  signal?: AbortSignal
}

export interface ToolSpec {
  name: string
  description: string
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>
  run(args: Record<string, unknown>, env: ToolEnv): Promise<string>
}

export interface ToolRegistry {
  register(spec: ToolSpec): void
  list(): ToolSpec[]
  get(name: string): ToolSpec | undefined
  /** Run a tool. Never throws: failures come back as text the model can read. */
  call(name: string, args: Record<string, unknown>, env: ToolEnv): Promise<string>
}

/** Clip long output, keeping the start and the end, where errors usually are. */
export function clipOutput(text: string, max = TOOL_OUTPUT_MAX): string {
  if (text.length <= max) return text
  const head = Math.floor(max * 0.7)
  const tail = max - head
  return `${text.slice(0, head)}\n…[${text.length - max} characters left out]…\n${text.slice(-tail)}`
}

/** A workspace-relative path, resolved and checked. Returns null when it escapes the workspace. */
export async function insideWorkspace(workspace: string, rel: string, mustExist = true): Promise<string | null> {
  if (!rel || isAbsolute(rel) || rel.includes('\0')) return null
  const root = await realpath(workspace)
  const target = resolve(root, rel)
  if (target === root) return null
  let real: string
  try {
    // Symlinks are followed, so a link pointing outside the workspace is refused.
    real = await realpath(target)
  } catch {
    if (mustExist) return null
    // A file that does not exist yet (and maybe its folders): check the nearest
    // folder that does exist. The rest is plain names, so it cannot be a symlink.
    let ancestor = dirname(target)
    while (ancestor !== dirname(ancestor) && !(await realpath(ancestor).then(() => true, () => false))) {
      ancestor = dirname(ancestor)
    }
    const base = await realpath(ancestor).catch(() => null)
    if (!base) return null
    real = join(base, relative(ancestor, target))
  }
  return real.startsWith(root + sep) ? real : null
}

function registryPlugin() {
  return definePlugin({
    name: 'tools-registry',
    apply(ctx) {
      const specs = new Map<string, ToolSpec>()
      const registry: ToolRegistry = {
        register(spec) {
          if (specs.has(spec.name)) throw new Error(`tool "${spec.name}" is already registered`)
          specs.set(spec.name, spec)
        },
        list: () => [...specs.values()],
        get: (name) => specs.get(name),
        async call(name, args, env) {
          const spec = specs.get(name)
          if (!spec) return `Error: there is no tool named "${name}".`
          try {
            return clipOutput(await spec.run(args ?? {}, env))
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        },
      }
      ctx.provide('tools', registry)
      // Tool plugins register through the service, so the registry must be
      // in place before they mount: they inject 'tools' for that reason.
      return () => specs.clear()
    },
  })
}

function bashTool() {
  return definePlugin({
    name: 'tool:bash',
    inject: ['tools'],
    apply(ctx) {
      const tools = ctx.get<ToolRegistry>('tools')!
      tools.register({
        name: 'bash',
        description: 'Run a shell command in the workspace. Needs the user to have approved shell for this session. Returns the exit code and output.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to run.' },
            timeoutSec: { type: 'number', description: 'Seconds before it is stopped (default 30, max 120).' },
          },
          required: ['command'],
        },
        async run(args, env) {
          if (!env.approve) return 'Shell is off for this session. Ask the user to allow shell before running commands.'
          if (!env.workspace) return 'This session has no workspace folder, so there is nowhere to run a command.'
          const command = String(args.command ?? '').trim()
          if (!command) return 'Error: the command is empty.'
          const verdict = checkCommand(command, env.access, env.workspace)
          if (!verdict.allowed) return `Refused: ${verdict.reason}`
          const timeoutSec = Math.min(120, Math.max(1, Number(args.timeoutSec) || 30))
          return runShell(command, env.workspace, timeoutSec, env.signal)
        },
      })
    },
  })
}

/** Run one command with a timeout and an abort signal. Resolves with the exit code and output. */
export function runShell(command: string, cwd: string, timeoutSec: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolveRun) => {
    const child = spawn('bash', ['-lc', command], { cwd, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } })
    let out = ''
    const add = (chunk: Buffer) => { if (out.length < TOOL_OUTPUT_MAX * 2) out += chunk.toString('utf8') }
    child.stdout.on('data', add)
    child.stderr.on('data', add)
    const kill = () => { try { child.kill('SIGKILL') } catch { /* already gone */ } }
    const timer = setTimeout(() => { kill(); resolveRun(`${out}\n[stopped: timed out after ${timeoutSec}s]`) }, timeoutSec * 1000)
    signal?.addEventListener('abort', kill, { once: true })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolveRun(`exit ${code ?? 'signal'}\n${out}`.trimEnd())
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolveRun(`Error: could not start the shell (${err.message}).`)
    })
  })
}

function editorTool() {
  return definePlugin({
    name: 'tool:editor',
    inject: ['tools'],
    apply(ctx) {
      const tools = ctx.get<ToolRegistry>('tools')!
      tools.register({
        name: 'str_replace_editor',
        description: 'View, create, or edit one file in the workspace. Commands: view (optional start/end lines), create (new file with text), str_replace (replace one exact, unique occurrence of old with new).',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', enum: ['view', 'create', 'str_replace'] },
            path: { type: 'string', description: 'Path relative to the workspace.' },
            old: { type: 'string' },
            new: { type: 'string' },
            text: { type: 'string' },
            start: { type: 'number' },
            end: { type: 'number' },
          },
          required: ['command', 'path'],
        },
        async run(args, env) {
          if (!env.workspace) return 'This session has no workspace folder.'
          const rel = String(args.path ?? '')
          const command = String(args.command ?? '')
          if (command === 'create') {
            const target = await insideWorkspace(env.workspace, rel, false)
            if (!target) return `Refused: "${rel}" is outside the workspace.`
            await mkdir(dirname(target), { recursive: true })
            await writeFile(target, String(args.text ?? ''), 'utf8')
            return `Created ${rel}.`
          }
          const real = await insideWorkspace(env.workspace, rel, true)
          if (!real) return `Refused: "${rel}" is outside the workspace or does not exist.`
          const info = await stat(real)
          if (!info.isFile()) return `Error: ${rel} is not a file.`
          if (info.size > 1_000_000) return 'Error: the file is larger than 1 MB.'
          const body = await readFile(real, 'utf8')
          if (command === 'view') {
            const lines = body.split('\n')
            const start = Math.max(1, Number(args.start) || 1)
            const end = Math.min(lines.length, Number(args.end) || lines.length)
            return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n')
          }
          if (command === 'str_replace') {
            const old = String(args.old ?? '')
            if (!old) return 'Error: "old" is empty.'
            const count = body.split(old).length - 1
            if (count !== 1) return `Error: "old" must match exactly once; it matched ${count} times.`
            await writeFile(real, body.replace(old, () => String(args.new ?? '')), 'utf8')
            return `Edited ${rel}.`
          }
          return `Error: unknown command "${command}".`
        },
      })
    },
  })
}

function filesTool() {
  return definePlugin({
    name: 'tool:files',
    inject: ['tools'],
    apply(ctx) {
      const tools = ctx.get<ToolRegistry>('tools')!
      tools.register({
        name: 'list_files',
        description: 'List files and folders in a workspace folder (two levels deep at most).',
        parameters: { type: 'object', properties: { path: { type: 'string', description: 'Folder, relative to the workspace. Default is the root.' } } },
        async run(args, env) {
          if (!env.workspace) return 'This session has no workspace folder.'
          const rel = String(args.path ?? '.') || '.'
          const dir = rel === '.' ? await realpath(env.workspace) : await insideWorkspace(env.workspace, rel, true)
          if (!dir) return `Refused: "${rel}" is outside the workspace.`
          const names: string[] = []
          for (const e of await readdir(dir, { withFileTypes: true })) {
            if (e.name.startsWith('.git') || e.name === 'node_modules') continue
            names.push(e.isDirectory() ? `${e.name}/` : e.name)
            if (names.length >= 300) break
          }
          return names.sort().join('\n') || '(empty)'
        },
      })
      tools.register({
        name: 'read_file',
        description: 'Read one text file in the workspace (up to 200 lines per call).',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, start: { type: 'number' } },
          required: ['path'],
        },
        async run(args, env) {
          if (!env.workspace) return 'This session has no workspace folder.'
          const real = await insideWorkspace(env.workspace, String(args.path ?? ''), true)
          if (!real) return 'Refused: the file is outside the workspace or does not exist.'
          const lines = (await readFile(real, 'utf8')).split('\n')
          const start = Math.max(1, Number(args.start) || 1)
          return lines.slice(start - 1, start - 1 + 200).map((l, i) => `${start + i}: ${l}`).join('\n')
        },
      })
    },
  })
}

/** Tool plugins by name. A profile picks which of these to mount. */
export const TOOL_PLUGINS = {
  registry: registryPlugin,
  bash: bashTool,
  editor: editorTool,
  files: filesTool,
} as const

export { registryPlugin, bashTool, editorTool, filesTool }
