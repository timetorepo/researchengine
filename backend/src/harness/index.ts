/**
 * Boot the harness: one kernel per data folder, with every plugin loaded once.
 * Profiles then decide what each session may use (see profiles.ts).
 */
import { Kernel } from './kernel'
import { llmPlugin, type FetchLike } from './llm'
import { sessionsPlugin, type SessionStore } from './sessions'
import { agentPlugin, type AgentService } from './agent'
import { registryPlugin, bashTool, editorTool, filesTool } from './tools'

export interface Harness {
  kernel: Kernel
  sessions: SessionStore
  agent: AgentService
}

export function bootHarness(dataDir: string, fetchImpl?: FetchLike): Harness {
  const kernel = new Kernel()
  kernel.load(registryPlugin())
  kernel.load(llmPlugin(fetchImpl))
  kernel.load(sessionsPlugin(dataDir))
  kernel.load(agentPlugin())
  kernel.load(bashTool())
  kernel.load(editorTool())
  kernel.load(filesTool())
  const sessions = kernel.get<SessionStore>('sessions')
  const agent = kernel.get<AgentService>('agent')
  if (!sessions || !agent) {
    throw new Error(`harness did not start: ${kernel.errors.map((e) => `${e.plugin}: ${e.error}`).join('; ') || 'missing services'}`)
  }
  return { kernel, sessions, agent }
}

const cache = new Map<string, Harness>()

/** The harness for a data folder, booted on first use. */
export function harnessFor(dataDir: string): Harness {
  let h = cache.get(dataDir)
  if (!h) {
    h = bootHarness(dataDir)
    cache.set(dataDir, h)
  }
  return h
}
