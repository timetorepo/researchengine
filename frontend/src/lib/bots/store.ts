import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  addMemory, addRoutine, appendMessage, applyRunResult, createBot, removeMemory, removeRoutine, updateRoutine,
  type Bot, type BotMessage, type Routine, type RoutineRun,
} from './logic'

const id = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/** Every Bot on this device, with its thread, memory and routines. Kept in localStorage. */
export const useBots = create<{
  bots: Bot[]
  create: (input: { name: string; job: string }) => string
  remove: (botId: string) => void
  setJob: (botId: string, job: string) => void
  say: (botId: string, msg: Omit<BotMessage, 'id' | 'at'>) => void
  remember: (botId: string, text: string) => string | undefined
  forget: (botId: string, index: number) => void
  addRoutine: (botId: string, input: { title: string; instructions: string; everyMinutes: number }) => string | undefined
  patchRoutine: (botId: string, routineId: string, patch: Partial<Pick<Routine, 'enabled' | 'title' | 'instructions' | 'everyMinutes'>>) => void
  deleteRoutine: (botId: string, routineId: string) => void
  recordRun: (botId: string, routineId: string, run: Omit<RoutineRun, 'id'>) => void
}>()(
  persist(
    (set, get) => {
      const edit = (botId: string, fn: (b: Bot) => Bot) =>
        set((s) => ({ bots: s.bots.map((b) => (b.id === botId ? fn(b) : b)) }))
      return {
        bots: [],
        create: (input) => {
          const bot = createBot(input, Date.now(), id('bot'))
          set((s) => ({ bots: [...s.bots, bot] }))
          return bot.id
        },
        remove: (botId) => set((s) => ({ bots: s.bots.filter((b) => b.id !== botId) })),
        setJob: (botId, job) => edit(botId, (b) => ({ ...b, job: job.trim().slice(0, 1200) })),
        say: (botId, msg) => edit(botId, (b) => appendMessage(b, { ...msg, id: id('msg'), at: Date.now() })),
        remember: (botId, text) => {
          const bot = get().bots.find((b) => b.id === botId)
          if (!bot) return 'That bot is gone.'
          const res = addMemory(bot, text)
          if (res.error) return res.error
          edit(botId, () => res.bot)
          return undefined
        },
        forget: (botId, index) => edit(botId, (b) => removeMemory(b, index)),
        addRoutine: (botId, input) => {
          const bot = get().bots.find((b) => b.id === botId)
          if (!bot) return 'That bot is gone.'
          const res = addRoutine(bot, input, Date.now(), id('rt'))
          if (res.error) return res.error
          edit(botId, () => res.bot)
          return undefined
        },
        patchRoutine: (botId, routineId, patch) => edit(botId, (b) => updateRoutine(b, routineId, patch, Date.now())),
        deleteRoutine: (botId, routineId) => edit(botId, (b) => removeRoutine(b, routineId)),
        recordRun: (botId, routineId, run) => edit(botId, (b) => applyRunResult(b, routineId, { ...run, id: id('run') }, Date.now())),
      }
    },
    { name: 're.bots.v1', storage: createJSONStorage(() => localStorage) },
  ),
)
