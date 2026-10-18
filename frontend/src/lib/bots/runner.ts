/**
 * Runs a Bot: a reply in its thread, or a routine on its schedule. Both use the
 * model you have configured (the same one as the rest of the app). A reply that
 * is only a memory note ("remember: …") is saved without calling the model.
 *
 * Routines run while Research Engine is open. There is no server that keeps
 * them going when the app is closed, and the UI says so.
 */
import { generateText } from '@/lib/chat/generate'
import { useBots } from './store'
import { buildRoutinePrompt, buildSystemPrompt, buildTurnPrompt, dueRoutines, memoryCommand, type Bot, type Routine } from './logic'

const MODEL_MISSING = 'No model is set up. Connect a provider in Settings → Providers, then try again.'

async function ask(system: string, prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await generateText({ system, prompt, temperature: 0.4, maxTokens: 900 })
    if (res.usedDemo) return { ok: false, error: MODEL_MISSING }
    const text = res.text.trim()
    return text ? { ok: true, text } : { ok: false, error: 'The model returned nothing.' }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'The model did not answer.' }
  }
}

/** Send the person's message to a Bot and store the reply. */
export async function chatWithBot(botId: string, text: string): Promise<void> {
  const store = useBots.getState()
  const bot = store.bots.find((b) => b.id === botId)
  if (!bot) return
  store.say(botId, { role: 'user', text })
  const memo = memoryCommand(text)
  if (memo !== null) {
    const err = store.remember(botId, memo)
    store.say(botId, { role: 'bot', text: err ? `I could not save that: ${err}` : `Saved to my memory: “${memo}”` })
    return
  }
  const fresh = useBots.getState().bots.find((b) => b.id === botId) ?? bot
  const prior = fresh.thread.slice(0, -1)
  const turn = buildTurnPrompt({ ...fresh, thread: prior }, text)
  const res = await ask(buildSystemPrompt(fresh), turn)
  store.say(botId, res.ok ? { role: 'bot', text: res.text } : { role: 'note', text: res.error })
}

/** Run one routine now, record the result, and set its next time. */
export async function runRoutine(botId: string, routineId: string): Promise<void> {
  const bot = useBots.getState().bots.find((b) => b.id === botId)
  const routine = bot?.routines.find((r) => r.id === routineId)
  if (!bot || !routine) return
  const at = Date.now()
  const res = await ask(buildSystemPrompt(bot), buildRoutinePrompt(bot, routine, at))
  const store = useBots.getState()
  store.recordRun(botId, routineId, { at, ok: res.ok, text: res.ok ? res.text : res.error })
  store.say(botId, res.ok
    ? { role: 'bot', text: `${routine.title}: ${res.text}`, routineId }
    : { role: 'note', text: `${routine.title} did not run: ${res.error}`, routineId })
}

let timer: number | undefined
let running = false

/** Checks every 30 seconds for routines that are due, and runs them one at a time. Idempotent. */
export function startBotScheduler(): void {
  if (timer !== undefined || typeof window === 'undefined') return
  const tick = async () => {
    if (running) return
    running = true
    try {
      const due = dueRoutines(useBots.getState().bots, Date.now())
      for (const { bot, routine } of due) await runRoutine(bot.id, routine.id)
    } finally {
      running = false
    }
  }
  timer = window.setInterval(() => { void tick() }, 30000)
  void tick()
}

export type { Routine, Bot }
