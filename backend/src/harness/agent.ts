/**
 * The agent loop: read the session, ask the model, run its tool calls, record
 * everything in the log, and repeat until the model answers without tools or
 * the step budget runs out.
 *
 * Context stays bounded for long sessions without losing the best material:
 *  1. old tool output is shortened first (the newest results are kept whole);
 *  2. if still too large, the oldest whole turns are dropped, and a note says so;
 *  3. a turn is never split: a tool call is always kept with its result.
 * The log keeps everything. Only the window sent to the model is fitted.
 */
import { definePlugin } from './kernel'
import type { ChatMessage, CompletionToolSpec, LlmService, ModelTarget } from './llm'
import type { SessionEvent, SessionStore } from './sessions'
import type { ToolEnv, ToolRegistry } from './tools'
import type { AgentAccess } from '../services/agent-access'
import { PROFILES, type ProfileId } from './profiles'

/** Characters, not tokens: a rough, dependable budget (about 4 characters per token). */
export const DEFAULT_CONTEXT_CHARS = 120_000
/** Tool output this recent is kept at full length. */
const KEEP_RECENT_MESSAGES = 6
const SHORT_TOOL_OUTPUT = 400

export const HARNESS_SYSTEM = `You are the coding agent of Research Engine's harness. Work in small, verified steps:
- Read a file before you change it. Use list_files and read_file to look, str_replace_editor to change.
- Use bash only when the user has approved shell; run the project's own checks and report what they printed.
- When you are done, reply with what changed, what you verified, and what you could not verify.
- Never invent file contents, command output or results.`

export type TurnEvent =
  | { type: 'assistant'; content: string }
  | { type: 'tool_call'; name: string; arguments: string }
  | { type: 'tool_result'; name: string; content: string }
  | { type: 'done'; steps: number }
  | { type: 'stopped' }
  | { type: 'error'; message: string }

export interface TurnOptions {
  sessionId: string
  text: string
  profile: ProfileId
  target: ModelTarget
  workspace: string | null
  approve: boolean
  access: AgentAccess
  signal?: AbortSignal
  maxContextChars?: number
  onEvent?: (e: TurnEvent) => void
}

export interface AgentService {
  run(opts: TurnOptions): Promise<{ steps: number; outcome: 'done' | 'stopped' | 'error' | 'step-limit' }>
}

/** Rebuild the model's message list from the log. Unanswered tool calls get a note instead of a result. */
export function messagesFromLog(events: SessionEvent[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const e of events) {
    if (e.type === 'user') out.push({ role: 'user', content: e.content ?? '' })
    else if (e.type === 'assistant') {
      const msg: ChatMessage = { role: 'assistant', content: e.content ?? '' }
      if (e.toolCalls?.length) {
        msg.tool_calls = e.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } }))
      }
      out.push(msg)
    } else if (e.type === 'tool') {
      out.push({ role: 'tool', tool_call_id: e.toolCallId, name: e.name, content: e.content ?? '' })
    }
  }
  // Every tool call needs a tool result before the next model call, or the API rejects the request.
  const answered = new Set(out.filter((m) => m.role === 'tool').map((m) => m.tool_call_id))
  const fixed: ChatMessage[] = []
  for (const m of out) {
    fixed.push(m)
    for (const c of m.tool_calls ?? []) {
      if (!answered.has(c.id)) fixed.push({ role: 'tool', tool_call_id: c.id, name: c.function.name, content: 'Not run: the turn was stopped before this tool finished.' })
    }
  }
  return fixed
}

const size = (m: ChatMessage) => m.content.length + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0)
const total = (ms: ChatMessage[]) => ms.reduce((n, m) => n + size(m), 0)

/**
 * Fit the window to a budget. `messages` must start with the system prompt,
 * which is never dropped. Returns a new array; the input is not changed.
 */
export function fitContext(messages: ChatMessage[], budget = DEFAULT_CONTEXT_CHARS): ChatMessage[] {
  if (total(messages) <= budget) return messages
  const system = messages[0]?.role === 'system' ? messages[0] : null
  let body = (system ? messages.slice(1) : messages).map((m) => ({ ...m }))

  // 1. Shorten old tool output, newest kept whole.
  const cutoff = Math.max(0, body.length - KEEP_RECENT_MESSAGES)
  for (let i = 0; i < cutoff; i++) {
    const m = body[i]
    if (m.role === 'tool' && m.content.length > SHORT_TOOL_OUTPUT) {
      m.content = `${m.content.slice(0, SHORT_TOOL_OUTPUT)}\n…[shortened to fit the context; ${m.content.length - SHORT_TOOL_OUTPUT} characters left out]`
    }
  }
  const shrunk = (system ? [system] : []).concat(body)
  if (total(shrunk) <= budget) return shrunk

  // 2. Drop whole old turns: cut only at a user message, and always keep the newest turn.
  const note: ChatMessage = { role: 'system', content: 'Earlier turns of this session were left out to fit the context window. The full record is in the session log.' }
  const userAt = body.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0)
  for (const start of userAt.slice(1)) {
    const candidateBody = body.slice(start)
    if (total([...(system ? [system] : []), note, ...candidateBody]) <= budget) {
      return [...(system ? [system] : []), note, ...candidateBody]
    }
  }
  // 3. The newest turn alone is still over budget: keep it whole rather than cut
  // it mid-exchange. Its size is the caller's responsibility (the chat input is capped).
  const newestStart = userAt.length ? userAt[userAt.length - 1] : 0
  return [...(system ? [system] : []), note, ...body.slice(newestStart)]
}

function parseArgs(raw: string): Record<string, unknown> | null {
  try {
    const v = raw.trim() ? JSON.parse(raw) : {}
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function agentPlugin() {
  return definePlugin({
    name: 'agent',
    inject: ['llm', 'sessions', 'tools'],
    apply(ctx) {
      const run = async (opts: TurnOptions): Promise<{ steps: number; outcome: 'done' | 'stopped' | 'error' | 'step-limit' }> => {
        const llm = ctx.get<LlmService>('llm')!
        const sessions = ctx.get<SessionStore>('sessions')!
        const tools = ctx.get<ToolRegistry>('tools')!
        const profile = PROFILES[opts.profile] ?? PROFILES.minimal
        const emit = (e: TurnEvent) => opts.onEvent?.(e)
        const env: ToolEnv = { workspace: opts.workspace, approve: opts.approve, access: opts.access, signal: opts.signal }

        // Only the profile's tools are offered to the model, and only those can run.
        const allowed = new Set<string>(profile.tools)
        const specs: CompletionToolSpec[] = tools.list().filter((t) => allowed.has(t.name))
          .map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))

        await sessions.append(opts.sessionId, { type: 'user', content: opts.text })
        const system: ChatMessage = { role: 'system', content: `${HARNESS_SYSTEM}\nProfile: ${profile.title}. ${profile.description}` }
        let steps = 0
        for (let step = 1; step <= profile.maxSteps; step++) {
          steps = step
          if (opts.signal?.aborted) {
            await sessions.append(opts.sessionId, { type: 'stopped' })
            emit({ type: 'stopped' })
            return { steps, outcome: 'stopped' }
          }
          const history = messagesFromLog(await sessions.read(opts.sessionId))
          const window = fitContext([system, ...history], opts.maxContextChars ?? DEFAULT_CONTEXT_CHARS)
          let reply
          try {
            reply = await llm.complete(opts.target, window, specs, opts.signal)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (opts.signal?.aborted) {
              await sessions.append(opts.sessionId, { type: 'stopped' })
              emit({ type: 'stopped' })
              return { steps, outcome: 'stopped' }
            }
            await sessions.append(opts.sessionId, { type: 'error', content: message })
            emit({ type: 'error', message })
            return { steps, outcome: 'error' }
          }

          if (reply.toolCalls.length) {
            await sessions.append(opts.sessionId, { type: 'assistant', content: reply.content, toolCalls: reply.toolCalls })
            if (reply.content) emit({ type: 'assistant', content: reply.content })
            for (const call of reply.toolCalls) {
              emit({ type: 'tool_call', name: call.name, arguments: call.arguments })
              let result: string
              const args = parseArgs(call.arguments)
              if (!allowed.has(call.name)) result = `Error: the "${opts.profile}" profile does not offer the tool "${call.name}".`
              else if (!args) result = 'Error: the arguments were not valid JSON.'
              else result = await tools.call(call.name, args, { ...env, signal: opts.signal })
              await sessions.append(opts.sessionId, { type: 'tool', toolCallId: call.id, name: call.name, content: result })
              emit({ type: 'tool_result', name: call.name, content: result })
            }
            continue
          }

          await sessions.append(opts.sessionId, { type: 'assistant', content: reply.content })
          emit({ type: 'assistant', content: reply.content })
          emit({ type: 'done', steps })
          return { steps, outcome: 'done' }
        }
        const message = `Stopped after ${profile.maxSteps} steps without a final answer.`
        await sessions.append(opts.sessionId, { type: 'error', content: message })
        emit({ type: 'error', message })
        return { steps, outcome: 'step-limit' }
      }
      ctx.provide<AgentService>('agent', { run })
    },
  })
}
