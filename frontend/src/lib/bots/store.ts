import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  addMemory, addRoutine, appendMessage, applyHandoff, applyRunResult, createBot, createProject, createRoom,
  DEFAULT_SETTINGS, MAX_PROJECTS, MAX_ROOMS, MAX_ROOM_THREAD, removeMemory, removeRoutine, updateRoutine,
  remapIncoming, type AvatarType, type Bot, type BotMessage, type BotRole, type BotSettings, type Project,
  type ProjectEvent, type Room, type RoomMessage, type Routine, type RoutineRun,
} from './logic'

const id = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/** Bots, group rooms, projects and settings, kept in this browser. Version 2 added rooms, projects and settings. */
export const BOTS_STORE_VERSION = 2

export interface BotsState {
  bots: Bot[]
  rooms: Room[]
  projects: Project[]
  settings: BotSettings
  create: (input: { name: string; job: string }) => string
  remove: (botId: string) => void
  setJob: (botId: string, job: string) => void
  setAvatar: (botId: string, avatar: AvatarType) => void
  setWebAccess: (botId: string, on: boolean) => void
  setRole: (botId: string, role: BotRole | null) => void
  say: (botId: string, msg: Omit<BotMessage, 'id' | 'at'>) => void
  remember: (botId: string, text: string) => string | undefined
  forget: (botId: string, index: number) => void
  addRoutine: (botId: string, input: { title: string; instructions: string; everyMinutes: number }) => string | undefined
  patchRoutine: (botId: string, routineId: string, patch: Partial<Pick<Routine, 'enabled' | 'title' | 'instructions' | 'everyMinutes'>>) => void
  deleteRoutine: (botId: string, routineId: string) => void
  recordRun: (botId: string, routineId: string, run: Omit<RoutineRun, 'id'>) => void
  createRoom: (input: { name: string; memberIds: string[] }) => string | undefined
  deleteRoom: (roomId: string) => void
  postRoom: (roomId: string, msg: Omit<RoomMessage, 'id' | 'at'>) => void
  createProject: (input: { name: string; brief: string; ownerId: string | null }) => string | undefined
  deleteProject: (projectId: string) => void
  handOffProject: (projectId: string, toBotId: string, event: { text: string; fromId?: string }) => void
  noteProject: (projectId: string, text: string) => void
  setSettings: (patch: Partial<BotSettings>) => void
  importBundle: (data: { bots: Bot[]; rooms: Room[]; projects: Project[] }) => { bots: number; rooms: number; projects: number }
}

export const useBots = create<BotsState>()(
  persist(
    (set, get) => {
      const edit = (botId: string, fn: (b: Bot) => Bot) =>
        set((s) => ({ bots: s.bots.map((b) => (b.id === botId ? fn(b) : b)) }))
      const editProject = (projectId: string, fn: (p: Project) => Project) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? fn(p) : p)) }))
      const editRoom = (roomId: string, fn: (r: Room) => Room) =>
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }))
      return {
        bots: [],
        rooms: [],
        projects: [],
        settings: { ...DEFAULT_SETTINGS },
        create: (input) => {
          const bot = createBot(input, Date.now(), id('bot'))
          set((s) => ({ bots: [...s.bots, bot] }))
          return bot.id
        },
        remove: (botId) => set((s) => ({
          bots: s.bots.filter((b) => b.id !== botId),
          rooms: s.rooms.map((r) => ({ ...r, memberIds: r.memberIds.filter((m) => m !== botId) })),
          projects: s.projects.map((p) => (p.ownerId === botId ? { ...p, ownerId: null } : p)),
        })),
        setJob: (botId, job) => edit(botId, (b) => ({ ...b, job: job.trim().slice(0, 1200) })),
        setAvatar: (botId, avatar) => edit(botId, (b) => ({ ...b, avatar })),
        setWebAccess: (botId, on) => edit(botId, (b) => ({ ...b, webAccess: on })),
        setRole: (botId, role) => edit(botId, (b) => {
          const next = { ...b }
          if (role) next.role = role
          else delete next.role
          return next
        }),
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

        createRoom: (input) => {
          if (get().rooms.length >= MAX_ROOMS) return `You can keep up to ${MAX_ROOMS} groups. Delete one first.`
          const res = createRoom(input, Date.now(), id('room'))
          if (res.error || !res.room) return res.error ?? 'The group was not created.'
          set((s) => ({ rooms: [...s.rooms, res.room!] }))
          return undefined
        },
        deleteRoom: (roomId) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId) })),
        postRoom: (roomId, msg) => editRoom(roomId, (r) => {
          const thread = [...r.thread, { ...msg, id: id('rmsg'), at: Date.now() }]
          return { ...r, thread: thread.length > MAX_ROOM_THREAD ? thread.slice(thread.length - MAX_ROOM_THREAD) : thread }
        }),

        createProject: (input) => {
          if (get().projects.length >= MAX_PROJECTS) return `You can keep up to ${MAX_PROJECTS} projects. Delete one first.`
          const res = createProject(input, Date.now(), id('proj'))
          if (res.error || !res.project) return res.error ?? 'The project was not created.'
          set((s) => ({ projects: [...s.projects, res.project!] }))
          return undefined
        },
        deleteProject: (projectId) => set((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) })),
        handOffProject: (projectId, toBotId, event) => editProject(projectId, (p) => {
          const ev: Omit<ProjectEvent, 'kind'> = { id: id('ev'), at: Date.now(), text: event.text, fromId: event.fromId, toId: toBotId }
          return applyHandoff(p, ev, toBotId)
        }),
        noteProject: (projectId, text) => editProject(projectId, (p) => ({
          ...p,
          log: [...p.log, { id: id('ev'), at: Date.now(), kind: 'note', text: text.trim().slice(0, 2000) }],
        })),

        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        importBundle: (data) => {
          const mapped = remapIncoming(data, id)
          const roomsLeft = Math.max(0, MAX_ROOMS - get().rooms.length)
          const projectsLeft = Math.max(0, MAX_PROJECTS - get().projects.length)
          const rooms = mapped.rooms.slice(0, roomsLeft)
          const projects = mapped.projects.slice(0, projectsLeft)
          set((s) => ({ bots: [...s.bots, ...mapped.bots], rooms: [...s.rooms, ...rooms], projects: [...s.projects, ...projects] }))
          return { bots: mapped.bots.length, rooms: rooms.length, projects: projects.length }
        },
      }
    },
    {
      name: 're.bots.v1',
      version: BOTS_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // A version 1 store has bots only. Keep every bot and thread as it is, and add the new parts empty.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<BotsState>
        return {
          ...p,
          bots: Array.isArray(p.bots) ? p.bots : [],
          rooms: Array.isArray(p.rooms) ? p.rooms : [],
          projects: Array.isArray(p.projects) ? p.projects : [],
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        } as BotsState
      },
    },
  ),
)
