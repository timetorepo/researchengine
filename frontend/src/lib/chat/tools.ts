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
import { serviceReady, permittedVoice } from '@/lib/services/config'

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
  /**
   * Called once per finished tool call with what the card needs: the text the
   * model got, and the structured data when the tool had it. Drives the result cards.
   */
  onResult?: (r: { tool: string; args: Record<string, unknown>; text: string; data?: unknown; ok: boolean }) => void
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
  /** How long a `run` took, in milliseconds. Optional — only `run` sets it. */
  ms?: number
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
  /** Only offered when this returns true, so an unset-up service adds nothing to the prompt. */
  when?: () => boolean
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
    name: 'show_tooltip_card',
    description: 'Put one or more small reference cards in the answer, attached to a term, a definition, a date or a source the reader may want to open. Use it when a specific thing in your answer deserves more context than a sentence: a person, a place, a paper, a term of art, a figure. Each card has a title and any of body (one supporting line), image (a URL, only when you know one that exists), source (the site or paper it comes from) and url. The card appears as a chip under the answer and opens on hover or focus. Do NOT use this for decoration, and do not invent image URLs: a card with a title and a source is more useful than a broken picture. If you cannot call tools, no card appears, which is intended.',
    parameters: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          description: '1 to 5 cards',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'The term, name or fact the card is about' },
              body: { type: 'string', description: 'One line of context: a definition, a date, a caveat' },
              image: { type: 'string', description: 'Optional image URL you are confident exists' },
              source: { type: 'string', description: 'Where the information comes from: site, paper, book' },
              url: { type: 'string', description: 'Optional link the reader can open' },
            },
            required: ['title'],
          },
        },
      },
      required: ['cards'],
    },
    run: async (args, ctx) => {
      const cards = (Array.isArray(args?.cards) ? args.cards : []).slice(0, 5).map((c: any) => ({
        title: String(c?.title ?? '').slice(0, 120),
        body: c?.body ? String(c.body).slice(0, 240) : undefined,
        image: c?.image ? String(c.image) : undefined,
        source: c?.source ? String(c.source).slice(0, 120) : undefined,
        url: c?.url ? String(c.url) : undefined,
      })).filter((c: any) => c.title)
      if (!cards.length) return 'No cards were provided.'
      const current = useStore.getState().chats.find((ch) => ch.id === ctx.chatId)?.messages.find((m) => m.id === ctx.asstId)
      const existing = current?.tooltipCards ?? []
      useStore.getState().updateMessage(ctx.chatId, ctx.asstId, { tooltipCards: [...existing, ...cards].slice(0, 8) })
      return `Showed ${cards.length} card${cards.length === 1 ? '' : 's'}: ${cards.map((c: any) => c.title).join('; ')}`
    },
  },
  {
    name: 'integration_search',
    description: 'Search the user\'s CONNECTED ACCOUNTS — Google Drive, Gmail, Google Calendar, GitHub, Notion, Slack — plus their local Research Engine files. Returns real items with ids you can open with integration_read. If an account is not connected the call says so: tell the user which one to connect instead of guessing at its contents.',
    parameters: {
      type: 'object',
      properties: {
        query: opt('string', 'What to look for — keywords, a name, a subject'),
        integrations: opt('string', 'Comma-separated subset: files,drive,gmail,gcal,github,notion,slack (omit for every connected one)'),
        limit: opt('number', 'How many items per integration (default 8, max 25)'),
      },
      required: ['query'],
    },
    run: async (args) => {
      const { searchIntegrations } = await import('@/lib/integrations/client')
      try {
        const ids = String(args?.integrations ?? '').split(',').map((s: string) => s.trim()).filter(Boolean) as any[]
        const reply = await searchIntegrations(String(args?.query ?? ''), {
          ids: ids.length ? ids : undefined,
          limit: Math.max(1, Math.min(25, Number(args?.limit) || 8)),
        })
        return JSON.stringify({
          query: reply.q,
          results: reply.results.slice(0, 40),
          // Errors are part of the answer: "not connected" is not "no results".
          problems: reply.errors,
          connected: reply.connected ?? [],
        }).slice(0, 12_000)
      } catch (e: any) {
        return `Integration search failed: ${String(e?.message ?? e)}`
      }
    },
  },
  {
    name: 'integration_read',
    description: 'Open one item from a connected account by its id (from integration_search): a Gmail message body, the text of a Google Doc, a Calendar event, a GitHub file, a Notion page or a Slack thread.',
    parameters: {
      type: 'object',
      properties: { integration: opt('string', 'files | drive | gmail | gcal | github | notion | slack'), id: opt('string', 'Item id from integration_search') },
      required: ['integration', 'id'],
    },
    run: async (args) => {
      const { readIntegrationItem } = await import('@/lib/integrations/client')
      try {
        const item = await readIntegrationItem(String(args?.integration ?? '') as any, String(args?.id ?? ''))
        return JSON.stringify({ title: item.title, url: item.url, text: item.text.slice(0, 12_000) })
      } catch (e: any) {
        return `Could not read that item: ${String(e?.message ?? e)}`
      }
    },
  },
  {
    name: 'composio_apps',
    description: 'List the apps the user has CONNECTED through Composio (Gmail, Slack, GitHub, Notion, Linear and any other app they signed into under Connectors). Call this first to see what is available. If the app a person asks about is not listed, say so and tell them to connect it under Connectors; do not guess.',
    parameters: { type: 'object', properties: {}, required: [] },
    run: async () => {
      const { composioConfigured, listComposioAccounts, isActiveAccount } = await import('@/lib/composio/client')
      if (!composioConfigured()) return 'Composio is not set up. Add the project key under Connectors in the sidebar.'
      try {
        const active = (await listComposioAccounts()).filter(isActiveAccount)
        return active.length ? JSON.stringify({ connected: active.map((a) => ({ app: a.toolkit, alias: a.alias ?? null })) }) : 'No apps are connected yet. Connect one under Connectors in the sidebar.'
      } catch (e: any) {
        return `Could not list connected apps: ${String(e?.message ?? e)}`
      }
    },
  },
  {
    name: 'composio_tools',
    description: 'List the actions one connected app offers (for example gmail, slack, github). Returns tool names such as GMAIL_FETCH_EMAILS with what each does. Use one of these names with composio_run.',
    parameters: {
      type: 'object',
      properties: { app: opt('string', 'App slug, e.g. gmail, slack, github, notion') },
      required: ['app'],
    },
    run: async (args) => {
      const { listComposioTools } = await import('@/lib/composio/client')
      try {
        const tools = await listComposioTools(String(args?.app ?? '').trim().toLowerCase())
        return JSON.stringify({ app: args?.app, tools: tools.slice(0, 60) }).slice(0, 12_000)
      } catch (e: any) {
        return `Could not list the actions: ${String(e?.message ?? e)}`
      }
    },
  },
  {
    name: 'composio_run',
    description: 'Run one action of a CONNECTED app (name from composio_tools, e.g. GMAIL_FETCH_EMAILS) with its arguments as a JSON object. Read actions are fine to run for the person. Before an action that sends, posts, deletes or changes something, say what you will do and wait for their go-ahead.',
    parameters: {
      type: 'object',
      properties: {
        tool: opt('string', 'Action name, e.g. GMAIL_FETCH_EMAILS'),
        arguments: opt('string', 'JSON object of arguments for the action, e.g. {"max_results": 5}'),
      },
      required: ['tool'],
    },
    run: async (args, ctx) => {
      const { runComposioTool } = await import('@/lib/composio/client')
      let input: Record<string, unknown> = {}
      const raw = args?.arguments
      if (typeof raw === 'string' && raw.trim()) {
        try { input = JSON.parse(raw) } catch { return 'The arguments must be a JSON object.' }
      } else if (raw && typeof raw === 'object') {
        input = raw as Record<string, unknown>
      }
      const res = await runComposioTool(String(args?.tool ?? ''), input)
      // The structured result goes to the card; the model gets the clipped text.
      if (res.ok) (ctx as any)?.__setData?.(res.data ?? null)
      return res.ok ? JSON.stringify(res.data ?? null).slice(0, 12_000) : `The action failed: ${res.error}`
    },
  },
  {
    name: 'docs_search',
    description: 'Look up CURRENT documentation and code examples for a library, framework or API (Context7). Use it before writing code against a library, or when a question is about how a specific version of a tool behaves. Give the question and optionally the library name, e.g. query "stream a response in Next.js route handlers", library "next.js". Cite the library and version in the answer.',
    parameters: {
      type: 'object',
      properties: {
        query: opt('string', 'What you need to know, in plain words'),
        library: opt('string', 'Optional library or framework name(s), comma-separated'),
      },
      required: ['query'],
    },
    run: async (args) => {
      const { searchDocs } = await import('@/lib/context7/client')
      const res = await searchDocs(String(args?.query ?? ''), args?.library ? String(args.library) : undefined)
      if (!res.ok) return `Documentation lookup failed: ${res.error}`
      if (!res.hits.length) return 'No documentation matched. Say so rather than guessing.'
      return JSON.stringify(res.hits).slice(0, 12_000)
    },
  },
  {
    name: 'seo_domain',
    description: 'Look up SEO data for a website from OpenSEO: estimated organic traffic, the number of keywords it ranks for, backlinks and referring domains. Use it when someone asks how a site performs in search or who it competes with. Give the domain, e.g. example.com. Report the figures as estimates from the data provider.',
    parameters: {
      type: 'object',
      properties: { domain: opt('string', 'Domain or URL, e.g. example.com') },
      required: ['domain'],
    },
    when: () => serviceReady('openseo'),
    run: async (args) => {
      const { seoDomain } = await import('@/lib/services/client')
      const res = await seoDomain(String(args?.domain ?? ''))
      return res.ok ? JSON.stringify(res.data.result).slice(0, 12_000) : `OpenSEO lookup failed: ${res.error}`
    },
  },
  {
    name: 'seo_keywords',
    description: 'Research keywords with OpenSEO for up to five seed phrases: related keywords with search volume, difficulty and cost per click. Use it for keyword ideas or to size a topic before writing about it.',
    parameters: {
      type: 'object',
      properties: { seeds: { type: 'array', items: STR, description: '1 to 5 seed keywords' } },
      required: ['seeds'],
    },
    when: () => serviceReady('openseo'),
    run: async (args) => {
      const seeds = Array.isArray(args?.seeds) ? args.seeds.map((x: unknown) => String(x)).slice(0, 5) : []
      if (!seeds.length) return 'Give at least one seed keyword.'
      const { seoKeywords } = await import('@/lib/services/client')
      const res = await seoKeywords(seeds)
      return res.ok ? JSON.stringify(res.data.result).slice(0, 12_000) : `OpenSEO research failed: ${res.error}`
    },
  },
  {
    name: 'crm_search',
    description: 'Find people or companies in the person\'s CRM (Twenty) by name. Returns matching records with their ids.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['people', 'companies'], description: 'Which records to search' },
        query: opt('string', 'Name or part of a name'),
      },
      required: ['query'],
    },
    when: () => serviceReady('twenty'),
    run: async (args) => {
      const { crmSearch } = await import('@/lib/services/client')
      const res = await crmSearch(args?.kind === 'companies' ? 'companies' : 'people', String(args?.query ?? ''))
      if (!res.ok) return `CRM search failed: ${res.error}`
      return res.data.records.length ? JSON.stringify(res.data.records) : 'Nothing in the CRM matched.'
    },
  },
  {
    name: 'crm_create',
    description: 'Create a person, a company or a note in the CRM (Twenty). Only do this when the person has asked you to add it and has given you the details. Never guess an email address or company name.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['people', 'companies', 'notes'] },
        firstName: opt('string', 'People: first name'),
        lastName: opt('string', 'People: last name'),
        email: opt('string', 'People: email address'),
        jobTitle: opt('string', 'People: job title'),
        name: opt('string', 'Companies: company name'),
        domain: opt('string', 'Companies: website domain'),
        title: opt('string', 'Notes: title'),
        body: opt('string', 'Notes: text, in plain words or Markdown'),
      },
      required: ['kind'],
    },
    when: () => serviceReady('twenty'),
    run: async (args) => {
      const kind = args?.kind === 'companies' || args?.kind === 'notes' ? args.kind : 'people'
      const { crmCreate } = await import('@/lib/services/client')
      const res = await crmCreate({ ...args, kind } as any)
      return res.ok ? `Created the ${kind === 'people' ? 'person' : kind === 'companies' ? 'company' : 'note'} (id ${res.data.id}).` : `CRM could not create it: ${res.error}`
    },
  },
  {
    name: 'social_channels',
    description: 'List the social channels connected in Postiz (for example X, LinkedIn, a blog). Call it before social_draft to get a channel id.',
    parameters: { type: 'object', properties: {} },
    when: () => serviceReady('postiz'),
    run: async () => {
      const { socialChannels } = await import('@/lib/services/client')
      const res = await socialChannels()
      if (!res.ok) return `Could not list the channels: ${res.error}`
      return res.data.channels.length
        ? JSON.stringify(res.data.channels.map((c) => ({ id: c.id, name: c.name, platform: c.identifier, disabled: c.disabled })))
        : 'No channels are connected in Postiz yet.'
    },
  },
  {
    name: 'social_draft',
    description: 'Save a DRAFT post on one connected channel in Postiz. Drafts only: nothing is published or scheduled, and the person does that in Postiz. Write the text for that platform\'s length and style.',
    parameters: {
      type: 'object',
      properties: {
        channelId: opt('string', 'The channel id from social_channels'),
        text: opt('string', 'The post text'),
      },
      required: ['channelId', 'text'],
    },
    when: () => serviceReady('postiz'),
    run: async (args) => {
      const { socialDraft } = await import('@/lib/services/client')
      const res = await socialDraft(String(args?.channelId ?? ''), String(args?.text ?? ''))
      return res.ok ? `Saved a draft on ${res.data.channel} (post ${res.data.postId || 'created'}). It is in Postiz; nothing was published.` : `The draft was not saved: ${res.error}`
    },
  },
  {
    name: 'voice_speak',
    description: 'Speak text aloud with a voice from VoiceStudio and play it in the app. Use a built-in voice name ("default", "alloy", "nova" and so on), or the name of a voice the person has cloned with their permission. You cannot clone a voice yourself: cloning is always started by the person.',
    parameters: {
      type: 'object',
      properties: {
        voice: opt('string', 'Built-in voice name, or a cloned voice name the person has permitted'),
        text: opt('string', 'What the voice should say'),
      },
      required: ['text'],
    },
    when: () => serviceReady('voicestudio'),
    run: async (args) => {
      const text = String(args?.text ?? '').trim()
      if (!text) return 'Say what the voice should read.'
      const requested = String(args?.voice ?? 'default').trim() || 'default'
      const consent = permittedVoice(requested)
      const builtIn = /^(default|alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer|verse|marin|cedar)$/i.test(requested)
      if (!consent && !builtIn) return `There is no permitted voice called “${requested}”. Use a built-in voice, or a voice the person cloned with their permission.`
      const { voiceSpeak } = await import('@/lib/services/client')
      const res = await voiceSpeak(consent ? consent.voiceId : requested, text)
      if (!res.ok) return `Speech failed: ${res.error}`
      const url = URL.createObjectURL(res.data.blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      void audio.play().catch(() => { /* the person can press play in the app if the browser blocks it */ })
      return `Spoke the text with ${consent ? `the cloned voice “${consent.speaker}”` : `the “${requested}” voice`}. It is playing in the app.`
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
  {
    name: 'library_search',
    description: 'Search the app\'s own small search engine: the live web, Wikipedia, design references (Awwwards, Dribbble, Refero, Mobbin), app-interface patterns — including the components this app can install, each with the exact command that installs it — and the documentation index. Returns hits labelled by vertical — say which vertical a claim came from. Use for anything the user wants sources for, and for "how do other apps do this screen" questions.',
    parameters: {
      type: 'object',
      properties: {
        query: STR,
        vertical: { type: 'string', enum: ['all', 'web', 'wikipedia', 'screens', 'ui', 'docs'], description: 'Limit to one vertical; "all" is the default.' },
      },
      required: ['query'],
    },
    run: async (args) => {
      const query = String(args?.query ?? '').trim()
      const want = String(args?.vertical ?? 'all')
      if (query.length < 2) return 'A query of at least two characters is required.'
      // The component index ships inside the app, so it answers even when the
      // server does not — and it is the half of this tool that is about the
      // interfaces the user could actually install.
      const { componentHits } = await import('@/lib/design/component-search')
      const components = (want === 'all' || want === 'ui') ? componentHits(query, 4) : []
      const shape = (h: any) => ({ title: h.title, url: h.url, snippet: h.snippet, source: h.source, ...(h.install ? { install: h.install } : {}) })
      // Search the local server first; if it is not up, the same ladder the chat
      // uses still answers for the web vertical instead of failing outright.
      try {
        const grab = async () => {
          const res = await fetch(`/api/library/mini-search?q=${encodeURIComponent(query)}`)
          if (!res.ok) throw new Error(String(res.status))
          return await res.json() as { results: any[]; pending?: string[]; tookMs: number }
        }
        let out = await grab()
        if (out.pending?.length) { await new Promise((r) => setTimeout(r, 1200)); out = await grab() }
        const results = (out.results ?? [])
          .filter((g) => want === 'all' || g.vertical === want)
          .map((g) => ({
            vertical: g.vertical,
            state: g.state,
            reason: g.reason,
            note: g.note,
            hits: (g.vertical === 'ui' ? [...components, ...(g.hits ?? [])] : (g.hits ?? [])).slice(0, 6).map(shape),
          }))
        // A vertical the server knows nothing about would leave the local hits
        // unreachable when the query is narrowed to `ui`.
        if (components.length && !results.some((g) => g.vertical === 'ui')) {
          results.unshift({ vertical: 'ui', state: 'ok', reason: undefined as any, note: 'From this app\'s own component catalog.', hits: components.slice(0, 6).map(shape) } as any)
        }
        return JSON.stringify({ query, tookMs: out.tookMs, results }).slice(0, 9000)
      } catch (e: any) {
        const { webSearch } = await import('@/lib/search/web')
        const outcome = await webSearch(query, 5).catch(() => null)
        if (!outcome) return `The app's search could not run: ${String(e?.message ?? e)}`
        return JSON.stringify({
          query, degraded: 'The local server was unreachable, so only the web vertical and the app\'s own component catalog ran.',
          results: [
            ...(components.length ? [{ vertical: 'ui', state: 'ok', note: 'From this app\'s own component catalog, which ships with the app.', hits: components.map(shape) }] : []),
            { vertical: 'web', state: 'ok', hits: outcome.sources.map((s) => ({ title: s.title, url: s.url, snippet: s.snippet })) },
          ],
        }).slice(0, 9000)
      }
    },
  },
  {
    name: 'library_read',
    description: 'Read a source as text. Wikipedia is read through its own API (clean article sections); any other page is reduced to headings, paragraphs, lists, quotes and code. Returns the sections and a word count, or explains that the page is rendered by its own JavaScript and cannot be reduced.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'The full URL to read.' } }, required: ['url'] },
    run: async (args) => {
      const url = String(args?.url ?? '').trim()
      if (!url) return 'A url is required.'
      try {
        const res = await fetch(`/api/library/read?url=${encodeURIComponent(url)}`)
        const json: any = await res.json()
        if (!json) return `The reader answered HTTP ${res.status} without JSON.`
        const text = (json.blocks ?? [])
          .map((b: any) => b.type === 'heading' ? `\n## ${b.text}\n` : b.type === 'list' ? b.items.map((i: string) => `- ${i}`).join('\n') : b.type === 'quote' ? `> ${b.text}` : b.type === 'code' ? `\`\`\`\n${b.text}\n\`\`\`` : b.text)
          .join('\n\n')
        return JSON.stringify({ ok: json.ok, via: json.via, title: json.title, wordCount: json.wordCount, minutes: json.minutes, warning: json.warning, outline: json.outline, text: text.slice(0, 12000) })
      } catch (e: any) {
        return `Reading ${url} failed: ${String(e?.message ?? e)}`
      }
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
      const startedAt = Date.now()
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
      const ms = Date.now() - startedAt
      emitActivity({ agent: ctx.agent ?? null, project: ctx.project, kind: 'run', command, ms, note: `exit ${out.exit ?? '?'}` })
      return JSON.stringify({ exit: out.exit, ms, timedOut: out.timedOut, stdout: (out.stdout ?? '').slice(0, 6000), stderr: (out.stderr ?? '').slice(0, 2000) })
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
    name: 'open_section',
    description: 'Open a part of Research Engine for the user: "quiz" (Learn), "coding" (the coding workspace), "chats" (sessions) or "library" (sources). Use it when the user would benefit from that section. It changes nothing else.',
    parameters: {
      type: 'object',
      properties: { section: opt('string', 'quiz, coding, chats or library') },
      required: ['section'],
    },
    run: async (args) => {
      const to = ({ quiz: '/quiz', coding: '/code', chats: '/chats', library: '/library' } as Record<string, string>)[String(args?.section ?? '')]
      if (!to) return 'Unknown section. Use quiz, coding, chats or library.'
      window.dispatchEvent(new CustomEvent('re-navigate', { detail: to }))
      return `Opened ${String(args.section)} for the user.`
    },
  },
  {
    name: 'session_sandbox',
    description: 'Run work for this session inside its own isolated container or VM instead of on the host. Actions: status (what this machine can run), start (create the session sandbox), exec (run one shell command inside it), stop (remove it). target is "docker" (default) or "vm". Start one only when the task needs isolation, and tell the user you did.',
    parameters: {
      type: 'object',
      properties: {
        action: opt('string', 'status, start, exec or stop'),
        target: opt('string', 'docker (default) or vm'),
        command: opt('string', 'For exec: the shell command to run inside the sandbox'),
      },
      required: ['action'],
    },
    run: async (args, ctx) => {
      const json = { 'content-type': 'application/json' }
      const probe = await fetch('/api/sandbox/probe').then((r) => r.json()).catch(() => null)
      const action = String(args?.action ?? '')
      if (action === 'status') return JSON.stringify(probe ?? { error: 'probe unreachable' })
      const vm = String(args?.target ?? '').toLowerCase() === 'vm'
      const label = vm ? 'VM (multipass)' : 'Docker'
      if (!(vm ? probe?.vm : probe?.docker)) {
        return `${label} is not available on this machine: ${vm ? probe?.vmDetail : probe?.dockerDetail ?? 'probe failed'}. Work on the host, or ask the user to install it.`
      }
      const base = vm ? '/api/sandbox/vm' : '/api/sandbox/container'
      if (action === 'start') {
        const r = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ id: ctx.chatId }) }).then((x) => x.json())
        if (!r.ok) return `Could not start the ${label} sandbox: ${r.error}`
        const name = r.container ?? r.vm
        useStore.setState((s) => ({ chats: s.chats.map((c) => c.id === ctx.chatId ? { ...c, session: { isolation: vm ? 'vm' as const : 'docker' as const, container: name } } : c) }))
        return `Session sandbox ${name} is running (${label}, isolated from the host).`
      }
      if (action === 'exec') {
        const cmd = String(args?.command ?? '').trim()
        if (!cmd) return 'exec needs a command.'
        const r = await fetch(vm ? '/api/sandbox/vm-exec' : '/api/sandbox/exec', { method: 'POST', headers: json, body: JSON.stringify({ id: ctx.chatId, cmd }) }).then((x) => x.json())
        return JSON.stringify(r.ok ? { stdout: r.stdout, stderr: r.stderr } : { error: r.error, stderr: r.stderr })
      }
      if (action === 'stop') {
        await fetch(base, { method: 'DELETE', headers: json, body: JSON.stringify({ id: ctx.chatId }) }).catch(() => {})
        useStore.setState((s) => ({ chats: s.chats.map((c) => c.id === ctx.chatId ? { ...c, session: undefined } : c) }))
        return `Session ${label} sandbox removed.`
      }
      return 'Unknown action. Use status, start, exec or stop.'
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
    .filter((t) => (!t.needsProject || !!ctx.project) && (!t.when || t.when()))
    .map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
}

/** Execute one tool call; returns the text result to feed back to the model. */
export async function executeTool(call: ToolCall, ctx: ToolContext, trace: (label: string, status: 'ok' | 'error' | 'blocked' | 'confirm') => void): Promise<string> {
  const def = TOOLS.find((t) => t.name === call.name)
  if (!def) return `Unknown tool: ${call.name}`
  if (def.needsProject && !ctx.project) return 'This tool needs an open project in Coding mode.'
  if (def.when && !def.when()) return `${def.name} is not set up. Add it under Connectors → Built in.`
  let args: any = call.arguments
  if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = { input: args } } }
  args = args ?? {}
  let structured: unknown = undefined
  const fullCtx = { ...ctx, __toolCallId: call.id, __setData: (d: unknown) => { structured = d } } as any
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
    else if (def.name === 'docs_search') trace(`docs: ${String(args.query ?? '').slice(0, 44)}`, 'ok')
    else if (def.name.startsWith('composio')) trace(`${def.name === 'composio_run' ? 'run' : 'connectors'} ${String(args.tool ?? args.app ?? '')}`.slice(0, 60), 'ok')
    else if (def.name.startsWith('connector')) trace(`${def.name === 'connector_search' ? 'search' : 'read'} ${String(args.box ?? args.query ?? '')}`.slice(0, 60), 'ok')
    else if (def.name === 'web_search') trace(`web search: ${String(args.query ?? '').slice(0, 50)}`, 'ok')
    else if (def.name === 'library_search') trace(`library search: ${String(args.query ?? '').slice(0, 44)}`, 'ok')
    else if (def.name === 'library_read') trace(`reading ${String(args.url ?? '').replace(/^https?:\/\//, '').slice(0, 44)}`, 'ok')
    else if (def.name === 'mcp_call') trace(`MCP ${String(args.serverId ?? '')}:${String(args.tool ?? '')}`.slice(0, 60), 'ok')
    else trace(def.name, 'ok')
    const result = await def.run(args, fullCtx)
    const blocked = /^BLOCKED/.test(result)
    ctx.onResult?.({ tool: def.name, args, text: result, data: structured, ok: !blocked && !/^(The action failed|Tool \S+ failed|Unknown tool)/.test(result) })
    if (def.name === 'ide_run_command') trace(`ran: ${String(args.command ?? '').slice(0, 60)}`, blocked ? 'blocked' : 'ok')
    return result
  } catch (e: any) {
    trace(def.name, 'error')
    const text = `Tool ${def.name} failed: ${String(e?.message ?? e)}`
    ctx.onResult?.({ tool: def.name, args, text, ok: false })
    return text
  }
}

/** MCP servers + tools rendered into the system prompt so the model knows what it can call. */
export function mcpContextBlock(): string {
  const servers = useStore.getState().settings.mcpServers.filter((s) => s.enabled)
  if (!servers.length) return ''
  return `\n\nMCP servers configured by the user (call them with the mcp_call tool):\n${servers.map((s) => `- ${s.name} (serverId: ${s.id}) — command: ${s.command}`).join('\n')}`
}
