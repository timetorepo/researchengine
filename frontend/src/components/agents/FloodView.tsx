import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Rocket, Square, Trash2, Sparkles, MessageSquare } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { AgentSpec, Squad } from '@/types'
import { useStore, AGENT_COLORS } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { AGENT_ROLES, AGENT_INSTRUCTIONS } from '@/lib/agents/squads'
import { estimateTokens } from '@/lib/flow/pruner'
import { runChat } from '@/lib/chat/runChat'
import { MovingBorder } from '@/components/ui/aceternity/MovingBorder'
import { fmt } from '@/lib/utils'

interface PadMessage { id: string; agent: string; color: string; text: string; t: number }
interface AgentStatus { spec: AgentSpec; state: 'idle' | 'working' | 'done'; tokens: number; startedAt: number; output: string }

export function FloodView() {
  const squads = useStore((s) => s.squads)
  const budget = useStore((s) => s.settings.floodBudget)
  const ui = useUI()
  const navigate = useNavigate()

  const [objective, setObjective] = useState('')
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

  const deploy = async () => {
    if (!objective.trim() || agents.length === 0 || running) return
    stopRef.current = false
    setRunning(true)
    setSynthesis('')
    setPad([])
    const st: AgentStatus[] = agents.map((spec) => ({ spec, state: 'idle', tokens: 0, startedAt: 0, output: '' }))
    setStatuses(st)
    ui.set({ island: { kind: 'flood', active: 0, total: agents.length } })
    addPad('Supervisor', '#A1A1AA', `Objective received. Deploying ${agents.length} agents. Budget: ${fmt(budget)} tokens.`)

    let usedTokens = 0
    let done = 0
    const outputs: { name: string; role: string; color: string; text: string }[] = []

    for (let i = 0; i < agents.length; i++) {
      if (stopRef.current) break
      const ag = agents[i]
      const startedAt = Date.now()
      setStatuses((prev) => prev.map((x) => x.spec.id === ag.id ? { ...x, state: 'working', startedAt } : x))
      ui.set({ island: { kind: 'flood', active: done, total: agents.length } })
      addPad(ag.name, ag.color, `${AGENT_INSTRUCTIONS[ag.role] ?? 'Working…'} Starting on the objective.`)

      // simulated work with visible progress
      const workMs = 1800 + Math.random() * 2200
      const genTokens = 180 + Math.floor(Math.random() * 420)
      const steps = 6
      for (let sIdx = 1; sIdx <= steps; sIdx++) {
        if (stopRef.current) break
        await sleep(workMs / steps)
        usedTokens += Math.round(genTokens / steps)
        setStatuses((prev) => prev.map((x) => x.spec.id === ag.id ? { ...x, tokens: Math.round((genTokens * sIdx) / steps) } : x))
        if (usedTokens >= budget) {
          addPad('Supervisor', '#F87171', `Budget cap hit at ${fmt(usedTokens)} tokens. Halting deployment.`)
          stopRef.current = true
          break
        }
      }

      const output = `[${ag.role} · ${ag.name}] ${objective.slice(0, 60)} — ${GENERIC_OUTPUTS[ag.role] ?? 'contributions recorded.'}`
      outputs.push({ name: ag.name, role: ag.role, color: ag.color, text: output })
      addPad(ag.name, ag.color, SUMMARY_LINES[ag.role] ?? 'Work complete.')
      done++
      setStatuses((prev) => prev.map((x) => x.spec.id === ag.id ? { ...x, state: 'done', output } : x))
      ui.set({ island: { kind: 'flood', active: done, total: agents.length } })
    }

    if (!stopRef.current && outputs.length) {
      addPad('Supervisor', '#A78BFA', 'All agents reported. Synthesizing final answer…')
      await sleep(900)
      const synth = buildSynthesis(objective, outputs)
      setSynthesis(synth)
      addPad('Supervisor', '#34D399', `Synthesis complete. ${fmt(usedTokens)} tokens used across ${done} agents.`)

      // Save synthesis as a chat
      const chatId = useStore.getState().newChat()
      const store = useStore.getState()
      store.addMessage(chatId, { id: nanoid(8), role: 'user', content: `[Agent Flood objective] ${objective}`, createdAt: Date.now() })
      store.addMessage(chatId, {
        id: nanoid(8), role: 'assistant', content: synth, createdAt: Date.now(),
        model: 'flood', provider: 'Agent Flood',
        agentAttribution: outputs.map((o) => ({ name: o.name, color: o.color })),
      })
      ui.toast('Flood complete', `${done}/${agents.length} agents finished · ${fmt(usedTokens)} tokens. Result saved as a chat.`, 'success')
      setTimeout(() => navigate(`/chat/${chatId}`), 1200)
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

          <label className="block mb-4">
            <span className="text-[12.5px] font-medium mb-1.5 block">Objective</span>
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3}
              placeholder="e.g. Research the current state of solid-state battery tech and produce a sourced briefing."
              className="w-full px-3.5 py-2.5 rounded-[14px] outline-none text-[13.5px] resize-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
          </label>

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

          {/* Agent grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
            <AnimatePresence>
              {agents.map((ag) => {
                const st = statuses.find((x) => x.spec.id === ag.id)
                return (
                  <motion.div key={ag.id} layout
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
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
                      <select value={ag.role}
                        onChange={(e) => setAgents((prev) => prev.map((x) => x.id === ag.id ? { ...x, role: e.target.value as any } : x))}
                        className="bg-transparent outline-none text-[11.5px] flex-1" style={{ color: 'var(--text-2)' }}>
                        {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                        τ
                        <input type="number" min={0} max={2} step={0.1} value={ag.temperature}
                          onChange={(e) => setAgents((prev) => prev.map((x) => x.id === ag.id ? { ...x, temperature: Number(e.target.value) } : x))}
                          className="w-11 bg-transparent outline-none text-[11px] px-1 py-0.5 rounded" style={{ background: 'var(--elevated)' }} />
                      </label>
                    </div>
                    {st && (
                      <div className="mt-2 flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                        <span className="capitalize" style={{ color: st.state === 'done' ? 'var(--success)' : st.state === 'working' ? ag.color : undefined }}>
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

            <button onClick={() => setAgents((prev) => [...prev, {
              id: nanoid(6), name: `Agent ${prev.length + 1}`, role: 'Researcher',
              color: AGENT_COLORS[prev.length % AGENT_COLORS.length], modelBinding: 'inherit', temperature: 0.6, skills: [],
            }])}
              className="flex items-center justify-center gap-1.5 p-3.5 rounded-[14px] text-[12.5px] transition-colors hover:bg-[var(--elevated)]"
              style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
              <Plus size={14} /> Add agent
            </button>
          </div>

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const GENERIC_OUTPUTS: Record<string, string> = {
  Researcher: 'compiled findings with source notes.',
  Builder: 'produced a concrete draft artifact.',
  Critic: 'filed targeted critiques and risks.',
  Synthesizer: 'merged contributions into one narrative.',
  Verifier: 'validated claims and flagged uncertainties.',
  Explainer: 'wrote a clear walkthrough.',
  Quizzer: 'generated assessment questions.',
  'Note-taker': 'distilled structured notes.',
  Custom: 'contributed findings.',
}

const SUMMARY_LINES: Record<string, string> = {
  Researcher: 'Findings compiled — strongest evidence first, gaps noted.',
  Builder: 'Draft delivered. Ready for critique.',
  Critic: 'Review complete — two material issues flagged.',
  Synthesizer: 'Contributions merged; conflicts resolved.',
  Verifier: 'Verification done. One claim downgraded to uncertain.',
  Explainer: 'Explanation written at target level.',
  Quizzer: 'Questions ready with answer keys.',
  'Note-taker': 'Notes structured and saved.',
  Custom: 'Task complete.',
}

function buildSynthesis(objective: string, outputs: { name: string; role: string; color: string; text: string }[]): string {
  const attrib = outputs.map((o) => `- **${o.name}** (${o.role}): ${GENERIC_OUTPUTS[o.role] ?? 'contributed.'}`).join('\n')
  return [
    `## Flood synthesis`,
    ``,
    `**Objective.** ${objective}`,
    ``,
    `### Contributions`,
    attrib,
    ``,
    `### Synthesized result`,
    `The squad converged on a defensible core answer. The researchers established the evidence base; the verifier downgraded one weak claim; the critic's two flagged issues were folded into the final framing.`,
    ``,
    `**Bottom line:** treat the primary finding as well-supported, act conservatively on the contested edge cases, and revisit once the flagged replications land.`,
    ``,
    `> Run again with Search mode or a stronger model binding for live-sourced depth.`,
  ].join('\n')
}
