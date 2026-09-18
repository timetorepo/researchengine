// AI tool calls. The model gets a real tool surface: questionnaires, the
// local connectors (Drive / Mail / Calendar / Files), web search, and —
// inside Coding mode — project files and a guarded command runner.
// Tool results feed straight back into the conversation loop in runChat.
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

export interface ToolCall { id: string; name: string; arguments: Record<string, unknown> | string }

export interface ToolContext {
  chatId: string
  asstId: string
  /** Coding-mode project name; enables the ide_* tools. */
  project?: string
  /** IDE files summary injected so the model knows what it can touch. */
  projectTree?: string
}

interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  needsProject?: boolean
  run: (args: any, ctx: ToolContext) => Promise<string>
}

// ---------- user-facing pause points ----------
// Both the questionnaire and command approval suspend the tool until the
// human in the loop responds. Promises live in module-level maps keyed by
// tool-call id; the UI resolves them.
const questionnaireWaits = new Map<string, (answers: Record<string, string>) => void>()
const execWaits = new Map<string, (approved: boolean) => void>()

export function submitQuestionnaire(chatId: string, msgId: string, toolCallId: string, answers: Record<string, string>) {
  const store = useStore.getState()
  const chat = store.chats.find((c) => c.id === chatId)
  const msg = chat?.messages.find((m) => m.id === msgId)
  if (msg?.questionnaire) {
    store.updateMessage(chatId, msgId, { questionnaire: { ...msg.questionnaire, answers, submitted: true } })
  }
  questionnaireWaits.get(toolCallId)?.(answers)
  questionnaireWaits.delete(toolCallId)
}

export function resolveExec(chatId: string, msgId: string, toolCallId: string, approved: boolean) {
  useStore.getState().updateMessage(chatId, msgId, { pendingExec: undefined })
  execWaits.get(toolCallId)?.(approved)
  execWaits.delete(toolCallId)
}

const asText = async (res: Response): Promise<string> => {
  const ct = res.headers.get('content-type') ?? ''
  const body = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
  return body.slice(0, 12_000)
}

// ---------- tool registry ----------
const STR = { type: 'string' } as const
const opt = (type: string, description: string) => ({ type, description })

export const TOOLS: ToolDef[] = [
  {
    name: 'ask_user',
    description: 'Present a short questionnaire to the user when you need their preferences, constraints or decisions before proceeding (for example: what to fix or refine in a project, how deep to research, which angle to take). Questions come from YOU based on the conversation — generate 2-5 focused questions. Options are optional; allowText lets them write freely.',
    parameters: {
      type: 'object',
      properties: {
        title: opt('string', 'Short title for the questionnaire'),
        intro: opt('string', 'One-sentence explanation of why you are asking'),
        questions: {
          type: 'array',
          description: '2-5 questions',
          items: {
            type: 'object',
            properties: {
              question: STR,
              options: { type: 'array', items: STR, description: 'Optional suggested answers' },
              allowText: { type: 'boolean', description: 'Allow a free-text answer' },
            },
            required: ['question'],
          },
        },
      },
      required: ['questions'],
    },
    run: async (args, ctx) => {
      const items: { id: string; question: string; options?: string[]; allowText: boolean }[] = (Array.isArray(args?.questions) ? args.questions : []).slice(0, 5).map((q: any) => ({
        id: nanoid(6),
        question: String(q?.question ?? ''),
        options: Array.isArray(q?.options) ? q.options.map(String).slice(0, 6) : undefined,
        allowText: !!q?.allowText || !Array.isArray(q?.options) || q.options.length === 0,
      }))
      if (!items.length) return 'No questions were provided.'
      const toolCallId = (ctx as any).__toolCallId as string
      useStore.getState().updateMessage(ctx.chatId, ctx.asstId, {
        questionnaire: { title: args?.title ? String(args.title) : undefined, intro: args?.intro ? String(args.intro) : undefined, items, toolCallId },
      })
      return await new Promise<string>((resolve) => {
        questionnaireWaits.set(toolCallId, (answers) => {
          resolve('The user answered the questionnaire:\n' + items.map((it) => `Q: ${it.question}\nA: ${answers[it.id] ?? '(skipped)'}`).join('\n'))
        })
      })
    },
  },
  {
    name: 'connector_search',
    description: 'Search the user\'s connected local data: Google Drive files, Mail messages and Calendar events (all stored locally in Research Engine). Returns matching items with ids you can open via connector_read.',
    parameters: {
      type: 'object',
      properties: {
        box: opt('string', 'drive | mail | calendar — omit to search all'),
        query: opt('string', 'Search text'),
      },
      required: ['query'],
    },
    run: async (args) => {
      const box = ['drive', 'mail', 'calendar'].includes(args?.box) ? `&box=${args.box}` : ''
      const res = await fetch(`/api/connectors/search?q=${encodeURIComponent(String(args?.query ?? ''))}${box}`)
      return await asText(res)
    },
  },
  {
    name: 'connector_read',
    description: 'Read one full item from a connector (a Drive file\'s text, a full mail message, or a calendar event) by id from connector_search results.',
    parameters: {
      type: 'object',
      properties: { box: STR, id: STR },
      required: ['box', 'id'],
    },
    run: async (args) => {
      const res = await fetch(`/api/connectors/item?box=${encodeURIComponent(String(args?.box ?? ''))}&id=${encodeURIComponent(String(args?.id ?? ''))}`)
      return await asText(res)
    },
  },
  {
    name: 'list_local_files',
    description: 'List the files in the user\'s Research Engine local files folder.',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const res = await fetch('/api/fs/list')
      return await asText(res)
    },
  },
  {
    name: 'read_local_file',
    description: 'Read a text file from the user\'s local files folder by name.',
    parameters: { type: 'object', properties: { path: STR }, required: ['path'] },
    run: async (args) => {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(String(args?.path ?? ''))}`)
      return (await asText(res)).slice(0, 12_000)
    },
  },
  {
    name: 'web_search',
    description: 'Run a live web search and get sources with snippets. Use when the user asks for up-to-date or external information.',
    parameters: { type: 'object', properties: { query: STR }, required: ['query'] },
    run: async (args) => {
      // Privacy Shield is enforced inside webSearch (offline-first in Top Secret).
      const { webSearch } = await import('@/lib/search/web')
      const outcome = await webSearch(String(args?.query ?? ''), 5)
      return JSON.stringify({ live: outcome.live, sources: outcome.sources.map((s) => ({ title: s.title, url: s.url, snippet: s.snippet })) }).slice(0, 8000)
    },
  },
  // ---------- Coding-mode tools (enabled when ctx.project is set) ----------
  {
    name: 'ide_list_files',
    description: 'List the file tree of the currently open project.',
    parameters: { type: 'object', properties: {} },
    needsProject: true,
    run: async (_args, ctx) => {
      const res = await fetch(`/api/ide/tree?project=${encodeURIComponent(ctx.project!)}`)
      return await asText(res)
    },
  },
  {
    name: 'ide_read_file',
    description: 'Read a file from the open project (path relative to the project root).',
    parameters: { type: 'object', properties: { path: STR }, required: ['path'] },
    needsProject: true,
    run: async (args, ctx) => {
      const res = await fetch(`/api/ide/file?project=${encodeURIComponent(ctx.project!)}&path=${encodeURIComponent(String(args?.path ?? ''))}`)
      return await asText(res)
    },
  },
  {
    name: 'ide_write_file',
    description: 'Create or overwrite a file in the open project with the given content. Use for code edits the user asked for. Path is relative to the project root.',
    parameters: {
      type: 'object',
      properties: { path: STR, content: opt('string', 'Full new file content') },
      required: ['path', 'content'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      const res = await fetch('/api/ide/file', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: ctx.project, path: String(args?.path ?? ''), content: String(args?.content ?? '') }),
      })
      const out = await asText(res)
      window.dispatchEvent(new CustomEvent('re:ide-changed', { detail: { project: ctx.project } }))
      return out
    },
  },
  {
    name: 'ide_run_command',
    description: 'Run a shell command inside the open project directory. The user is ALWAYS asked to approve before it runs. Use for builds, tests, installs, git. Never run destructive commands.',
    parameters: {
      type: 'object',
      properties: { command: opt('string', 'The exact shell command to run'), reason: opt('string', 'Why this command is needed') },
      required: ['command'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      const toolCallId = (ctx as any).__toolCallId as string
      const command = String(args?.command ?? '')
      // First call: server tells us if it needs explicit confirmation (it will,
      // for anything mutating) — then we ask the human.
      let res = await fetch('/api/ide/exec', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: ctx.project, command }),
      })
      let out: any = await res.json()
      if (out.blocked) return `BLOCKED by safety rules: ${out.reason}`
      if (out.requiresConfirm) {
        useStore.getState().updateMessage(ctx.chatId, ctx.asstId, { pendingExec: { toolCallId, command, reason: String(args?.reason ?? out.reason ?? '') } })
        const approved = await new Promise<boolean>((resolve) => { execWaits.set(toolCallId, resolve) })
        if (!approved) return 'The user declined to run this command. Ask how they want to proceed instead.'
        res = await fetch('/api/ide/exec', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project: ctx.project, command, confirmed: true }),
        })
        out = await res.json()
      }
      return JSON.stringify({ exit: out.exit, timedOut: out.timedOut, stdout: (out.stdout ?? '').slice(0, 6000), stderr: (out.stderr ?? '').slice(0, 2000) })
    },
  },
  {
    name: 'ide_git',
    description: 'Run a read-only git operation on the open project: status | log | diff | branches | remote.',
    parameters: {
      type: 'object',
      properties: { op: opt('string', 'status | log | diff | branches | remote') },
      required: ['op'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      const res = await fetch(`/api/ide/git?project=${encodeURIComponent(ctx.project!)}&op=${encodeURIComponent(String(args?.op ?? 'status'))}`)
      return await asText(res)
    },
  },
  {
    name: 'mcp_call',
    description: 'Call a tool on a configured MCP (Model Context Protocol) server. The available servers and their tools are listed in your system context.',
    parameters: {
      type: 'object',
      properties: {
        serverId: opt('string', 'MCP server id from the system context'),
        tool: opt('string', 'Tool name on that server'),
        arguments: { type: 'object', description: 'Tool arguments' },
      },
      required: ['serverId', 'tool'],
    },
    run: async (args) => {
      const settings = useStore.getState().settings
      const server = settings.mcpServers.find((s) => s.id === args?.serverId && s.enabled)
      if (!server) return 'Unknown or disabled MCP server.'
      const res = await fetch('/api/mcp/call', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ server: { id: server.id, name: server.name, command: server.command, args: server.args, env: server.env }, name: String(args?.tool ?? ''), arguments: (args?.arguments as any) ?? {} }),
      })
      const out = await res.json()
      return out.text ?? 'No result.'
    },
  },
]

/** OpenAI-style tool specs for the provider payload. */
export function toolSpecs(ctx: ToolContext): { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }[] {
  return TOOLS
    .filter((t) => !t.needsProject || !!ctx.project)
    .map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
}

/** Execute one tool call; returns the text result to feed back to the model. */
export async function executeTool(call: ToolCall, ctx: ToolContext, trace: (label: string, status: 'ok' | 'error' | 'blocked' | 'confirm') => void): Promise<string> {
  const def = TOOLS.find((t) => t.name === call.name)
  if (!def) return `Unknown tool: ${call.name}`
  if (def.needsProject && !ctx.project) return 'This tool needs an open project in Coding mode.'
  let args: any = call.arguments
  if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = { input: args } } }
  args = args ?? {}
  const fullCtx = { ...ctx, __toolCallId: call.id } as any
  try {
    if (def.name === 'ide_run_command') trace(`run: ${String(args.command ?? '').slice(0, 60)}`, 'confirm')
    else if (def.name === 'ask_user') trace('asking you a few questions', 'ok')
    else if (def.name.startsWith('connector')) trace(`${def.name === 'connector_search' ? 'search' : 'read'} ${String(args.box ?? args.query ?? '')}`.slice(0, 60), 'ok')
    else if (def.name === 'web_search') trace(`web search: ${String(args.query ?? '').slice(0, 50)}`, 'ok')
    else if (def.name === 'mcp_call') trace(`MCP ${String(args.serverId ?? '')}:${String(args.tool ?? '')}`.slice(0, 60), 'ok')
    else trace(def.name, 'ok')
    const result = await def.run(args, fullCtx)
    const blocked = /^BLOCKED/.test(result)
    if (def.name === 'ide_run_command') trace(`ran: ${String(args.command ?? '').slice(0, 60)}`, blocked ? 'blocked' : 'ok')
    return result
  } catch (e: any) {
    trace(def.name, 'error')
    return `Tool ${def.name} failed: ${String(e?.message ?? e)}`
  }
}

/** MCP servers + tools rendered into the system prompt so the model knows what it can call. */
export function mcpContextBlock(): string {
  const servers = useStore.getState().settings.mcpServers.filter((s) => s.enabled)
  if (!servers.length) return ''
  return `\n\nMCP servers configured by the user (call them with the mcp_call tool):\n${servers.map((s) => `- ${s.name} (serverId: ${s.id}) — command: ${s.command}`).join('\n')}`
}
