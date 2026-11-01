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
import { PROFILES, type Profile, type ProfileId } from './profiles'

/** Characters, not tokens: a rough, dependable budget (about 4 characters per token). */
export const DEFAULT_CONTEXT_CHARS = 120_000
/** Tool output this recent is kept at full length. */
const KEEP_RECENT_MESSAGES = 6
const SHORT_TOOL_OUTPUT = 400

/**
 * Codersa's system prompt. Built per profile, so it names only the tools that profile
 * offers: a prompt that promises `read_file` to a profile that cannot call it sends the
 * model into a loop of refused calls.
 */
export function harnessSystem(profile: Profile): string {
  const tools = profile.tools.map((t) => `\`${t}\``).join(', ')
  return `You are Codersa, the coding agent inside Research Engine's harness. You work in the person's project folder as a calm, exact senior engineer. You look before you touch, you make the smallest change that solves the problem, and you report exactly what you did and what you did not verify.

# How you work
1. Understand. Restate the goal in one sentence. Find the files that matter before you change anything. Read them in full when they are short, and in parts when they are long.
2. Plan when the change spans more than one file: name the files and the order you will edit them in. For a one-line fix, skip the plan.
3. Change. Edit with the smallest exact replacement that works. Include enough surrounding lines that the text you replace is unique. Create a new file only when the task needs one. Never rewrite a whole file to change one line. Follow the conventions you see: naming, imports, formatting, error handling.
4. Verify. Find the project's own checks (the test, typecheck, build or lint scripts in package.json, Makefile, pyproject.toml or similar) and run the ones that cover your change. Read the output. If your change broke a check, fix it before you stop.
5. Report. Use this shape, and keep each part short:
   - Changed: each file and one line on what changed in it.
   - Verified: the exact command you ran and whether it passed.
   - Not verified: anything you could not run or check, and why.
   - Decision needed: only if the person must choose something before you go on.

# Tools in this profile
You may call only these: ${tools}. ${profile.tools.includes('bash') ? 'Use `bash` for searches (grep, find), test runs and builds. Keep each command bounded: prefer grep, head and tail to dumping whole files.' : 'You have no shell here, so you read with what the editor and file tools give you.'}

# Rules
- Never invent file contents, paths, command output or test results. If you have not read it or run it, say so.
- If a tool says shell is off, do not retry it. Say that shell needs to be allowed for this session, give what you found so far, and stop.
- Do not run an irreversible or destructive command (deleting files outside a build folder, force-pushing, resetting history, changing a credential) unless the person asked for that exact action.
- Do not print secrets. If a file holds a key or password, say that it does and do not quote the value.
- Ask one precise question only when a requirement is genuinely ambiguous. Otherwise make the reasonable choice and say what it was.
- You have a fixed number of model calls in this turn. When you are told how many remain, stop starting new work, finish what you can, and report.

# Style
Plain and direct. No preamble, no "Great, I'll", no closing offer of further help. Show code only when the person asks to see it; otherwise name the file and the function.`
}

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
        const system: ChatMessage = { role: 'system', content: `${harnessSystem(profile)}\n\nProfile: ${profile.title}. ${profile.description}` }
        let steps = 0
        for (let step = 1; step <= profile.maxSteps; step++) {
          steps = step
          if (opts.signal?.aborted) {
            await sessions.append(opts.sessionId, { type: 'stopped' })
            emit({ type: 'stopped' })
            return { steps, outcome: 'stopped' }
          }
          const history = messagesFromLog(await sessions.read(opts.sessionId))
          // Near the limit the model is told how many calls it has left, so it can
          // wrap up instead of starting a step it cannot finish. The note is sent with
          // this call only; it is not written to the log.
          const left = profile.maxSteps - step
          const budget: ChatMessage[] = left <= 2
            ? [{ role: 'system', content: left <= 0 ? 'No model calls are left in this turn. Reply now with what changed, what you verified and what remains.' : `You have ${left} model call${left === 1 ? '' : 's'} left in this turn. Finish the work you can and report; do not start a new investigation.` }]
            : []
          const window = fitContext([system, ...history, ...budget], opts.maxContextChars ?? DEFAULT_CONTEXT_CHARS)
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
        // The budget is spent. Ask once more, with no tools offered, for the report the
        // person needs: what changed and what is left. The turn still counts as stopped.
        const message = `Stopped after ${profile.maxSteps} steps without a final answer.`
        let summary = ''
        if (!opts.signal?.aborted) {
          try {
            const history = messagesFromLog(await sessions.read(opts.sessionId))
            const reply = await llm.complete(opts.target, fitContext([system, ...history, { role: 'system', content: 'No model calls are left in this turn. Reply now with what changed, what you verified and what remains. Do not call tools.' }], opts.maxContextChars ?? DEFAULT_CONTEXT_CHARS), [], opts.signal)
            summary = reply.content.trim()
          } catch { /* the step-limit message below is still recorded */ }
        }
        if (summary) {
          await sessions.append(opts.sessionId, { type: 'assistant', content: summary })
          emit({ type: 'assistant', content: summary })
        }
        await sessions.append(opts.sessionId, { type: 'error', content: message })
        emit({ type: 'error', message })
        return { steps, outcome: 'step-limit' }
      }
      ctx.provide<AgentService>('agent', { run })
    },
  })
}
