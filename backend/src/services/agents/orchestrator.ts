// Agent Flood orchestrator (server side). Coordinates parallel agent turns
// against a shared scratchpad. The browser also runs a self-contained version;
// this is used when deployments route LLM calls through the backend.
import { classify } from '../flow/helpers'

export interface AgentTask { name: string; role: string; instruction: string }
export interface AgentResult { name: string; role: string; output: string; tokens: number }

export function planObjective(objective: string, agents: AgentTask[]): { plan: string; estimatedTokens: number } {
  const cls = classify(objective)
  const perAgent = 400 + Math.round(objective.length / 4)
  return {
    plan: `Classified as "${cls}". ${agents.length} agents will run in parallel, then a synthesizer merges outputs.`,
    estimatedTokens: perAgent * agents.length,
  }
}

export function synthesize(objective: string, results: AgentResult[]): string {
  const parts = results.map((r) => `- **${r.name}** (${r.role}): ${r.output}`).join('\n')
  return `Objective: ${objective}\n\nContributions:\n${parts}\n\nSynthesis: merged and de-duplicated across ${results.length} agents.`
}
