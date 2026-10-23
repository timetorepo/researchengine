/**
 * Bots, as plain data and plain rules. A Bot is a named teammate with a job,
 * its own thread, memory it keeps, and routines that run on a schedule. Bots can
 * also meet in a group room, and a project can be handed from one Bot to another.
 * Nothing here touches the network or the browser, so the rules can be tested in Node.
 *
 * The shape follows the parts of Grok Bot that are publicly documented (a named
 * Bot, its memory and conversation, routines with a schedule, and a cap on how
 * many of each a Bot can hold). The limits and the rest are this app's own: see
 * docs/research/grok-bot-notes.md.
 */

import { familyForRole, roleText } from '@/lib/ecc/roles'

export const MAX_ROUTINES = 50
export const MIN_EVERY_MINUTES = 5
export const MAX_RUNS_KEPT = 20
export const MAX_THREAD = 300
export const MAX_MEMORY = 100
/** How much of the thread a Bot reads before answering. Older messages are not sent to the model. */
export const CONTEXT_MESSAGES = 20
/** Bot turns in one round of a group room. A round ends at this cap or when nobody is called on. */
export const MAX_ROOM_TURNS = 6
export const MAX_ROOM_MEMBERS = 6
export const MAX_ROOMS = 30
export const MAX_ROOM_THREAD = 300
export const MAX_PROJECTS = 100
/** Web steps (SEARCH or OPEN) one reply may take before the bot must answer. */
export const MAX_TOOL_STEPS = 3
/** Longest legacy role template a Bot carries. */
export const MAX_ROLE_PROMPT = 6000

/** Bot avatars come from the bot-avatars package (libraries.dev, MIT). */
export const AVATAR_TYPES = [
  'clover', 'flower', 'triangle', 'square', 'blob', 'ghost', 'circle', 'drop', 'star',
  'droid', 'mech', 'alien', 'hexagon', 'cat', 'cloud', 'pill', 'pebble', 'puddle',
] as const
export type AvatarType = (typeof AVATAR_TYPES)[number]

export function isAvatarType(v: unknown): v is AvatarType {
  return typeof v === 'string' && (AVATAR_TYPES as readonly string[]).includes(v)
}

export interface Source { title: string; url: string }

export interface BotMessage {
  id: string
  role: 'user' | 'bot' | 'note'
  text: string
  at: number
  /** Set when a routine wrote this message, so it can be told apart from a reply. */
  routineId?: string
  /** Web steps the bot took for this reply, in order. Shown under the reply. */
  trace?: string[]
  /** Pages the bot read for this reply, so its answer can be checked. */
  sources?: Source[]
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

/**
 * A role from ECC (affaan-m/ecc, MIT), chosen by its plain family name (Researcher,
 * Workflow, …). The ECC members are picked per request, see lib/ecc/roles.ts. `id`
 * is the family id; older bots stored one ECC agent id and still resolve.
 */
export interface BotRole {
  source: 'ecc'
  id: string
  name: string
  /** Legacy: the single template stored by earlier versions. Used only if the role cannot be resolved. */
  prompt?: string
}

export interface Bot {
  id: string
  name: string
  job: string
  createdAt: number
  memory: string[]
  thread: BotMessage[]
  routines: Routine[]
  avatar?: AvatarType
  /** When on, the bot may search and open pages through the Web settings. Off by default. */
  webAccess?: boolean
  role?: BotRole
}

export interface RoomMessage {
  id: string
  role: 'user' | 'bot' | 'note'
  /** Who spoke, when the message is from a bot. */
  botId?: string
  text: string
  at: number
  trace?: string[]
  sources?: Source[]
}

export interface Room {
  id: string
  name: string
  memberIds: string[]
  createdAt: number
  thread: RoomMessage[]
}

export interface ProjectEvent {
  id: string
  at: number
  kind: 'created' | 'note' | 'handoff'
  fromId?: string
  toId?: string
  text: string
}

export interface Project {
  id: string
  name: string
  brief: string
  /** The Bot that owns the project now. Null when its Bot was deleted. */
  ownerId: string | null
  createdAt: number
  log: ProjectEvent[]
}

export interface BotSettings {
  /** Routines stop while this is on. Chats and rooms still work. */
  paused: boolean
  /** A SearXNG address (for example http://localhost:8080). Empty uses the server default. */
  searxng: string
  /** A headless browser in Docker (for example http://localhost:3000). Empty reads pages directly. */
  browserUrl: string
}

export const DEFAULT_SETTINGS: BotSettings = { paused: false, searxng: '', browserUrl: '' }

export function clampEvery(minutes: number): number {
  const n = Math.round(Number(minutes))
  if (!Number.isFinite(n)) return MIN_EVERY_MINUTES
  return Math.max(MIN_EVERY_MINUTES, n)
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** A default avatar for a Bot, from its id, so the same Bot always looks the same. */
export function avatarTypeFor(id: string): AvatarType {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TYPES[h % AVATAR_TYPES.length]
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

// ---------------------------------------------------------------- tools
//
// A bot asks for a tool by writing one line. The steps run in the browser and the
// result is added to the prompt; every step is kept with the reply.
//   SEARCH: <query>      web search                 (web access on)
//   OPEN: <https url>    read a page                (web access on)
//   FIND: <query>        search connected accounts and local files
//   APPS:                list the apps connected through Composio
//   TOOLS: <app>         list the actions one app offers
//   RUN: <ACTION> {json} run one action on a connected app

export type ToolCall =
  | { kind: 'search'; query: string }
  | { kind: 'open'; url: string }
  | { kind: 'find'; query: string }
  | { kind: 'apps' }
  | { kind: 'tools'; app: string }
  | { kind: 'run'; tool: string; args: Record<string, unknown>; raw: string }

// Uppercase keyword and a colon, so an ordinary sentence such as "Run: npm test"
// in a normal answer is never taken for a tool. APPS may stand alone.
const TOOL_LINE = /^\s*(?:(SEARCH|OPEN|FIND|TOOLS|RUN)\s*:\s*(.*?)|(APPS)\s*:?)\s*$/gm
const WEB_KINDS = new Set(['search', 'open'])

function parseArgs(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!raw.trim()) return { ok: true, value: {} }
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? { ok: true, value: v } : { ok: false }
  } catch { return { ok: false } }
}

/**
 * The first tool line a reply asks for. Anything else is an answer. Web lines are
 * only read when web access is on; connector lines are always read.
 */
export function findToolCall(text: string, opts: { web?: boolean } = { web: true }): ToolCall | null {
  const web = opts.web !== false
  for (const m of text.matchAll(TOOL_LINE)) {
    const kind = (m[1] ?? m[3] ?? '').toUpperCase()
    const arg = (m[2] ?? '').trim()
    if (kind === 'SEARCH') { if (web && arg) return { kind: 'search', query: arg.slice(0, 200) }; continue }
    if (kind === 'OPEN') { if (web && isHttpUrl(arg)) return { kind: 'open', url: arg }; continue }
    if (kind === 'FIND') { if (arg) return { kind: 'find', query: arg.slice(0, 200) }; continue }
    if (kind === 'APPS') return { kind: 'apps' }
    if (kind === 'TOOLS') { if (arg) return { kind: 'tools', app: arg.slice(0, 64).toLowerCase() }; continue }
    if (kind === 'RUN') {
      const sp = arg.search(/\s|\{/)
      const tool = (sp < 0 ? arg : arg.slice(0, sp)).trim().toUpperCase()
      const rest = sp < 0 ? '' : arg.slice(sp).trim()
      const parsed = parseArgs(rest)
      if (/^[A-Z0-9][A-Z0-9_]{1,119}$/.test(tool) && parsed.ok) return { kind: 'run', tool, args: parsed.value, raw: arg.slice(0, 300) }
    }
  }
  return null
}

/** The reply without its tool lines, so a step's request is never shown as the answer. */
export function stripToolLines(text: string): string {
  return text.replace(TOOL_LINE, '').replace(/\n{3,}/g, '\n\n').trim()
}

export function isWebCall(call: ToolCall): boolean {
  return WEB_KINDS.has(call.kind)
}

export function webInstructions(): string {
  return [
    'You can browse the web for this reply. To search, write one line: SEARCH: <query>',
    'To read a page, write one line: OPEN: <https address from a search result>',
    `Use at most ${MAX_TOOL_STEPS} such lines in total. You will then receive the results. When you have enough, write the answer with no tool line.`,
    'Cite what you used with [1], [2] and so on, matching the numbered sources you were given, and list them at the end. Say when a page could not be read.',
  ].join('\n')
}

export function connectorInstructions(): string {
  return [
    'You also have access to the person\'s connected accounts and apps. Write one line to use one:',
    'FIND: <query>  searches their connected accounts and local files.',
    'APPS:  lists the apps they have connected through Composio.',
    'TOOLS: <app>  lists the actions that app offers, e.g. TOOLS: gmail.',
    'RUN: <ACTION> {"argument": "value"}  runs one action, using a name from TOOLS, e.g. RUN: GMAIL_FETCH_EMAILS {"max_results": 5}.',
    'Only read or search unless the person has asked for a change. Before anything that sends, posts, deletes or edits, say what you will do and wait for their go-ahead.',
    `Use at most ${MAX_TOOL_STEPS} tool lines in total, then answer with no tool line. Say plainly when an app is not connected.`,
  ].join('\n')
}

// ---------------------------------------------------------------- prompts

export function buildSystemPrompt(bot: Bot, opts: { web?: boolean; roleText?: string } = {}): string {
  const memory = bot.memory.length ? bot.memory.map((m) => `- ${m}`).join('\n') : '- (nothing saved yet)'
  const parts = [
    `You are ${bot.name}, a persistent AI teammate. Stay in this role across the conversation.`,
    bot.job ? `Your job: ${bot.job}` : 'Your job has not been written yet. Ask what the person wants from you.',
    `Things you have been asked to remember:\n${memory}`,
  ]
  if (opts.roleText) parts.push(opts.roleText)
  if (opts.web) parts.push(webInstructions())
  else parts.push('Web access is off for you. You cannot browse the web, so do not claim that you looked anything up on it. If something needs a web source, say so.')
  parts.push(connectorInstructions())
  parts.push('Keep replies short unless the person asks for detail.')
  return parts.join('\n\n')
}

/**
 * The ECC working method for this reply: the bot's role family, with the members
 * chosen against the request and the bot's job. Async because the ECC prompts are
 * loaded on demand. A legacy role that cannot be resolved falls back to its stored
 * template, capped. Returns '' when the bot has no role.
 */
export async function roleMethodFor(bot: Bot, request: string): Promise<string> {
  if (!bot.role) return ''
  const family = familyForRole(bot.role)
  if (family) {
    const { text } = await roleText(family, request, bot.job)
    return text ? `Your role is ${family.name}. ${text}` : ''
  }
  return bot.role.prompt ? `Your working method, from the ${bot.role.name} role template:\n${bot.role.prompt.slice(0, MAX_ROLE_PROMPT)}` : ''
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
  const live = bot.webAccess
    ? 'You may search and read the web as described in your instructions. Say what you checked.'
    : 'You have no live access to the internet or to any app. Work from your memories and the recent conversation. If the routine needs live information, say that plainly instead of guessing.'
  return [
    `This is a scheduled routine named "${routine.title}". It is running at ${new Date(now).toLocaleString()}.`,
    `What to do: ${routine.instructions}`,
    live,
    'Write the result as a short note for the person. Begin with the result, not with a preamble.',
  ].join('\n\n')
}

// ---------------------------------------------------------------- group rooms

/** Whether a message calls this name, as "@Name". Case does not matter. */
export function mentionsName(text: string, name: string): boolean {
  const n = name.trim()
  if (!n) return false
  return text.toLowerCase().includes(`@${n.toLowerCase()}`)
}

export function roomMembers(room: Room, bots: Bot[]): Bot[] {
  return room.memberIds.map((id) => bots.find((b) => b.id === id)).filter((b): b is Bot => !!b)
}

/**
 * Who speaks next in a room. A bot named with @Name in the latest message speaks
 * if it has not spoken yet this round. When nobody is named, the first member
 * answers a person's message. After that, a round continues only by a bot naming
 * the next one, so the conversation cannot run away.
 */
export function pickSpeaker(room: Room, bots: Bot[], spoken: Set<string>): Bot | null {
  const members = roomMembers(room, bots)
  const last = room.thread[room.thread.length - 1]
  if (last) {
    const named = members.find((m) => !spoken.has(m.id) && mentionsName(last.text, m.name))
    if (named) return named
  }
  if (spoken.size === 0) return members[0] ?? null
  return null
}

export function isPass(text: string): boolean {
  return /^\s*\[pass\]\s*$/i.test(text)
}

export function buildRoomPrompt(room: Room, bot: Bot, bots: Bot[]): string {
  const names = roomMembers(room, bots).map((b) => b.name)
  const recent = room.thread.slice(-CONTEXT_MESSAGES).map((m) => {
    if (m.role === 'user') return `Person: ${m.text}`
    if (m.role === 'note') return `(note) ${m.text}`
    const who = bots.find((b) => b.id === m.botId)?.name ?? 'Bot'
    return `${who}: ${m.text}`
  })
  return [
    `You are in a group chat called "${room.name}" with: ${names.join(', ')}.`,
    `Your job: ${bot.job || '(not written yet)'}`,
    recent.length ? `Recent messages:\n${recent.join('\n')}` : 'Nobody has written yet.',
    `Reply as ${bot.name}, briefly, and only for your part of the work. If you have nothing useful to add, reply with exactly [pass]. To bring in a teammate, write @Name in your reply, using the name from the list above. Do not write for the others.`,
  ].join('\n\n')
}

export function createRoom(input: { name: string; memberIds: string[] }, now: number, id: string): { room?: Room; error?: string } {
  const memberIds = [...new Set(input.memberIds)]
  if (memberIds.length < 2) return { error: 'Pick at least two bots for the group.' }
  if (memberIds.length > MAX_ROOM_MEMBERS) return { error: `A group holds up to ${MAX_ROOM_MEMBERS} bots.` }
  return {
    room: { id, name: input.name.trim().slice(0, 60) || 'Group chat', memberIds, createdAt: now, thread: [] },
  }
}

// ---------------------------------------------------------------- projects and handoff

export function createProject(input: { name: string; brief: string; ownerId: string | null }, now: number, id: string): { project?: Project; error?: string } {
  const name = input.name.trim().slice(0, 80)
  if (!name) return { error: 'Name the project.' }
  const brief = input.brief.trim().slice(0, 4000)
  return {
    project: {
      id,
      name,
      brief,
      ownerId: input.ownerId,
      createdAt: now,
      log: [{ id: `${id}_0`, at: now, kind: 'created', ...(input.ownerId ? { toId: input.ownerId } : {}), text: brief || 'Project created.' }],
    },
  }
}

/** The project after a handoff: the new owner and a log line that keeps the brief. */
export function applyHandoff(project: Project, event: Omit<ProjectEvent, 'kind'>, toId: string): Project {
  return {
    ...project,
    ownerId: toId,
    log: [...project.log, { ...event, kind: 'handoff', toId }],
  }
}

export function buildHandoffPrompt(project: Project, from: Bot | undefined, to: Bot, note: string, fromThread: string[]): string {
  const log = project.log.slice(-12).map((e) => `- [${e.kind}] ${e.text}`).join('\n')
  return [
    `You are writing a handoff brief. ${from ? from.name : 'The previous owner'} is passing the project "${project.name}" to ${to.name}.`,
    `Project brief:\n${project.brief || '(none written)'}`,
    `Project log:\n${log || '(empty)'}`,
    fromThread.length ? `Recent work by ${from?.name ?? 'the previous owner'}:\n${fromThread.map((t) => `- ${t}`).join('\n')}` : '',
    note.trim() ? `Note from the person: ${note.trim()}` : '',
    `Write the brief for ${to.name} under these headings: Where it stands, What is done, Open questions, Next step. Keep it under 300 words. Use only what is written above; say so if something is missing.`,
  ].filter(Boolean).join('\n\n')
}

/** A brief made without the model: the project's own brief and the latest log lines. */
export function fallbackBrief(project: Project, from: Bot | undefined, note: string): string {
  const lines = [
    `Project: ${project.name}`,
    `From: ${from ? from.name : 'no previous owner'}`,
    project.brief ? `Brief: ${project.brief}` : 'Brief: (none written)',
    project.log.length ? `Latest log:\n${project.log.slice(-5).map((e) => `- ${e.text}`).join('\n')}` : '',
    note.trim() ? `Note from the person: ${note.trim()}` : '',
    'The model was not available, so this brief lists what was recorded, not a summary.',
  ]
  return lines.filter(Boolean).join('\n')
}

// ---------------------------------------------------------------- export and import

export const BOTS_FORMAT = 'research-engine.bots'

export interface BotsBundle {
  format: typeof BOTS_FORMAT
  version: 1
  exportedAt: number
  bots: Bot[]
  rooms: Room[]
  projects: Project[]
}

export function makeBundle(state: { bots: Bot[]; rooms: Room[]; projects: Project[] }, now: number): BotsBundle {
  return { format: BOTS_FORMAT, version: 1, exportedAt: now, bots: state.bots, rooms: state.rooms, projects: state.projects }
}

type Incoming = { bots: Bot[]; rooms: Room[]; projects: Project[] }

/** Check a file someone chose to import. Nothing is trusted until it has this shape. */
export function readBundle(raw: unknown): { ok: true; data: Incoming } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'That file is not a bots export.' }
  const o = raw as Record<string, unknown>
  if (o.format !== BOTS_FORMAT || o.version !== 1) return { ok: false, error: 'That file is not a bots export from Research Engine.' }
  const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
  const bots = Array.isArray(o.bots) ? o.bots : []
  if (bots.some((b) => !isObj(b) || typeof b.id !== 'string' || typeof b.name !== 'string')) {
    return { ok: false, error: 'A bot in that file has no id or name.' }
  }
  const rooms = Array.isArray(o.rooms) ? o.rooms : []
  const projects = Array.isArray(o.projects) ? o.projects : []
  if (rooms.some((r) => !isObj(r) || typeof r.id !== 'string' || !Array.isArray(r.memberIds))) {
    return { ok: false, error: 'A group in that file is malformed.' }
  }
  if (projects.some((p) => !isObj(p) || typeof p.id !== 'string' || typeof p.name !== 'string')) {
    return { ok: false, error: 'A project in that file is malformed.' }
  }
  const botsOut = (bots as Bot[]).map((b) => ({
    ...b,
    job: typeof b.job === 'string' ? b.job : '',
    createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
    memory: Array.isArray(b.memory) ? b.memory.filter((m) => typeof m === 'string') : [],
    thread: Array.isArray(b.thread) ? b.thread : [],
    routines: Array.isArray(b.routines) ? b.routines : [],
  }))
  return { ok: true, data: { bots: botsOut, rooms: rooms as Room[], projects: projects as Project[] } }
}

/**
 * Give every imported item a new id and point the references at the new ids, so
 * an import never overwrites something already on this device.
 */
export function remapIncoming(data: Incoming, newId: (prefix: string) => string): Incoming {
  const botMap = new Map<string, string>()
  for (const b of data.bots) botMap.set(b.id, newId('bot'))
  const bots = data.bots.map((b) => ({ ...b, id: botMap.get(b.id)! }))
  const rooms = data.rooms.map((r) => ({
    ...r,
    id: newId('room'),
    memberIds: r.memberIds.map((m) => botMap.get(m)).filter((m): m is string => !!m),
    thread: Array.isArray(r.thread) ? r.thread.map((m) => ({ ...m, botId: m.botId ? botMap.get(m.botId) ?? undefined : undefined })) : [],
  }))
  const projects = data.projects.map((p) => ({
    ...p,
    id: newId('proj'),
    ownerId: p.ownerId ? botMap.get(p.ownerId) ?? null : null,
    log: Array.isArray(p.log) ? p.log.map((e) => ({
      ...e,
      fromId: e.fromId ? botMap.get(e.fromId) : undefined,
      toId: e.toId ? botMap.get(e.toId) : undefined,
    })) : [],
  }))
  return { bots, rooms, projects }
}

/** A deterministic colour and initial for a bot, used when no avatar is set. */
export function botAvatar(name: string): { letter: string; hue: number } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { letter: (name.trim()[0] ?? '?').toUpperCase(), hue: h % 360 }
}
