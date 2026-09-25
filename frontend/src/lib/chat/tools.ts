// AI tool calls. The model gets a real tool surface: questionnaires, the
// local connectors (Drive / Mail / Calendar / Files), web search, and —
// inside Coding mode — project files and a guarded command runner.
// Tool results feed straight back into the conversation loop in runChat.
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { designSession, captureStore, formatSnapshot, formatFindings, formatControls } from '@/lib/ide/bridge'
import { ensurePreviewServer, previewStatus, stopPreview } from '@/lib/ide/preview'
import { runUiTest } from '@/lib/ide/tests'

export interface ToolCall { id: string; name: string; arguments: Record<string, unknown> | string }

export interface ToolContext {
  chatId: string
  asstId: string
  /** Coding-mode project name; enables the ide_* tools. */
  project?: string
  /** IDE files summary injected so the model knows what it can touch. */
  projectTree?: string
  /**
   * Parallel agent id. When set, every file and command tool works inside that
   * agent's private copy of the project instead of the shared folder, which is
   * what keeps two agents running at once from writing the same file.
   */
  agent?: string
}

/** The scope suffix every IDE call carries: `&agent=<id>` or nothing. */
const scope = (ctx: ToolContext) => (ctx.agent ? `&agent=${encodeURIComponent(ctx.agent)}` : '')

/**
 * Live activity, for the "what is the AI doing right now" timeline. Every IDE
 * tool call emits one of these; the Coding surface turns them into the cards
 * beside the editor (read → edit → run), and the agents store keeps them per
 * task so a background agent still has a story when you come back to it.
 */
export interface IdeActivity {
  /** Stable id for lists that animate entries (assigned by the consumer). */
  id?: string
  agent?: string | null
  project?: string | null
  kind: 'read' | 'list' | 'write' | 'run' | 'search' | 'error'
  path?: string
  /** Optional 1-based line to jump to when the path is opened. */
  line?: number
  command?: string
  added?: number
  removed?: number
  created?: boolean
  bytes?: number
  note?: string
  at: number
}

function emitActivity(a: Omit<IdeActivity, 'at'>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('re:agent-activity', { detail: { ...a, at: Date.now() } }))
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

/**
 * Design tools all start here: make sure the project has a running preview and
 * that the bridge is answering before a command is sent. Opening the preview
 * pane is delegated to the workbench (it owns the iframe).
 */
async function readyForDesign(ctx: ToolContext): Promise<void> {
  if (!ctx.project) throw new Error('Design tools need an open project in Coding mode.')
  await designSession.ensurePreview(ctx.project)
  await designSession.ping()
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
      const res = await fetch(`/api/ide/tree?project=${encodeURIComponent(ctx.project!)}${scope(ctx)}`)
      const out = await asText(res)
      try {
        const n = (JSON.parse(out) as any).tree?.length ?? 0
        emitActivity({ agent: ctx.agent ?? null, project: ctx.project, kind: 'list', note: `listed ${n} top-level entries` })
      } catch { /* not JSON: nothing to report */ }
      return out
    },
  },
  {
    name: 'ide_read_file',
    description: 'Read a file from the open project (path relative to the project root).',
    parameters: { type: 'object', properties: { path: STR }, required: ['path'] },
    needsProject: true,
    run: async (args, ctx) => {
      const path = String(args?.path ?? '')
      const res = await fetch(`/api/ide/file?project=${encodeURIComponent(ctx.project!)}&path=${encodeURIComponent(path)}${scope(ctx)}`)
      const out = await asText(res)
      emitActivity({ agent: ctx.agent ?? null, project: ctx.project, kind: 'read', path, bytes: out.length, note: 'read' })
      return out
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
      const path = String(args?.path ?? '')
      const content = String(args?.content ?? '')
      const res = await fetch('/api/ide/file', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: ctx.project, path, content, agent: ctx.agent }),
      })
      const out = await asText(res)
      let added = 0, removed = 0, created = false
      try { const j = JSON.parse(out) as any; added = j.added ?? 0; removed = j.removed ?? 0; created = !!j.created } catch { added = content.split('\n').length }
      emitActivity({ agent: ctx.agent ?? null, project: ctx.project, kind: 'write', path, added, removed, created, bytes: content.length })
      window.dispatchEvent(new CustomEvent('re:ide-changed', { detail: { project: ctx.project, agent: ctx.agent } }))
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
        body: JSON.stringify({ project: ctx.project, command, agent: ctx.agent }),
      })
      let out: any = await res.json()
      if (out.blocked) return `BLOCKED by safety rules: ${out.reason}`
      if (out.requiresConfirm) {
        useStore.getState().updateMessage(ctx.chatId, ctx.asstId, { pendingExec: { toolCallId, command, reason: String(args?.reason ?? out.reason ?? '') } })
        const approved = await new Promise<boolean>((resolve) => { execWaits.set(toolCallId, resolve) })
        if (!approved) return 'The user declined to run this command. Ask how they want to proceed instead.'
        res = await fetch('/api/ide/exec', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project: ctx.project, command, confirmed: true, agent: ctx.agent }),
        })
        out = await res.json()
      }
      emitActivity({ agent: ctx.agent ?? null, project: ctx.project, kind: 'run', command, note: `exit ${out.exit ?? '?'}` })
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
  /* ---------- Design mode: the AI's eyes and hands on the running app ----------
   * Every tool below drives the *live preview* of the project through the
   * Design-Mode bridge (postMessage). They only work while the preview pane is
   * on screen; the UI is asked to open it automatically when needed.          */
  {
    name: 'design_preview',
    description: 'Control the live preview of the project (the dev server the IDE runs). action=start launches it if needed and waits until the app answers; restart reloads after you changed files; status reports the port, URL and last log lines; stop shuts it down. Call this first if a design tool reports the preview is offline, or after edits that need a rebuild.',
    parameters: {
      type: 'object',
      properties: { action: opt('string', 'start | restart | status | stop') },
      required: ['action'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      const action = String(args?.action ?? 'status')
      const project = ctx.project!
      if (action === 'status') {
        const s = await previewStatus(project)
        return JSON.stringify({ running: s.running, ready: s.ready, port: s.port, kind: s.kind, command: s.command, error: s.error, logs: (s.logs ?? []).slice(-12) })
      }
      if (action === 'stop') { await stopPreview(project); return 'Preview stopped.' }
      const info = await ensurePreviewServer(project, action === 'restart')
      if (info.error) return `The preview did not start: ${info.error}\nLog:\n${(info.logs ?? []).slice(-15).join('\n')}`
      await designSession.ensurePreview(project)
      try { await designSession.ping() } catch (e: any) { return `The preview server is running on port ${info.port} (${info.kind}) but the bridge did not answer: ${e?.message ?? e}` }
      return `Preview is live — kind=${info.kind}, port=${info.port}, url=${info.url}. The bridge is connected; you can now snapshot, inspect and click.`
    },
  },
  {
    name: 'design_snapshot',
    description: 'PRIMARY WAY TO SEE THE SCREEN. Returns a structured read of the page currently rendered in the live preview: viewport, headings, every important element with its selector, box rectangle, font size, colours and layout/a11y flags, plus recent console output and failed requests. Use it before and after every UI change.',
    parameters: {
      type: 'object',
      properties: { maxElements: { type: 'number', description: 'Cap on listed elements (default 70)' } },
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const snap = await designSession.call('snapshot', { maxNodes: Math.min(Number(args?.maxElements ?? 70), 200) }, 15_000)
      return formatSnapshot(snap, Math.min(Number(args?.maxElements ?? 70), 200))
    },
  },
  {
    name: 'design_screenshot',
    description: 'Capture a real picture of the screen (rendered in-page, no browser needed) and show it to the user in the Design panel. Returns the pixel size. Use it when the layout matters visually, or when you want the user to see what you are looking at. Screenshots are also kept in the Design panel so the user can attach them to a message.',
    parameters: {
      type: 'object',
      properties: { full: { type: 'boolean', description: 'Capture the whole scrollable page instead of the viewport' } },
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const shot = await designSession.call('screenshot', { full: !!args?.full, format: 'jpeg', quality: 0.82 }, 25_000)
      if (!shot?.ok) return `Screenshot failed: ${shot?.error ?? 'unknown error'}`
      captureStore.add({ id: nanoid(8), dataUrl: shot.dataUrl, w: shot.width, h: shot.height, at: Date.now(), url: shot.url, label: 'AI capture' })
      return `Captured ${shot.width}×${shot.height} of ${shot.url}. The image is displayed in the Design panel; ask the user to look if you need their opinion.`
    },
  },
  {
    name: 'design_inspect',
    description: 'Deep-inspect ONE element: exact box model (content/scroll/margin/padding/border), computed styles, colour contrast against its real background, sibling/parent geometry with their rects, attributes and its CSS path. Use the uid (e5) or a CSS selector from design_snapshot.',
    parameters: {
      type: 'object',
      properties: {
        target: opt('string', 'uid from design_snapshot (e.g. e12) or a CSS selector'),
        highlight: { type: 'boolean', description: 'Also flash a highlight box so the user sees which element you mean' },
      },
      required: ['target'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const target = String(args?.target ?? '')
      if (args?.highlight) { try { await designSession.call('highlight', { target, keep: false }) } catch { /* highlight is cosmetic */ } }
      const info = await designSession.call('inspect', { target }, 10_000)
      return JSON.stringify(info)
    },
  },
  {
    name: 'design_click',
    description: 'Click an element in the live preview (button, link, tab…) and report what happened: navigation, DOM growth, console output. This is how you test that a control actually does something.',
    parameters: {
      type: 'object',
      properties: {
        target: opt('string', 'uid or CSS selector'),
        waitMs: { type: 'number', description: 'How long to wait for the UI to react (default 450)' },
      },
      required: ['target'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const out = await designSession.call('click', { target: String(args?.target ?? ''), waitMs: Number(args?.waitMs ?? 450) }, 15_000)
      const bits = [`clicked "${out.clicked}"`, out.navigated ? `navigated to ${out.urlAfter}` : 'stayed on the same page', `DOM ${out.domDelta >= 0 ? '+' : ''}${out.domDelta} nodes`]
      const errs = (out.console ?? []).filter((c: any) => c.level === 'error')
      if (errs.length) bits.push(`console errors: ${errs.map((e: any) => e.text).join(' | ').slice(0, 300)}`)
      return bits.join(' · ')
    },
  },
  {
    name: 'design_type',
    description: 'Type text into an input/textarea in the live preview (fires real input+change events). Set submit=true to press Enter/submit the surrounding form afterwards.',
    parameters: {
      type: 'object',
      properties: {
        target: opt('string', 'uid or CSS selector of the field'),
        text: opt('string', 'Text to type'),
        submit: { type: 'boolean', description: 'Submit the form afterwards' },
      },
      required: ['target', 'text'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const out = await designSession.call('type', { target: String(args?.target ?? ''), text: String(args?.text ?? ''), submit: !!args?.submit }, 15_000)
      return `Typed into "${out.target || 'field'}" → value is now ${JSON.stringify(out.typed)}${out.urlAfter ? ` · url ${out.urlAfter}` : ''}`
    },
  },
  {
    name: 'design_assert',
    description: 'Assert real conditions against the live preview and get pass/fail per check. Kinds: exists, visible, text (contains/equals), value, count, style, contrast, rect, noConsoleErrors, noHorizontalScroll. This is how you verify a fix actually worked.',
    parameters: {
      type: 'object',
      properties: {
        checks: {
          type: 'array',
          description: 'List of checks. Each: { kind, target?, selector?, expect?, prop?, mode?, minWidth?, minHeight? }',
          items: {
            type: 'object',
            properties: {
              kind: STR,
              target: opt('string', 'uid or selector for element checks'),
              selector: opt('string', 'CSS selector (for count)'),
              expect: opt('string', 'Expected text/value/prop/count/ratio'),
              prop: opt('string', 'CSS property for kind=style'),
              mode: opt('string', 'for text: contains (default) | equals'),
              minWidth: { type: 'number' }, minHeight: { type: 'number' },
            },
            required: ['kind'],
          },
        },
      },
      required: ['checks'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const checks = Array.isArray(args?.checks) ? args.checks.slice(0, 25) : []
      if (!checks.length) return 'No checks were provided.'
      const out = await designSession.call('assert', { checks }, 20_000)
      const lines = out.results.map((r: any) => `${r.pass ? 'PASS' : 'FAIL'} · ${r.check} ${r.target ?? ''} — ${r.detail}`)
      return `${out.passed}/${out.total} checks passed\n${lines.join('\n')}`
    },
  },
  {
    name: 'design_audit',
    description: 'Static UI audit of the live preview plus responsive metrics: contrast, tap-target sizes, missing alt/labels, heading order, horizontal overflow, clipped text, broken images, elements wider than the viewport and console errors — each with a selector. Run this to find what to fix next.',
    parameters: { type: 'object', properties: {} },
    needsProject: true,
    run: async (_args, ctx) => {
      await readyForDesign(ctx)
      const [audit, metrics] = await Promise.all([
        designSession.call('audit', {}, 15_000),
        designSession.call('metrics', {}, 10_000),
      ])
      const overflow = metrics.horizontalOverflow
        ? `Document overflows horizontally (${metrics.document.scrollWidth}px in ${metrics.viewport.w}px). Culprits:\n${metrics.overflowingElements.map((e: any) => `  - ${e.sel} right edge ${e.right}px, width ${e.width}px`).join('\n')}`
        : 'No horizontal overflow at this width.'
      const small = metrics.smallTargets.length ? `Small tap targets:\n${metrics.smallTargets.map((s: any) => `  - ${s.sel} ${s.w}×${s.h} "${s.name}"`).join('\n')}` : 'All tap targets are ≥32px tall.'
      return `FINDINGS (${audit.findings.length})\n${formatFindings(audit.findings, 25)}\n\nRESPONSIVE\n${overflow}\n${small}\nviewport ${metrics.viewport.w}×${metrics.viewport.h} · ${metrics.document.nodes} nodes`
    },
  },
  {
    name: 'design_console',
    description: 'Read the console output and failed network requests captured from the live preview (with repeats collapsed). Pass clear=true to wipe the buffer first — do that before replaying a user flow so you only see fresh errors.',
    parameters: {
      type: 'object',
      properties: { clear: { type: 'boolean' }, limit: { type: 'number' } },
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const out = await designSession.call('console', { clear: !!args?.clear, limit: Math.min(Number(args?.limit ?? 40), 100) }, 10_000)
      if (args?.clear) return 'Console buffer cleared. The preview is quiet until something logs again.'
      const lines = (out.entries ?? []).map((c: any) => `${c.level.toUpperCase()}: ${c.text}${c.repeat > 1 ? ` (×${c.repeat})` : ''}`)
      const net = (out.network ?? []).map((n: any) => `${n.status || 'ERR'} ${n.url}`)
      return `CONSOLE (${lines.length})\n${lines.join('\n') || 'no output'}\n\nFAILED REQUESTS (${net.length})\n${net.join('\n') || 'none'}`
    },
  },
  {
    name: 'design_controls',
    description: 'Enumerate every interactive control currently on screen (buttons, links, inputs) with uid, accessible name, current value and whether it is above the fold. This is the list the user sees as "test buttons" in the Test panel — use the uids with design_click/design_type/design_assert to exercise them.',
    parameters: { type: 'object', properties: {} },
    needsProject: true,
    run: async (_args, ctx) => {
      await readyForDesign(ctx)
      const map = await designSession.call('controls', {}, 10_000)
      return formatControls(map.controls ?? [])
    },
  },
  {
    name: 'design_navigate',
    description: 'Move the live preview to a path or URL (e.g. "/login", "/dashboard?tab=2"). The page reloads with the bridge attached, so re-run design_snapshot afterwards.',
    parameters: {
      type: 'object',
      properties: { url: opt('string', 'Path starting with / or a full http(s) URL') },
      required: ['url'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const out = await designSession.call('navigate', { url: String(args?.url ?? '/') }, 8000).catch((e: any) => ({ error: e?.message }))
      if (out?.error) return `Could not navigate: ${out.error}`
      await designSession.waitForReady(15_000).catch(() => { /* the reply lands after the load event */ })
      return `Navigating to ${args?.url}. A fresh snapshot after a moment will show the new page.`
    },
  },
  {
    name: 'design_resize',
    description: 'Resize the preview pane to test responsive behaviour (e.g. 390×844 for a phone, 834×1112 for a tablet, 1440×900 desktop). Then re-run design_audit or design_snapshot to see what breaks at that width.',
    parameters: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Viewport width in px' },
        height: { type: 'number', description: 'Viewport height in px (default 900)' },
      },
      required: ['width'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      const width = Math.max(280, Math.min(Number(args?.width ?? 1280), 2560))
      const height = Math.max(280, Math.min(Number(args?.height ?? 900), 2000))
      designSession.onResize?.(width, height)
      await new Promise((r) => setTimeout(r, 700)) // let the layout settle
      const metrics = await designSession.call('metrics', {}, 8000).catch(() => null)
      return `Preview resized to ${width}×${height}.${metrics ? ` Document is now ${metrics.document.scrollWidth}px wide${metrics.horizontalOverflow ? ' — ⚠ horizontal overflow' : ''}.` : ''}`
    },
  },
  {
    name: 'run_ui_test',
    description: 'Run a scripted UI test against the live preview and return a pass/fail report. Steps run in order; each gets a client tool call you can see in the Test panel. Step shapes: {action:"click", target}, {action:"type", target, text, submit?}, {action:"navigate", url}, {action:"wait", ms}, {action:"assert", checks:[...]} (same check kinds as design_assert), {action:"snapshot"} to record the state at that point. Use this to prove a user flow works after your changes.',
    parameters: {
      type: 'object',
      properties: {
        name: opt('string', 'Short name for the test run, e.g. "search flow"'),
        steps: {
          type: 'array',
          description: 'Ordered steps',
          items: {
            type: 'object',
            properties: {
              action: STR, target: STR, text: STR, url: STR, ms: { type: 'number' },
              submit: { type: 'boolean' },
              note: opt('string', 'What this step checks — shown to the user'),
              checks: { type: 'array', items: { type: 'object' } },
            },
            required: ['action'],
          },
        },
      },
      required: ['steps'],
    },
    needsProject: true,
    run: async (args, ctx) => {
      await readyForDesign(ctx)
      return await runUiTest(Array.isArray(args?.steps) ? args.steps : [], String(args?.name ?? 'UI test'))
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

  /* ---------- ResearchEngine-only: turn this chat into a coding chat ---------- */
  {
    name: 'start_coding_mode',
    description: [
      'Open this conversation in Coding mode as a coding chat.',
      'CALL THIS whenever the user asks for code work in a research chat — "build me an app", "write a script", "fix this project", "make a website", "refactor this" — or when you are about to write real files rather than explain something.',
      'It creates (or reuses) a project, moves this conversation into it, and switches the window to the coding workspace, where you get the file, command and preview tools. Do not describe the switch; make the call, then continue the work inside the workspace it returns.',
      'This tool exists only in ResearchEngine — it is a client-side action, not a request to any provider.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        project: opt('string', 'Project name to create or reuse, e.g. "portfolio-site". Letters, digits, spaces, dash and underscore. If you omit it, one is derived from the chat title.'),
        reason: opt('string', 'One short sentence for the user explaining why coding mode is the right surface'),
        stack: opt('string', 'Optional starting point hint, e.g. "static html", "vite react", "python script"'),
      },
    },
    run: async (args, ctx) => {
      // Imported lazily: this pulls in the IDE's project helper, and research
      // chats should not pay for it until the model actually asks.
      const { promoteChatToCoding } = await import('@/lib/ide/promote')
      const outcome = await promoteChatToCoding({
        chatId: ctx.chatId,
        project: args?.project ? String(args.project) : undefined,
        reason: args?.reason ? String(args.reason) : undefined,
        stack: args?.stack ? String(args.stack) : undefined,
      })
      emitActivity({ agent: null, project: outcome.project, kind: 'write', note: `opened coding mode · ${outcome.project}` })
      // The transcript shows the receipt, so a switch that happens while the
      // user is reading is never a mystery.
      try {
        useStore.getState().updateMessage(ctx.chatId, ctx.asstId, {
          promotedTo: { project: outcome.project, reason: args?.reason ? String(args.reason) : undefined },
        })
      } catch { /* the move itself already happened */ }
      return JSON.stringify({
        ok: true,
        project: outcome.project,
        chatId: outcome.chatId,
        url: outcome.url,
        message: `A coding chat for "${outcome.project}" is open and this conversation moved into it. Continue the work there — the project is empty unless you reuse an existing one, so start by listing its files.`,
      })
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
    else if (def.name === 'run_ui_test') trace(`UI test: ${String(args.name ?? 'flow')}`.slice(0, 60), 'ok')
    else if (def.name === 'design_click') trace(`click ${String(args.target ?? '').slice(0, 40)}`, 'ok')
    else if (def.name === 'design_type') trace(`type into ${String(args.target ?? '').slice(0, 34)}`, 'ok')
    else if (def.name === 'design_assert') trace(`verify ${Array.isArray(args.checks) ? args.checks.length : 0} condition(s)`, 'ok')
    else if (def.name === 'design_screenshot') trace('capture screen', 'ok')
    else if (def.name === 'design_snapshot') trace('read the screen', 'ok')
    else if (def.name === 'design_audit') trace('UI audit', 'ok')
    else if (def.name === 'design_inspect') trace(`inspect ${String(args.target ?? '').slice(0, 40)}`, 'ok')
    else if (def.name === 'design_resize') trace(`resize ${args.width ?? ''}×${args.height ?? ''}`, 'ok')
    else if (def.name === 'design_navigate') trace(`go to ${String(args.url ?? '').slice(0, 40)}`, 'ok')
    else if (def.name === 'design_preview') trace(`preview ${String(args.action ?? '')}`, 'ok')
    else if (def.name === 'design_controls') trace('map controls', 'ok')
    else if (def.name === 'design_console') trace('read console', 'ok')
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
