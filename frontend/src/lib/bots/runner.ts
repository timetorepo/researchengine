import { LIMITS, clip } from '@/lib/context/budget'
/**
 * Runs a Bot: a reply in its thread, a turn in a group room, a handoff, or a
 * routine on its schedule. All of them use the model you have configured (the
 * same one as the rest of the app). A reply that is only a memory note
 * ("remember: …") is saved without calling the model.
 *
 * A bot with web access can ask for SEARCH or OPEN steps. The steps run here, in
 * the browser, through the server's web routes, and every step is kept with the
 * reply as a trace and a list of sources.
 *
 * Routines run while Research Engine is open. There is no server that keeps
 * them going when the app is closed, and the UI says so.
 */
import { generateText } from '@/lib/chat/generate'
import { useBots } from './store'
import { webOpen, webSearch } from './web'
import { looksLikeToolLine, useBotDrafts } from './drafts'
import { searchIntegrations } from '@/lib/integrations/client'
import { composioConfigured, isActiveAccount, listComposioAccounts, listComposioTools, runComposioTool } from '@/lib/composio/client'
import { serviceReady } from '@/lib/services/config'
import {
  buildHandoffPrompt, buildRoomPrompt, buildRoutinePrompt, buildSystemPrompt, buildTurnPrompt, dueRoutines, roleMethodFor,
  fallbackBrief, findToolCall, isPass, memoryCommand, pickSpeaker, stripToolLines, MAX_ROOM_TURNS, MAX_TOOL_STEPS,
  type Bot, type Project, type Routine, type Source, type Room, type ToolCall,
} from './logic'

const MODEL_MISSING = 'No model is set up. Connect a provider in Settings → Providers, then try again.'

type Model = { ok: true; text: string } | { ok: false; error: string }

async function model(system: string, prompt: string, maxTokens = 900, onChunk?: (text: string) => void): Promise<Model> {
  try {
    const res = await generateText({ system, prompt, temperature: 0.4, maxTokens, onChunk })
    if (res.usedDemo) return { ok: false, error: MODEL_MISSING }
    const text = res.text.trim()
    return text ? { ok: true, text } : { ok: false, error: 'The model returned nothing.' }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'The model did not answer.' }
  }
}

export type Reply = { ok: true; text: string; trace: string[]; sources: Source[] } | { ok: false; error: string; trace: string[]; sources: Source[] }

/**
 * One reply from a bot. The model may ask for up to MAX_TOOL_STEPS tool steps (web
 * search and page reads when web access is on; connected accounts and apps always).
 * Each result is added to the prompt, and the model writes the answer after them.
 */
export async function converse(bot: Bot, prompt: string, onDraft?: (text: string) => void): Promise<Reply> {
  const web = bot.webAccess === true
  const system = buildSystemPrompt(bot, { web, roleText: await roleMethodFor(bot, prompt), services: { seo: serviceReady('openseo'), crm: serviceReady('twenty'), social: serviceReady('postiz') } })
  const trace: string[] = []
  const sources: Source[] = []
  let transcript = prompt
  for (let step = 0; ; step++) {
    // The reply streams to the draft as it is written. A tool line is held back
    // (looksLikeToolLine), so only words the person should read are shown.
    let acc = ''
    const res = await model(system, transcript, 900, (chunk) => {
      acc += chunk
      if (onDraft && !looksLikeToolLine(acc)) onDraft(acc)
    })
    if (!res.ok) return { ok: false, error: res.error, trace, sources }
    const call = findToolCall(res.text, { web })
    if (!call || step >= MAX_TOOL_STEPS) {
      return { ok: true, text: stripToolLines(res.text) || res.text, trace, sources }
    }
    onDraft?.('')
    const result = await runToolCall(call, trace, sources)
    transcript += `\n\n${bot.name}: ${res.text}\n\n${clip(result, LIMITS.toolResultChars)}\n\nContinue. Answer, or use one more tool line if you must.`
  }
}

/** Run one tool step and return what the model will read. Every step is written to the trace. */
async function runToolCall(call: ToolCall, trace: string[], sources: Source[]): Promise<string> {
  if (call.kind === 'search') {
    trace.push(`Searched “${call.query}”`)
    const found = await webSearch(call.query)
    const result = found.ok
      ? (found.results.length
        ? found.results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join('\n')
        : 'The search found nothing.')
      : `The search failed: ${found.error}`
    if (found.ok) for (const r of found.results.slice(0, 3)) { if (!sources.some((s) => s.url === r.url)) sources.push({ title: r.title, url: r.url }) }
    return `Search results for “${call.query}”:\n${result}`
  }
  if (call.kind === 'open') {
    trace.push(`Opened ${call.url}`)
    const page = await webOpen(call.url)
    const body = page.ok
      ? `Page “${page.title}” (${page.url}, read ${page.via === 'browser' ? 'in the browser container' : 'directly'}):\n${page.text.slice(0, 6000)}`
      : `The page could not be read: ${page.error}`
    if (page.ok && !sources.some((s) => s.url === page.url)) sources.push({ title: page.title, url: page.url })
    return body
  }
  if (call.kind === 'find') {
    trace.push(`Searched accounts for “${call.query}”`)
    try {
      const reply = await searchIntegrations(call.query, { limit: 8 })
      const lines = reply.results.slice(0, 20).map((r, i) => `[${i + 1}] (${r.integration}) ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ''} · id ${r.id}`)
      const problems = reply.errors.map((e) => `${e.name}: ${e.error ?? 'not connected'}`)
      return [
        lines.length ? `Found in their accounts for “${call.query}”:\n${lines.join('\n')}` : `Nothing in their accounts matched “${call.query}”.`,
        problems.length ? `Could not search: ${problems.join('; ')}` : '',
      ].filter(Boolean).join('\n')
    } catch (e: any) {
      return `The search failed: ${String(e?.message ?? e)}`
    }
  }
  if (call.kind === 'docs') {
    trace.push(`Read the docs for ${call.library ?? call.query.slice(0, 40)}`)
    const { searchDocs } = await import('@/lib/context7/client')
    const res = await searchDocs(call.query, call.library)
    if (!res.ok) return `The documentation lookup failed: ${res.error}`
    if (!res.hits.length) return `No documentation matched “${call.query}”. Say so rather than guessing.`
    return clip(res.hits.map((h) => [`${h.library} — ${h.title}`.trim(), h.info, ...h.code.map((c) => '```\n' + c + '\n```')].filter(Boolean).join('\n')).join('\n\n'), LIMITS.toolResultChars)
  }
  if (call.kind === 'apps') {
    trace.push('Checked connected apps')
    if (!composioConfigured()) return 'Composio is not set up. The person can add the project key in the Marketplace, in the sidebar.'
    try {
      const active = (await listComposioAccounts()).filter(isActiveAccount)
      return active.length ? `Connected apps: ${active.map((a) => a.toolkit).join(', ')}.` : 'No apps are connected yet.'
    } catch (e: any) {
      return `Could not list the apps: ${String(e?.message ?? e)}`
    }
  }
  if (call.kind === 'tools') {
    trace.push(`Listed actions for ${call.app}`)
    try {
      const tools = await listComposioTools(call.app)
      if (!tools.length) return `${call.app} has no actions listed.`
      return `Actions for ${call.app}:\n${tools.slice(0, 40).map((t) => `${t.slug} — ${t.description || t.name}`).join('\n')}`
    } catch (e: any) {
      return `Could not list the actions: ${String(e?.message ?? e)}`
    }
  }
  if (call.kind === 'seo_domain' || call.kind === 'seo_keywords') {
    if (!serviceReady('openseo')) return 'OpenSEO is not set up. The person can add its key under Marketplace → Built in.'
    const svc = await import('@/lib/services/client')
    if (call.kind === 'seo_domain') {
      trace.push(`SEO overview for ${call.domain}`)
      const res = await svc.seoDomain(call.domain)
      return res.ok ? clip(`SEO overview for ${call.domain} (estimates from OpenSEO):\n${JSON.stringify(res.data.result)}`, LIMITS.toolResultChars) : `The SEO lookup failed: ${res.error}`
    }
    trace.push(`Keyword ideas for ${call.seeds.join(', ')}`)
    const res = await svc.seoKeywords(call.seeds)
    return res.ok ? clip(`Keyword ideas (OpenSEO):\n${JSON.stringify(res.data.result)}`, LIMITS.toolResultChars) : `The keyword research failed: ${res.error}`
  }
  if (call.kind === 'crm_find' || call.kind === 'crm_add') {
    if (!serviceReady('twenty')) return 'Twenty CRM is not set up. The person can add its key under Marketplace → Built in.'
    const svc = await import('@/lib/services/client')
    if (call.kind === 'crm_find') {
      trace.push(`CRM search “${call.query}”`)
      const res = await svc.crmSearch(call.companies ? 'companies' : 'people', call.query)
      if (!res.ok) return `The CRM search failed: ${res.error}`
      return res.data.records.length ? res.data.records.map((r, i) => `[${i + 1}] ${r.name}${r.detail ? ` — ${r.detail}` : ''} · id ${r.id}`).join('\n') : `Nothing in the CRM matched “${call.query}”.`
    }
    const kind = call.record.kind
    if (kind !== 'people' && kind !== 'companies' && kind !== 'notes') return 'CRM: ADD needs "kind" to be people, companies or notes.'
    trace.push(`CRM add (${kind})`)
    const res = await svc.crmCreate(call.record as any)
    return res.ok ? `Added to the CRM (id ${res.data.id}).` : `The CRM could not add it: ${res.error}`
  }
  if (call.kind === 'social_channels' || call.kind === 'social_draft') {
    if (!serviceReady('postiz')) return 'Postiz is not set up. The person can add its key under Marketplace → Built in.'
    const svc = await import('@/lib/services/client')
    if (call.kind === 'social_channels') {
      trace.push('Listed social channels')
      const res = await svc.socialChannels()
      if (!res.ok) return `Could not list the channels: ${res.error}`
      return res.data.channels.length ? res.data.channels.map((c) => `${c.id} — ${c.name} (${c.identifier})${c.disabled ? ' [disabled]' : ''}`).join('\n') : 'No channels are connected in Postiz yet.'
    }
    trace.push('Saved a social draft')
    const res = await svc.socialDraft(call.channelId, call.text)
    return res.ok ? `Saved a draft on ${res.data.channel}. Nothing was published.` : `The draft was not saved: ${res.error}`
  }
  // run
  trace.push(`Ran ${call.tool}`)
  const res = await runComposioTool(call.tool, call.args)
  if (!res.ok) return `The action failed: ${res.error}`
  return `Result of ${call.tool}:\n${JSON.stringify(res.data ?? null).slice(0, 6000)}`
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
  const key = `bot:${botId}`
  const drafts = useBotDrafts.getState()
  drafts.set(key, { text: '' })
  let res: Reply
  try {
    res = await converse(fresh, turn, (t) => useBotDrafts.getState().set(key, { text: t }))
  } finally {
    useBotDrafts.getState().set(key, null)
  }
  if (res.ok) {
    store.say(botId, { role: 'bot', text: res.text, ...(res.trace.length ? { trace: res.trace } : {}), ...(res.sources.length ? { sources: res.sources } : {}) })
  } else {
    store.say(botId, { role: 'note', text: res.error })
  }
}

/** Run one routine now, record the result, and set its next time. */
export async function runRoutine(botId: string, routineId: string): Promise<void> {
  const bot = useBots.getState().bots.find((b) => b.id === botId)
  const routine = bot?.routines.find((r) => r.id === routineId)
  if (!bot || !routine) return
  const at = Date.now()
  const res = await converse(bot, buildRoutinePrompt(bot, routine, at))
  const store = useBots.getState()
  store.recordRun(botId, routineId, { at, ok: res.ok, text: res.ok ? res.text : res.error })
  store.say(botId, res.ok
    ? { role: 'bot', text: `${routine.title}: ${res.text}`, routineId, ...(res.sources.length ? { sources: res.sources } : {}) }
    : { role: 'note', text: `${routine.title} did not run: ${res.error}`, routineId })
}

/**
 * One round in a group room. A person's message starts it; a bot can call on the
 * next teammate with @Name. A round stops at MAX_ROOM_TURNS, when nobody is
 * called on, or when a reply is [pass] with no one named.
 */
export async function runRoomTurn(roomId: string, text: string): Promise<void> {
  const store = useBots.getState()
  if (!store.rooms.some((r) => r.id === roomId)) return
  store.postRoom(roomId, { role: 'user', text })
  const spoken = new Set<string>()
  const key = `room:${roomId}`
  for (let turn = 0; turn < MAX_ROOM_TURNS; turn++) {
    const now = useBots.getState()
    const room = now.rooms.find((r) => r.id === roomId)
    if (!room) return
    const speaker = pickSpeaker(room, now.bots, spoken)
    if (!speaker) break
    spoken.add(speaker.id)
    useBotDrafts.getState().set(key, { botId: speaker.id, text: '' })
    let res: Reply
    try {
      res = await converse(speaker, buildRoomPrompt(room, speaker, now.bots), (t) => useBotDrafts.getState().set(key, { botId: speaker.id, text: t }))
    } finally {
      useBotDrafts.getState().set(key, null)
    }
    if (!res.ok) {
      now.postRoom(roomId, { role: 'note', text: `${speaker.name} did not answer: ${res.error}` })
      break
    }
    if (isPass(res.text)) {
      // A pass adds nothing. The round ends after it unless the last message named someone.
      continue
    }
    now.postRoom(roomId, {
      role: 'bot',
      botId: speaker.id,
      text: res.text,
      ...(res.trace.length ? { trace: res.trace } : {}),
      ...(res.sources.length ? { sources: res.sources } : {}),
    })
  }
}

/**
 * Hand a project to another bot. The current owner writes a brief for the new
 * one; if the model is not available, a plain brief is made from the project's
 * own record instead, and the result says so.
 */
export async function handOffProject(projectId: string, toBotId: string, note: string): Promise<{ ok: boolean; message: string }> {
  const state = useBots.getState()
  const project = state.projects.find((p) => p.id === projectId)
  const to = state.bots.find((b) => b.id === toBotId)
  if (!project || !to) return { ok: false, message: 'That project or bot is gone.' }
  const from = project.ownerId ? state.bots.find((b) => b.id === project.ownerId) : undefined
  if (from && from.id === to.id) return { ok: false, message: `${to.name} already owns this project.` }
  const fromThread = from ? from.thread.filter((m) => m.role !== 'note').slice(-8).map((m) => `${m.role === 'user' ? 'Person' : from.name}: ${m.text}`) : []
  const res = await model(
    'You write short, accurate handoff briefs for teammates. Use only what you are given.',
    buildHandoffPrompt(project, from, to, note, fromThread),
    700,
  )
  const brief = res.ok ? res.text : fallbackBrief(project, from, note)
  const store = useBots.getState()
  store.handOffProject(projectId, toBotId, { text: `Handed to ${to.name}${note.trim() ? `: ${note.trim()}` : '.'}`, fromId: from?.id })
  store.say(to.id, { role: 'note', text: `Project “${project.name}” was handed to you${from ? ` by ${from.name}` : ''}.\n\n${brief}` })
  if (from) store.say(from.id, { role: 'note', text: `You handed “${project.name}” to ${to.name}.` })
  return {
    ok: true,
    message: res.ok
      ? `${to.name} now owns “${project.name}”.`
      : `${to.name} now owns “${project.name}”. The model was not available, so the brief is a plain record.`,
  }
}

let timer: number | undefined
let running = false

/** Checks every 30 seconds for routines that are due, and runs them one at a time. Idempotent. Paused routines do not run. */
export function startBotScheduler(): void {
  if (timer !== undefined || typeof window === 'undefined') return
  const tick = async () => {
    if (running) return
    if (useBots.getState().settings.paused) return
    running = true
    try {
      const due = dueRoutines(useBots.getState().bots, Date.now())
      for (const { bot, routine } of due) {
        if (useBots.getState().settings.paused) break
        await runRoutine(bot.id, routine.id)
      }
    } finally {
      running = false
    }
  }
  timer = window.setInterval(() => { void tick() }, 30000)
  void tick()
}

export type { Routine, Bot, Project, Room }
