import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Sparkles, X, Square, Image as ImageIcon, ChevronDown, Wand2, Accessibility, MousePointerClick, Smartphone, Eye,
  Plus, Send, CornerDownLeft, Bug, Hammer, Check, Search, Cpu, ChevronUp, Globe,
} from 'lucide-react'
import { PROVIDERS } from '@/lib/providers/registry'
import { useStore } from '@/stores/useStore'
import { runChat, isStreamingChat, enqueuePrompt, stopStream } from '@/lib/chat/runChat'
import { useUI } from '@/stores/useUI'
import { Markdown } from '@/components/chat/Markdown'
import { ToolTraceChips, ExecApproval, QuestionnaireCard } from '@/components/chat/ToolUI'
import { attachmentTray, type TrayAttachment } from '@/lib/ide/bridge'
import type { ChatMessage } from '@/types'
import type { TreeNode } from './types'
import { scrollToEnd } from '@/lib/dom/scroll'
import { SlashMenu } from './SlashMenu'
import { ActivityRow } from './AgentTimeline'
import { SLASH_COMMANDS, isCommandDraft, parseCommand, expandCommand } from '@/lib/ide/commands'
import { subscribeActivity, useAgents } from '@/lib/ide/agents'
import type { IdeActivity } from '@/lib/chat/tools'

/**
 * Devin's handoff needs to know which side a provider is on: the model servers
 * on this machine (Ollama, LM Studio, a local OpenAI-compatible box) versus
 * everything that leaves the device. `/handoff` moves a session between them,
 * so the distinction is a rule, not a label.
 */
const isLocalProvider = (p: (typeof PROVIDERS)[number]) =>
  p.kind === 'ollama' || /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(p.baseUrl)

function useTray(): TrayAttachment[] {
  return useSyncExternalStore(attachmentTray.subscribe, attachmentTray.get, attachmentTray.get)
}

/**
 * What the user wants done. The intent is sent as a system preamble so the
 * model works the way the button implies — and it's visible next to the
 * composer, so "ask the AI to fix" can never be mistaken for "ask it to build".
 */
export const INTENTS = [
  {
    id: 'fix',
    label: 'Fix',
    icon: Bug,
    hint: 'Find the real cause of a bug, repair it, prove it',
    preamble: 'INTENT: FIX. The user wants a defect removed. Find the actual root cause (read the code and, in Design mode, observe the running app) — never guess. Then apply the smallest correct change, explain the cause in one or two sentences, and verify the fix (assertion, test, or reproduction) before claiming success. If you cannot reproduce it, say exactly what you checked and what you need.',
  },
  {
    id: 'build',
    label: 'Build',
    icon: Hammer,
    hint: 'Implement a new feature end to end',
    preamble: 'INTENT: BUILD. The user wants something new implemented. Establish the requirements from the code and the conversation (call ask_user if a genuinely ambiguous decision blocks you), outline the plan in a few lines, then implement it completely — files, wiring, states, edge cases. Prefer matching the existing architecture and style over introducing new patterns. Finish by telling the user how to try it.',
  },
  {
    id: 'refine',
    label: 'Refine',
    icon: Wand2,
    hint: 'Polish what exists: clarity, UX, structure, performance',
    preamble: 'INTENT: REFINE. The user wants existing code or UI made better without changing intended behaviour. Look for unclear naming, duplicated logic, awkward layout, weak hierarchy, missing states, and needless complexity. Make focused improvements, keep the diff reviewable, and list what you changed and why. Do not rewrite working code just because you would have written it differently.',
  },
] as const

type IntentId = typeof INTENTS[number]['id']

/**
 * The coding conversation for a project.
 *
 * Coding chats are `kind: 'coding'` so research history stays clean. The first
 * lookup also adopts chats created before the field existed (they were named
 * `Coding · <project>`), which is why the title check is still here.
 */
export function chatIdFor(project: string): string {
  const store = useStore.getState()
  const title = `Coding · ${project}`
  const existing =
    store.chats.find((c) => c.kind === 'coding' && c.settings?.project === project) ??
    [...store.chats].reverse().find((c) => c.title === title)
  if (existing) {
    if (existing.kind !== 'coding' || existing.settings?.project !== project) {
      store.setChatKind(existing.id, 'coding', project)
    }
    return existing.id
  }
  return store.newCodingChat(project)
}

/**
 * The AI pair-programmer. One chat per project, shared by the code view and the
 * Design studio, so context carries across "edit the file" and "look at the
 * screen" without the user repeating themselves.
 */
export function AgentPanel({
  project, tree, design = false, onClose, quickActions,
}: {
  project: string
  tree: TreeNode[]
  design?: boolean
  onClose?: () => void
  quickActions?: { label: string; prompt: string; icon?: React.ReactNode }[]
}) {
  const [chatId, setChatId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [showActions, setShowActions] = useState(true)
  const [intent, setIntent] = useState<IntentId>('fix')
  const [modelRef, setModelRef] = useState<string>('')
  const [modelOpen, setModelOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const [, force] = useState(0)
  // Devin's handoff: which side this session runs on. `local` keeps everything
  // on this machine; `cloud` moves the task to an API model.
  const [handoff, setHandoff] = useState<'local' | 'cloud'>('local')
  const [slashOpen, setSlashOpen] = useState(false)
  // A handoff can arrive from the palette or the status bar before the model
  // list is known, so it is remembered and applied here — where it can still
  // pick a model that actually exists on that side.
  const pendingHandoff = useRef<null | 'local' | 'cloud'>(null)
  const [activity, setActivity] = useState<IdeActivity[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tray = useTray()
  const ui = useUI()
  const queue = useUI((s) => s.queue[chatId ?? ''] ?? [])

  useEffect(() => { setChatId(chatIdFor(project)) }, [project])

  const chat = useStore((s) => s.chats.find((c) => c.id === chatId))
  const settings = useStore((s) => s.settings)
  const [defaultProvider, defaultModelName] = settings.defaultModel.split(':')

  // Model choices come from whatever the user actually fetched (never a
  // hardcoded list), grouped by provider.
  const modelGroups = useMemo(() => PROVIDERS.map((p) => ({
    provider: p,
    models: (settings.providerModels[p.id] ?? []).filter((m) =>
      !modelQuery.trim() || m.toLowerCase().includes(modelQuery.trim().toLowerCase())),
  })).filter(({ provider, models }) => models.length > 0 && settings.providers[provider.id]?.enabled !== false), [settings.providerModels, settings.providers, modelQuery])

  const activeIntent = INTENTS.find((i) => i.id === intent) ?? INTENTS[0]
  const activeModelLabel = modelRef ? modelRef.split(':')[1] : (defaultModelName || 'default model')

  // The models that actually exist on each side, key-first: a handoff should
  // land on something that works, not on an empty provider.
  const sideRefs = useMemo(() => {
    const build = (local: boolean) => PROVIDERS
      .filter((p) => isLocalProvider(p) === local && settings.providers[p.id]?.enabled !== false && (settings.providerModels[p.id] ?? []).length)
      .sort((a, b) => Number(!!settings.providers[b.id]?.apiKey) - Number(!!settings.providers[a.id]?.apiKey))
      .flatMap((p) => (settings.providerModels[p.id] ?? []).slice(0, 12).map((m) => ({ ref: `${p.id}:${m}`, label: `${m} · ${p.name}` })))
    return { local: build(true), cloud: build(false) }
  }, [settings.providers, settings.providerModels])

  /** Move the session to the other side, and to a model that exists there. */
  const applyHandoff = (to: 'local' | 'cloud') => {
    setHandoff(to)
    const pool = sideRefs[to]
    if (!pool.some((m) => m.ref === modelRef)) setModelRef(pool[0]?.ref ?? '')
    ui.toast(
      to === 'cloud' ? 'Handed off to the cloud' : 'Back on this machine',
      pool.length
        ? `This session now runs on ${pool[0].label}.`
        : `No model is configured on the ${to} side yet — anything you send will use the default model.`,
      to === 'cloud' ? 'info' : 'success',
    )
  }
  useEffect(() => {
    if (!pendingHandoff.current) return
    applyHandoff(pendingHandoff.current)
    pendingHandoff.current = null
  }, [sideRefs])

  const streaming = chatId ? isStreamingChat(chatId) : false

  useEffect(() => {
    const iv = setInterval(() => { if (chatId && isStreamingChat(chatId)) force((n) => n + 1) }, 300)
    return () => clearInterval(iv)
  }, [chatId])

  // Scroll the transcript itself, never the page: an unscoped scrollIntoView
  // walks up and scrolls the app frame (`overflow: hidden` boxes are scrollable
  // by script but not by the user, which is how the IDE opened at the bottom).
  useEffect(() => { scrollToEnd(listRef.current, { smooth: true }) }, [chat?.messages.length, streaming])

  // Everything the AI touches in this session, live — the same feed the agent
  // pool reads, so a chat turn and a background agent tell the same story.
  // The command palette and the status bar can push a command in here; a
  // handoff can flip which side the session runs on.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const id = (e as CustomEvent).detail?.id as string | undefined
      const cmd = SLASH_COMMANDS.find((c) => c.id === id)
      if (!cmd) return
      setText(cmd.prompt)
      if (cmd.cloud) applyHandoff('cloud')
      textareaRef.current?.focus()
    }
    const onHandoff = (e: Event) => { pendingHandoff.current = (e as CustomEvent).detail?.to === 'cloud' ? 'cloud' : 'local' }
    window.addEventListener('re:ide-command', onCommand)
    window.addEventListener('re:ide-handoff', onHandoff)
    return () => {
      window.removeEventListener('re:ide-command', onCommand)
      window.removeEventListener('re:ide-handoff', onHandoff)
    }
  }, [])

  useEffect(() => subscribeActivity((line) => {
    if (line.agent) return
    if (line.project && line.project !== project) return
    setActivity((list) => [...list.slice(-60), { ...line, id: `${line.at}-${line.kind}-${line.path ?? line.command ?? ''}` }])
  }), [project])

  const treeText = useMemo(() => tree.map((n) => (n.dir ? `${n.name}/` : n.name)).join('\n'), [tree])

  const send = (prompt: string, extraImages?: TrayAttachment[], optsIn?: { intent?: IntentId; forceNewChat?: boolean }) => {
    if (!chatId || (!prompt.trim() && !extraImages?.length)) return
    const queued = attachmentTray.take()
    const attachments = [...(extraImages ?? []), ...queued]
    const preamble = (INTENTS.find((i) => i.id === (optsIn?.intent ?? intent)) ?? activeIntent).preamble
    const opts = {
      project, projectTree: treeText, design, preamble,
      modelOverride: modelRef || undefined,
      attachments: attachments.length ? attachments : undefined,
    }
    if (isStreamingChat(chatId)) { enqueuePrompt(chatId, prompt.trim(), {}, opts); return }
    void runChat({ chatId, prompt: prompt.trim() || '(see attached screenshot)', ...opts })
  }

  const attachFile = (f: File) => {
    if (!f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = () => attachmentTray.add({ type: 'image', name: f.name, dataUrl: String(r.result) })
    r.readAsDataURL(f)
  }

  const defaultActions: { label: string; prompt: string; icon?: React.ReactNode; intent: IntentId }[] = design
    ? [
        { label: 'Audit the screen', intent: 'refine', icon: <Accessibility size={11} />, prompt: 'Run design_audit on the live preview, then design_snapshot. List the concrete UI problems you find, ranked by impact, with the exact selector for each. Do not edit files yet.' },
        { label: 'Fix the worst issue', intent: 'fix', icon: <Wand2 size={11} />, prompt: 'Audit the live preview, pick the single most impactful UI problem, fix it in the project files, restart the preview, then verify the fix with design_assert. Show me the before/after.' },
        { label: 'Test every button', intent: 'fix', icon: <MousePointerClick size={11} />, prompt: 'Enumerate the interactive controls with design_controls, then click every button and report which ones do nothing, throw console errors, or navigate somewhere unexpected. Summarise as a table of control → result.' },
        { label: 'Check mobile layout', intent: 'refine', icon: <Smartphone size={11} />, prompt: 'Resize the preview to 390×844 with design_resize, then audit and snapshot. List everything that breaks at phone width and fix the worst of it.' },
        { label: 'Review the visuals', intent: 'refine', icon: <Eye size={11} />, prompt: 'Take a design_screenshot so I can see the screen, then critique spacing, hierarchy, contrast and alignment, and propose specific changes.' },
      ]
    : [
        { label: 'What should we fix?', intent: 'refine', icon: <Wand2 size={11} />, prompt: 'Interview me about what I want to fix or refine in this project. Call the ask_user tool with 3-5 focused questions you generate from the project\'s actual files and stack (do not use canned questions). After I answer, inspect the relevant files and propose a concrete plan before changing anything.' },
        { label: 'Find bugs', intent: 'fix', icon: <Sparkles size={11} />, prompt: 'Read the project files and find real bugs, dead code and fragility. Report each with file, line and a concrete fix. Then ask me which ones to apply.' },
        { label: 'Build something', intent: 'build', icon: <Hammer size={11} />, prompt: 'Look at this project and propose three things worth building next, ranked by value. Then ask me which one to implement and build it end to end.' },
        { label: 'Explain the project', intent: 'refine', icon: <Sparkles size={11} />, prompt: 'Explain how this project is structured: entry points, data flow, key files. Keep it tight and point at the files you read.' },
      ]

  const actions = quickActions ?? defaultActions

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: 'transparent' }}>
      {/* header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--ide-border)' }}>
        <Sparkles size={13} style={{ color: 'var(--ide-accent)' }} />
        <span className="text-[12px] font-medium truncate">{design ? 'Design assistant' : 'AI pair-programmer'}</span>
        <span className="flex-1" />
        <button
          onClick={() => applyHandoff(handoff === 'local' ? 'cloud' : 'local')}
          className="re-chip"
          data-tone={handoff}
          title={handoff === 'local'
            ? `On this machine (${activeModelLabel}). Click to hand the task to a cloud model.`
            : `On a cloud model (${activeModelLabel}). Click to bring the task back to a local model.`}
        >
          {handoff === 'local' ? <Cpu size={9} /> : <Globe size={9} />} {handoff}
        </button>
        {streaming
          ? <span className="ide-badge accent"><span className="re-orb re-orb-sm" aria-hidden /> thinking</span>
          : <span className="ide-badge">{design ? 'sees the screen' : 'ready'}</span>}
        <button onClick={() => setShowActions((v) => !v)} title="Quick actions"
          className="ide-icon-btn" style={{ width: 22, height: 22 }}>
          <ChevronDown size={12} style={{ transform: showActions ? 'rotate(180deg)' : undefined, transition: 'transform 120ms' }} />
        </button>
        {onClose && <button onClick={onClose} className="ide-icon-btn" style={{ width: 22, height: 22 }} aria-label="Close assistant"><X size={12} /></button>}
      </div>

      {/* quick actions */}
      <AnimatePresence initial={false}>
        {showActions && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden" style={{ borderBottom: '1px solid var(--ide-border)' }}>
            <div className="flex flex-wrap gap-1.5 p-2">
              {actions.map((a) => (
                <button key={a.label} onClick={() => send(a.prompt, undefined, { intent: (a as any).intent ?? intent })}
                  disabled={!chatId} className="ide-chip disabled:opacity-40" title={(a as any).intent ? `Runs as: ${(a as any).intent.toUpperCase()}` : undefined}>
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* messages */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {!chat?.messages.length && (
          <div className="text-[12px] leading-relaxed" style={{ color: 'var(--ide-dim)' }}>
            {design
              ? 'I can see the running app: layout, computed styles, console and screenshots. Ask me to audit it, test the buttons, or fix what looks wrong — I verify with real assertions.'
              : 'I can read and edit this project, run commands (with your approval), and check git. Try “What should we fix?”'}
          </div>
        )}
        {chat?.messages.map((m: ChatMessage) => (
          <div key={m.id}>
            {m.role === 'user' ? (
              <div className="flex flex-col items-end gap-1">
                {!!m.attachments?.length && (
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {m.attachments.map((a, i) => (
                      <img key={i} src={a.dataUrl} alt={a.name} className="max-h-24 rounded-[8px]" style={{ border: '1px solid var(--ide-border-strong)' }} />
                    ))}
                  </div>
                )}
                <div className="ide-msg-user max-w-[88%] px-3 py-2 text-[12.5px] whitespace-pre-wrap" style={{ color: 'var(--ide-text)' }}>
                  {m.content}
                </div>
              </div>
            ) : (
              <div className="max-w-[97%]">
                <ToolTraceChips msg={m} />
                <ExecApproval chatId={chat!.id} msg={m} />
                <QuestionnaireCard chatId={chat!.id} msg={m} />
                {m.error ? (
                  <div className="text-[12px] p-2.5 rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--ide-danger) 12%, transparent)', color: 'var(--ide-danger)' }}>{m.error}</div>
                ) : (
                  <div className="text-[12.5px]"><Markdown content={m.content} streaming={streaming && m.id === chat!.messages[chat!.messages.length - 1]?.id} /></div>
                )}
              </div>
            )}
          </div>
        ))}
        {!!queue.length && (
          <div className="text-[11px] px-2.5 py-1.5 rounded-[8px]" style={{ background: 'var(--ide-elevated)', color: 'var(--ide-faint)' }}>
            {queue.length} queued message{queue.length > 1 ? 's' : ''} — sent when the current answer finishes
          </div>
        )}

      </div>

      {/* attachments + composer */}
      <div className="shrink-0 px-2.5 pb-2.5 pt-1.5" style={{ borderTop: '1px solid var(--ide-border)' }}>
        {/* hint chips, like the reference's shortcut row */}
        <div className="flex items-center gap-1.5 px-0.5 pb-2 flex-wrap">
          <span className="ide-chip"><CornerDownLeft size={9} /> to send</span>
          <span className="ide-chip"><CornerDownLeft size={9} /> ⇧ new line</span>
          <span className="ide-chip">/ audit</span>
          <span className="ide-chip">/ fix</span>
          <span className="ide-chip">/ test</span>
        </div>

        {!!tray.length && (
          <div className="flex items-center gap-2 pb-2 flex-wrap">
            {tray.map((a, i) => (
              <span key={i} className="relative group">
                <img src={a.dataUrl} alt={a.name} className="h-11 rounded-[6px]" style={{ border: '1px solid var(--ide-border-strong)' }} />
                <button onClick={() => attachmentTray.remove(i)} aria-label={`Remove ${a.name}`}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] opacity-0 group-hover:opacity-100"
                  style={{ background: 'var(--ide-danger)', color: '#fff' }}>×</button>
              </span>
            ))}
            <span className="text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>sent with your next message</span>
          </div>
        )}

        {/* intent + model: what should be done, and by which model */}
        <div className="flex items-center gap-1.5 pb-2 flex-wrap">
          <div className="ide-seg" role="group" aria-label="What should the AI do">
            {INTENTS.map((i) => {
              const Icon = i.icon
              return (
                <button key={i.id} data-active={intent === i.id} onClick={() => setIntent(i.id)} title={i.hint}>
                  <span className="inline-flex items-center gap-1"><Icon size={11} /> {i.label}</span>
                </button>
              )
            })}
          </div>

          <div className="relative">
            <button onClick={() => setModelOpen((v) => !v)} className="ide-chip" title="Choose which model answers">
              <Cpu size={10} /> <span className="max-w-[130px] truncate">{activeModelLabel}</span>
              {modelOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            <AnimatePresence>
              {modelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute bottom-[110%] left-0 z-30 w-[300px] max-h-[300px] overflow-hidden rounded-[14px] ios-material flex flex-col"
                >
                  <div className="p-2 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <div className="flex items-center gap-1.5 px-2 rounded-[8px]" style={{ background: 'color-mix(in srgb, var(--bg) 60%, var(--surface))' }}>
                      <Search size={11} style={{ color: 'var(--text-3)' }} />
                      <input value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} autoFocus
                        placeholder="Search models…" aria-label="Search models"
                        className="flex-1 bg-transparent outline-none py-1.5 text-[11.5px]" style={{ color: 'var(--text)' }} />
                    </div>
                  </div>
                  <div className="overflow-y-auto p-1.5">
                    <button onClick={() => { setModelRef(''); setModelOpen(false) }}
                      className="ide-row w-full" data-active={!modelRef}>
                      <Check size={11} style={{ opacity: modelRef ? 0 : 1 }} />
                      <span className="flex-1 truncate">Project default{defaultModelName ? ` · ${defaultModelName}` : ''}</span>
                    </button>
                    {modelGroups.map(({ provider, models }) => (
                      <div key={provider.id} className="mt-1">
                        <div className="ide-section px-2 py-1">{provider.name}</div>
                        {models.slice(0, 30).map((m) => {
                          const ref = `${provider.id}:${m}`
                          return (
                            <button key={ref} onClick={() => { setModelRef(ref); setModelOpen(false) }}
                              className="ide-row w-full" data-active={modelRef === ref}>
                              <Check size={11} style={{ opacity: modelRef === ref ? 1 : 0 }} />
                              <span className="flex-1 truncate">{m}</span>
                              {settings.defaultModel === ref && <span className="ide-badge accent">default</span>}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    {!modelGroups.length && (
                      <p className="px-2 py-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
                        No fetched models yet — add a provider key under Settings → Providers, then refresh models.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{activeIntent.hint}</span>
        </div>

        {activity.length > 0 && (
          <div className="re-composer-activity" title="What the AI just did">
            <ActivityRow line={activity[activity.length - 1]} compact />
            <span className="re-act-count">{activity.length}</span>
          </div>
        )}

        <div className="ide-composer p-2 relative">
          <AnimatePresence>
            {slashOpen && (
              <div className="absolute left-2 right-2 bottom-[calc(100%-6px)] z-30">
                <SlashMenu
                  query={text}
                  onClose={() => setSlashOpen(false)}
                  onPick={(c) => { setText(c.prompt); setSlashOpen(false); if (c.cloud) applyHandoff('cloud') }}
                />
              </div>
            )}
          </AnimatePresence>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { const v = e.target.value; setText(v); setSlashOpen(isCommandDraft(v)) }}
            onKeyDown={(e) => {
              if (slashOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) return
              if (e.key === 'Escape' && slashOpen) { e.preventDefault(); setSlashOpen(false); return }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const t = text
                setText(''); setSlashOpen(false)
                // A slash command routes itself: agents run in their own copy,
                // /handoff just moves the session, and the cloud ones switch
                // the model before the turn is sent.
                const parsed = parseCommand(t)
                if (parsed?.command.cloud) applyHandoff('cloud')
                if (parsed?.command.asAgent) {
                  void useAgents.getState().spawn({
                    title: parsed.command.label.replace('/', '') + (parsed.arg ? ` · ${parsed.arg.slice(0, 32)}` : ''),
                    prompt: expandCommand(parsed.command, parsed.arg),
                    project,
                    claim: [],
                    handoff: parsed.command.cloud ? 'cloud' : 'local',
                    design,
                  })
                  ui.toast('Agent spawned', 'It is working in its own copy of the project — see the Agents panel to merge.', 'success')
                  return
                }
                send(parsed ? expandCommand(parsed.command, parsed.arg) : t)
              }
            }}
            rows={2}
            placeholder={streaming ? 'Type to queue another message…' : design ? 'Ask about this screen…' : 'Ask the AI about this project…'}
            className="w-full bg-transparent outline-none text-[12.5px] resize-none px-1 py-1 max-h-32"
            style={{ color: 'var(--ide-text)' }} />
          <div className="flex items-center gap-1.5 pt-1">
            <button onClick={() => fileRef.current?.click()} className="ide-btn outlined" title="Attach an image">
              <Plus size={11} /> Attach
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = '' }} />
            <button onClick={() => setShowActions(true)} className="ide-icon-btn" title="Quick actions" style={{ width: 24, height: 24 }}>
              <ImageIcon size={12} />
            </button>
            <button onClick={() => ui.toast('Model', 'Change models from the top bar', 'info')} className="ide-icon-btn" title="Model settings" style={{ width: 24, height: 24 }}>
              <Globe size={12} />
            </button>
            <span className="flex-1" />
            {streaming ? (
              <button onClick={() => chatId && stopStream(chatId)} aria-label="Stop"
                className="ide-btn" style={{ color: 'var(--ide-danger)' }}>
                <Square size={10} /> Stop
              </button>
            ) : (
              <button onClick={() => { const t = text; setText(''); send(t) }} disabled={!text.trim() && !tray.length}
                className="ide-btn primary" aria-label="Send">
                <Send size={11} /> Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
