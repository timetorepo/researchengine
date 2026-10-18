/**
 * Bots, as plain data and plain rules. A Bot is a named teammate with a job,
 * its own thread, memory it keeps, and routines that run on a schedule. Nothing
 * here touches the network or the browser, so the rules can be tested in Node.
 *
 * The shape is the one Grok Bot describes publicly (a named Bot, its memory and
 * conversation, routines with a schedule, and a cap on how many of each a Bot
 * can hold). The limits here are this app's own: see README and docs/research.
 */

export const MAX_ROUTINES = 50
export const MIN_EVERY_MINUTES = 5
export const MAX_RUNS_KEPT = 20
export const MAX_THREAD = 300
export const MAX_MEMORY = 100
/** How much of the thread a Bot reads before answering. Older messages are not sent to the model. */
export const CONTEXT_MESSAGES = 20

export interface BotMessage {
  id: string
  role: 'user' | 'bot' | 'note'
  text: string
  at: number
  /** Set when a routine wrote this message, so it can be told apart from a reply. */
  routineId?: string
}

export interface RoutineRun {
  id: string
  at: number
  ok: boolean
  text: string
}

export interface Routine {
  id: string
  title: string
  instructions: string
  everyMinutes: number
  enabled: boolean
  nextRunAt: number
  runs: RoutineRun[]
}

export interface Bot {
  id: string
  name: string
  job: string
  createdAt: number
  memory: string[]
  thread: BotMessage[]
  routines: Routine[]
}

export function clampEvery(minutes: number): number {
  const n = Math.round(Number(minutes))
  if (!Number.isFinite(n)) return MIN_EVERY_MINUTES
  return Math.max(MIN_EVERY_MINUTES, n)
}

export function createBot(input: { name: string; job: string }, now: number, id: string): Bot {
  return {
    id,
    name: input.name.trim().slice(0, 40) || 'Untitled bot',
    job: input.job.trim().slice(0, 1200),
    createdAt: now,
    memory: [],
    thread: [],
    routines: [],
  }
}

export function appendMessage(bot: Bot, msg: BotMessage): Bot {
  const thread = [...bot.thread, msg]
  return { ...bot, thread: thread.length > MAX_THREAD ? thread.slice(thread.length - MAX_THREAD) : thread }
}

export function addMemory(bot: Bot, text: string): { bot: Bot; error?: string } {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 400)
  if (!clean) return { bot, error: 'Write the thing to remember.' }
  if (bot.memory.some((m) => m.toLowerCase() === clean.toLowerCase())) return { bot, error: 'Already remembered.' }
  if (bot.memory.length >= MAX_MEMORY) return { bot, error: `A bot keeps up to ${MAX_MEMORY} memories. Remove one first.` }
  return { bot: { ...bot, memory: [...bot.memory, clean] } }
}

export function removeMemory(bot: Bot, index: number): Bot {
  return { ...bot, memory: bot.memory.filter((_, i) => i !== index) }
}

export function addRoutine(
  bot: Bot,
  input: { title: string; instructions: string; everyMinutes: number; enabled?: boolean },
  now: number,
  id: string,
): { bot: Bot; error?: string } {
  if (bot.routines.length >= MAX_ROUTINES) return { bot, error: `A bot can hold ${MAX_ROUTINES} routines. Delete one first.` }
  const title = input.title.trim().slice(0, 80)
  const instructions = input.instructions.trim().slice(0, 2000)
  if (!title) return { bot, error: 'Give the routine a title.' }
  if (!instructions) return { bot, error: 'Say what the routine should do.' }
  const every = clampEvery(input.everyMinutes)
  const routine: Routine = {
    id,
    title,
    instructions,
    everyMinutes: every,
    enabled: input.enabled ?? true,
    nextRunAt: now + every * 60000,
    runs: [],
  }
  return { bot: { ...bot, routines: [...bot.routines, routine] } }
}

export function updateRoutine(bot: Bot, routineId: string, patch: Partial<Pick<Routine, 'enabled' | 'title' | 'instructions' | 'everyMinutes'>>, now: number): Bot {
  return {
    ...bot,
    routines: bot.routines.map((r) => {
      if (r.id !== routineId) return r
      const next = { ...r, ...patch }
      if (patch.everyMinutes !== undefined) next.everyMinutes = clampEvery(patch.everyMinutes)
      if (patch.enabled === true && r.enabled === false) next.nextRunAt = now + next.everyMinutes * 60000
      return next
    }),
  }
}

export function removeRoutine(bot: Bot, routineId: string): Bot {
  return { ...bot, routines: bot.routines.filter((r) => r.id !== routineId) }
}

/** Record one run and set the next one. Only the most recent runs are kept. */
export function applyRunResult(bot: Bot, routineId: string, run: RoutineRun, now: number): Bot {
  return {
    ...bot,
    routines: bot.routines.map((r) => {
      if (r.id !== routineId) return r
      const runs = [run, ...r.runs].slice(0, MAX_RUNS_KEPT)
      return { ...r, runs, nextRunAt: now + r.everyMinutes * 60000 }
    }),
  }
}

/** Enabled routines whose time has come, oldest due first. */
export function dueRoutines(bots: Bot[], now: number): Array<{ bot: Bot; routine: Routine }> {
  const out: Array<{ bot: Bot; routine: Routine }> = []
  for (const bot of bots) {
    for (const routine of bot.routines) {
      if (routine.enabled && routine.nextRunAt <= now) out.push({ bot, routine })
    }
  }
  return out.sort((a, b) => a.routine.nextRunAt - b.routine.nextRunAt)
}

/** "remember: …" or "/remember …" saves a memory without asking the model. */
export function memoryCommand(text: string): string | null {
  const m = /^\s*(?:\/remember\s+|remember:\s*)(.+)$/is.exec(text)
  return m ? m[1].trim() : null
}

export function buildSystemPrompt(bot: Bot): string {
  const memory = bot.memory.length ? bot.memory.map((m) => `- ${m}`).join('\n') : '- (nothing saved yet)'
  return [
    `You are ${bot.name}, a persistent AI teammate. Stay in this role across the conversation.`,
    bot.job ? `Your job: ${bot.job}` : 'Your job has not been written yet. Ask what the person wants from you.',
    `Things you have been asked to remember:\n${memory}`,
    'You work only from this conversation and these memories. You cannot browse the web, send messages, open files or act in other apps from here, so do not claim that you did. If something needs a source you do not have, say so.',
    'Keep replies short unless the person asks for detail.',
  ].join('\n\n')
}

export function buildTurnPrompt(bot: Bot, userText: string): string {
  const recent = bot.thread.filter((m) => m.role !== 'note').slice(-CONTEXT_MESSAGES)
  const lines = recent.map((m) => `${m.role === 'user' ? 'Person' : bot.name}: ${m.text}`)
  return [
    lines.length ? `Recent conversation:\n${lines.join('\n')}` : 'This is the first message.',
    `Person: ${userText}`,
    `Reply as ${bot.name}.`,
  ].join('\n\n')
}

export function buildRoutinePrompt(bot: Bot, routine: Routine, now: number): string {
  return [
    `This is a scheduled routine named "${routine.title}". It is running at ${new Date(now).toLocaleString()}.`,
    `What to do: ${routine.instructions}`,
    'You have no live access to the internet or to any app. Work from your memories and the recent conversation. If the routine needs live information, say that plainly instead of guessing.',
    'Write the result as a short note for the person. Begin with the result, not with a preamble.',
  ].join('\n\n')
}

/** A deterministic colour and initial for a bot, so it looks the same every time. */
export function botAvatar(name: string): { letter: string; hue: number } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { letter: (name.trim()[0] ?? '?').toUpperCase(), hue: h % 360 }
}
