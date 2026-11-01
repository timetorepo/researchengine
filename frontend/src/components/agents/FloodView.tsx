import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Rocket, Square, Trash2, Sparkles, MessageSquare } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { AgentSpec, Squad } from '@/types'
import { useStore, AGENT_COLORS } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { AGENT_ROLES, AGENT_INSTRUCTIONS } from '@/lib/agents/squads'
// SmoothUI's AITaskList — the agents, by state.
import AITaskList from '@/components/smoothui/ai-task-list'
import { estimateTokens } from '@/lib/flow/pruner'
import { generateText } from '@/lib/chat/generate'
import { MovingBorder } from '@/components/ui/aceternity/MovingBorder'
// React Bits — Micro. Used as published: the objective bar is a real prompt bar
// (model, effort, dictation, a send that becomes a stop).
import PromptBar from '@/components/ui/reactbits/micro/PromptBar'
import { useDictation } from '@/hooks/useDictation'
import { fmt } from '@/lib/utils'
import { perfCaps } from '@/lib/system/performance'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'

const EFFORT_TOKENS = { quick: 400, standard: 700, deep: 1300 } as const

interface PadMessage { id: string; agent: string; color: string; text: string; t: number }
interface AgentStatus { spec: AgentSpec; state: 'idle' | 'working' | 'done' | 'halted' | 'error'; tokens: number; startedAt: number; output: string }

export function FloodView() {
  const squads = useStore((s) => s.squads)
  const settings = useStore((s) => s.settings)
  const budget = settings.floodBudget
  const ui = useUI()
  const navigate = useNavigate()

  /**
   * The models this build can actually run an agent on: every configured
   * provider's last-known list, minus the ones the user unlisted. The current
   * default is marked so the bar opens on the model that will really be used.
   */
  const modelOptions = useMemo(() => {
    const hidden = new Set(settings.hiddenModels ?? [])
    const out: { key: string; name: string; tag?: string }[] = []
    for (const pid of settings.addedProviders ?? []) {
      for (const model of settings.providerModels?.[pid] ?? []) {
        const ref = `${pid}:${model}`
        if (hidden.has(ref)) continue
        out.push({ key: ref, name: model, tag: pid })
      }
    }
    return out
  }, [settings.addedProviders, settings.providerModels, settings.hiddenModels])

  // Dictation, offered the same way it is in the composer.
  const dictation = useDictation(() => {})

  /** Press the bar's mic: it listens, and hands the words back when you stop. */
  const dictateIntoBar = () => dictation.listen()

  const [objective, setObjective] = useState('')
  // Effort sets how long each agent is allowed to answer — the same knob as the
  // composer's, applied to every agent in the flood.
  const [effort, setEffort] = useState<'quick' | 'standard' | 'deep'>('standard')
  // The model the bar is set to; agents that inherit follow it.
  const [runModel, setRunModel] = useState<string | null>(null)
  const [squad, setSquad] = useState<Squad>(squads[0])
  const [agents, setAgents] = useState<AgentSpec[]>(squads[0]?.agents ?? [])
  const [running, setRunning] = useState(false)
  const [statuses, setStatuses] = useState<AgentStatus[]>([])
  const [pad, setPad] = useState<PadMessage[]>([])
  const [synthesis, setSynthesis] = useState('')
  const stopRef = useRef(false)
  const padRef = useRef<HTMLDivElement>(null)

  useEffect(() => { padRef.current?.scrollTo({ top: padRef.current.scrollHeight }) }, [pad])

  const pickSquad = (sq: Squad) => {
    setSquad(sq)
    setAgents(sq.agents.map((a) => ({ ...a, id: nanoid(6) })))
  }

  const estTokens = useMemo(() => {
    const base = estimateTokens(objective) * 2 + 400
    return agents.reduce((a, ag) => a + base + (ag.role === 'Synthesizer' ? 800 : 0), 0)
  }, [objective, agents])

  const overBudget = estTokens > budget

  const addPad = (agent: string, color: string, text: string) =>
    setPad((p) => [...p, { id: nanoid(6), agent, color, text, t: Date.now() }])

  const deploy = async (objectiveOverride?: string) => {
    const subject = (objectiveOverride ?? objective).trim()
    if (!subject || agents.length === 0 || running) return
    if (objectiveOverride && objectiveOverride !== objective) setObjective(objectiveOverride)
    stopRef.current = false
    setRunning(true)
    setSynthesis('')
    setPad([])
    const st: AgentStatus[] = agents.map((spec) => ({ spec, state: 'idle', tokens: 0, startedAt: 0, output: '' }))
    setStatuses(st)
    ui.set({ island: { kind: 'flood', active: 0, total: agents.length } })
    addPad('Supervisor', '#A1A1AA', `Objective received. Deploying ${agents.length} agents in parallel. Budget: ${fmt(budget)} tokens.`)

    const controller = new AbortController()
    let usedTokens = 0
    let done = 0
    let anyDemo = false
    const outputs: { name: string; role: string; color: string; text: string }[] = []
    const patchStatus = (id: string, patch: Partial<AgentStatus>) =>
      setStatuses((prev) => prev.map((x) => x.spec.id === id ? { ...x, ...patch } : x))

    const runAgent = async (ag: AgentSpec) => {
      if (stopRef.current || controller.signal.aborted || usedTokens >= budget) return
      const startedAt = Date.now()
      patchStatus(ag.id, { state: 'working', startedAt })
      ui.set({ island: { kind: 'flood', active: done, total: agents.length } })
      addPad(ag.name, ag.color, `${AGENT_INSTRUCTIONS[ag.role] ?? 'Working…'} Starting now.`)

      let lastTick = 0
      let acc = ''
      const system = [
        `You are ${ag.name}, the squad's ${ag.role}.`,
        AGENT_INSTRUCTIONS[ag.role] ?? 'Contribute toward the objective.',
        'Stay strictly in role. Be concrete, specific and evidence-driven.',
        'Use Markdown. Keep your contribution under 350 words.',
      ].join(' ')

      try {
        const res = await generateText({
          system,
          prompt: `Objective: ${subject}`,
          temperature: ag.temperature,
          maxTokens: EFFORT_TOKENS[effort],
          modelOverride: ag.modelBinding && ag.modelBinding !== 'inherit' ? ag.modelBinding : (runModel ?? undefined),
          signal: controller.signal,
          onChunk: (t) => {
            acc += t
            const now = performance.now()
            if (now - lastTick > 250) {
              lastTick = now
              patchStatus(ag.id, { tokens: estimateTokens(acc) })
            }
          },
        })
        const cost = res.promptTokens + res.completionTokens
        usedTokens += cost
        if (res.usedDemo) anyDemo = true
        outputs.push({ name: ag.name, role: ag.role, color: ag.color, text: res.text })
        done++
        patchStatus(ag.id, { state: 'done', tokens: cost, output: res.text })
        ui.set({ island: { kind: 'flood', active: done, total: agents.length } })
        addPad(ag.name, ag.color, `${res.text.slice(0, 160).replace(/\s+/g, ' ').trim()}…`)
        if (usedTokens >= budget) {
          addPad('Supervisor', '#F87171', `Budget cap hit at ${fmt(usedTokens)} tokens. Halting remaining agents.`)
          controller.abort()
        }
      } catch (e: any) {
        if (e?.name === 'AbortError' || stopRef.current) {
          patchStatus(ag.id, { state: 'halted' })
          addPad(ag.name, ag.color, 'Halted.')
        } else {
          patchStatus(ag.id, { state: 'error' })
          addPad(ag.name, ag.color, `Error: ${String(e?.message ?? e).slice(0, 120)}`)
        }
      }
    }

    // Parallel pool — capped by the performance profile (Settings → Performance).
    const queue = [...agents]
    const workers = Math.min(perfCaps().floodWorkers, queue.length)
    await Promise.all(Array.from({ length: workers }, async () => {
      while (queue.length > 0) {
        const ag = queue.shift()!
        await runAgent(ag)
      }
    }))

    if (outputs.length > 0 && !stopRef.current) {
      addPad('Supervisor', '#A78BFA', `${outputs.length}/${agents.length} agents reported. Synthesizing final answer…`)

      let synth = ''
      const contributions = outputs.map((o) => `### ${o.name} (${o.role})\n${o.text}`).join('\n\n')
      const hasKey = !anyDemo
      if (hasKey) {
        // Real synthesis pass: the model merges the actual contributions.
        try {
          const res = await generateText({
            system: 'You are a rigorous synthesis engine. Merge the agent contributions into one coherent, well-structured deliverable. Resolve conflicts explicitly, keep attribution where it matters, and state a clear bottom line. Markdown.',
            prompt: `Objective: ${subject}\n\nAgent contributions:\n\n${contributions}`,
            maxTokens: 1200,
            signal: controller.signal,
          })
          usedTokens += res.promptTokens + res.completionTokens
          synth = res.text
        } catch {
          synth = assembleSynthesis(subject, outputs)
        }
      } else {
        // On-device engine: assemble a real synthesis from the actual outputs.
        synth = assembleSynthesis(objective, outputs)
      }

      setSynthesis(synth)
      addPad('Supervisor', '#34D399', `Synthesis complete. ${fmt(usedTokens)} tokens used across ${outputs.length} agents${hasKey ? '' : ' (on-device engine — add a provider key for live models)'}.`)

      // Save synthesis as a chat
      const chatId = useStore.getState().newChat()
      const store = useStore.getState()
      store.addMessage(chatId, { id: nanoid(8), role: 'user', content: `[Agent Flood objective] ${subject}`, createdAt: Date.now() })
      store.addMessage(chatId, {
        id: nanoid(8), role: 'assistant', content: synth, createdAt: Date.now(),
        model: hasKey ? 'flood' : 'flood (on-device)', provider: 'Agent Flood',
        agentAttribution: outputs.map((o) => ({ name: o.name, color: o.color })),
      })
      ui.toast('Flood complete', `${outputs.length}/${agents.length} agents finished · ${fmt(usedTokens)} tokens. Result saved as a chat.`, 'success')
      setTimeout(() => navigate(`/chat/${chatId}`), 1200)
    } else if (outputs.length === 0) {
      addPad('Supervisor', '#F87171', 'No agent completed. Nothing to synthesize.')
    }

    setRunning(false)
    ui.set({ island: { kind: 'idle' } })
  }

  const stop = () => { stopRef.current = true }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Planner */}
      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        <div className="max-w-[640px]">
          <h1 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Agent Flood</h1>
          <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
            Deploy specialized agents in parallel on a single objective. AIFlowEngine applies to every agent.
          </p>

          <div className="mb-4">
            <span className="text-[12.5px] font-medium mb-1.5 block">Objective</span>
            <PromptBar
              placeholder="Research the current state of solid-state battery tech and produce a sourced briefing."
              models={modelOptions}
              defaultModel={settings.defaultModel}
              efforts={['quick', 'standard', 'deep']}
              defaultEffort={effort}
              onEffortChange={(v) => setEffort((v === 'quick' || v === 'deep') ? v : 'standard')}
              busy={running}
              onSend={(text, detail) => {
                setObjective(text)
                if (detail?.model?.key) setRunModel(detail.model.key)
                void deploy(text)
              }}
              onStop={stop}
              onDictate={dictateIntoBar}
              className="re-promptbar"
              background="var(--surface)"
              color="var(--text)"
              menuBackground="var(--elevated)"
              sparkColor="var(--primary)"
            />
            {dictation.state === 'recording' && (
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--primary)' }}>Listening… press the mic again to transcribe.</div>
            )}
            {dictation.error && (
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--danger)' }}>{dictation.error}</div>
            )}
          </div>

          {/* Preset squads */}
          <div className="text-[12.5px] font-medium mb-2">Squad</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {squads.map((sq) => (
              <button key={sq.id} onClick={() => pickSquad(sq)}
                className="px-3.5 py-2 rounded-[12px] text-[12.5px] text-left transition-all"
                style={{
                  background: squad.id === sq.id ? 'color-mix(in srgb, var(--secondary) 14%, transparent)' : 'var(--surface)',
                  border: `1px solid ${squad.id === sq.id ? 'var(--secondary)' : 'var(--surface-border)'}`,
                }}>
                <div className="font-medium">{sq.name}</div>
                <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{sq.description}</div>
              </button>
            ))}
          </div>

          {/* Agent grid — keyed per squad so switching runs ONE coordinated
              transition (old grid fades, new grid staggers in) instead of
              every card exit/entering at once, which read as choppy. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={squad.id}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4"
            >
              <AnimatePresence initial={false}>
              {agents.map((ag, i) => {
                const st = statuses.find((x) => x.spec.id === ag.id)
                return (
                  <motion.div key={ag.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.1 } }}
                    transition={{ delay: i * 0.035, type: 'spring', damping: 26, stiffness: 320 }}
                    className="relative p-3.5 rounded-[14px] overflow-hidden"
                    style={{ background: 'var(--surface)', border: `1px solid ${ag.color}44` }}>
                    {st?.state === 'done' && (
                      <motion.div className="absolute inset-0 pointer-events-none"
                        initial={{ x: '-100%' }} animate={{ x: 0 }} transition={{ duration: 0.5 }}
                        style={{ background: `linear-gradient(90deg, transparent, ${ag.color}22)` }} />
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${st?.state === 'working' ? 'pulse-dot' : ''}`}
                        style={{ background: ag.color, color: ag.color }} />
                      <input value={ag.name}
                        onChange={(e) => setAgents((prev) => prev.map((x) => x.id === ag.id ? { ...x, name: e.target.value } : x))}
                        className="bg-transparent outline-none text-[13px] font-medium flex-1 min-w-0" />
                      <button onClick={() => setAgents((prev) => prev.filter((x) => x.id !== ag.id))}
                        aria-label="Remove agent" style={{ color: 'var(--text-3)' }}><Trash2 size={12} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <ModernSelect value={ag.role}
                        onChange={(e) => setAgents((prev) => prev.map((x) => x.id === ag.id ? { ...x, role: e.target.value as any } : x))}
                        className="bg-transparent outline-none text-[11.5px] flex-1" style={{ color: 'var(--text-2)' }}>
                        {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </ModernSelect>
                      <label className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                        τ
                        <input type="number" min={0} max={2} step={0.1} value={ag.temperature}
                          onChange={(e) => setAgents((prev) => prev.map((x) => x.id === ag.id ? { ...x, temperature: Number(e.target.value) } : x))}
                          className="w-11 bg-transparent outline-none text-[11px] px-1 py-0.5 rounded" style={{ background: 'var(--elevated)' }} />
                      </label>
                    </div>
                    {st && (
                      <div className="mt-2 flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                        <span className="capitalize" style={{
                          color: st.state === 'done' ? 'var(--success)'
                            : st.state === 'working' ? ag.color
                            : st.state === 'error' ? 'var(--danger)'
                            : st.state === 'halted' ? 'var(--warning)' : undefined,
                        }}>
                          {st.state === 'working' ? 'working…' : st.state}
                        </span>
                        <span>· {st.tokens} tok</span>
                        {st.startedAt > 0 && st.state === 'working' && <span>· {Math.max(0, Math.round((Date.now() - st.startedAt) / 1000))}s</span>}
                      </div>
                    )}
                  </motion.div>
                )
              })}
              </AnimatePresence>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: agents.length * 0.035, duration: 0.2 }}
                onClick={() => setAgents((prev) => [...prev, {
                  id: nanoid(6), name: `Agent ${prev.length + 1}`, role: 'Researcher',
                  color: AGENT_COLORS[prev.length % AGENT_COLORS.length], modelBinding: 'inherit', temperature: 0.6, skills: [],
                }])}
                className="flex items-center justify-center gap-1.5 p-3.5 rounded-[14px] text-[12.5px] transition-colors hover:bg-[var(--elevated)]"
                style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
                <Plus size={14} /> Add agent
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Cost estimate + deploy */}
          <div className="surface p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[160px]">
              <div className="text-[11px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-3)' }}>Estimated cost</div>
              <div className="text-[15px] font-semibold" style={{ color: overBudget ? 'var(--danger)' : 'var(--text)' }}>
                ~{fmt(estTokens)} tokens
              </div>
              <div className="text-[10.5px]" style={{ color: overBudget ? 'var(--danger)' : 'var(--text-3)' }}>
                Budget cap {fmt(budget)} {overBudget && '— over budget'}
              </div>
            </div>
            {running ? (
              <button onClick={stop} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium"
                style={{ background: 'var(--danger)', color: '#fff' }}>
                <Square size={13} /> Halt
              </button>
            ) : (
              <MovingBorder
                onClick={deploy}
                disabled={!objective.trim() || agents.length === 0}
                radius={999}
                borderColor="conic-gradient(from 0deg, var(--primary), var(--secondary), transparent 45%, transparent 55%, var(--primary))"
                className="h-11"
              >
                <span className="flex items-center gap-2 px-5 h-full text-[13px] font-medium text-white grad-flood" style={{ borderRadius: 999 }}>
                  <Rocket size={14} /> Deploy {agents.length} agents
                </span>
              </MovingBorder>
            )}
          </div>
        </div>
      </div>

      {/* Scratchpad */}
      <aside className="lg:w-[340px] shrink-0 flex flex-col" style={{ borderTop: '1px solid var(--surface-border)', borderLeft: 'none' }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <MessageSquare size={14} style={{ color: 'var(--secondary)' }} />
          <span className="text-[13px] font-medium flex-1">Scratchpad</span>
          <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>agent-to-agent</span>
        </div>
        {/* The live checklist: which agent is idle, working, finished or halted.
            SmoothUI's AITaskList — state, not a status string. */}
        {statuses.length > 0 && (
          <div className="px-3 pt-3">
            <AITaskList
              label="Agent flood"
              tasks={statuses.map((st) => ({
                id: st.spec.id,
                label: String((st.spec as any).name ?? (st.spec as any).role ?? 'Agent'),
                note: st.tokens > 0 ? `${fmt(st.tokens)} tok` : undefined,
                status: st.state === 'done' ? 'done'
                  : st.state === 'working' ? 'running'
                  : st.state === 'idle' ? 'pending'
                  : 'failed',
              }))}
            />
          </div>
        )}
        <div ref={padRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px]">
          {pad.length === 0 && (
            <div className="text-[12px] text-center py-8" style={{ color: 'var(--text-3)' }}>
              Agent messages appear here, threaded and color-coded, once you deploy.
            </div>
          )}
          <AnimatePresence initial={false}>
            {pad.map((m) => (
              <motion.div key={m.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="p-2.5 rounded-[12px] text-[12px] leading-relaxed"
                style={{ background: 'var(--surface)', borderLeft: `2.5px solid ${m.color}` }}>
                <span className="font-semibold mr-1.5" style={{ color: m.color }}>{m.agent}</span>
                <span style={{ color: 'var(--text-2)' }}>{m.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </aside>
    </div>
  )
}

/** Structured synthesis assembled from the agents' actual outputs.
 *  Used by the on-device engine path (with a key, the model writes it). */
function assembleSynthesis(objective: string, outputs: { name: string; role: string; color: string; text: string }[]): string {
  const attrib = outputs.map((o) => `- **${o.name}** (${o.role})`).join('\n')
  const sections = outputs.map((o) => [`### ${o.name} — ${o.role}`, '', o.text.trim()].join('\n')).join('\n\n---\n\n')
  return [
    `## Flood synthesis`,
    ``,
    `**Objective.** ${objective}`,
    ``,
    `**Squad.**`,
    attrib,
    ``,
    `### Contributions`,
    ``,
    sections,
    ``,
    `---`,
    ``,
    `> *Assembled from ${outputs.length} agent outputs by the on-device engine. Add a provider key in Settings and the squad runs on live models, with a model-written synthesis.*`,
  ].join('\n')
}
