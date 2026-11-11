// The bird's-eye graph: the things an agent decides are worth keeping from a
// conversation or a coding session, as nodes (things) and edges (how they
// relate). It is stored on the user's own machine, next to the database, as one
// JSON file, so it can be read by hand and deleted in one step.
//
// The merge rules are in pure functions (mergeIntoGraph), so they are tested
// without touching the disk. Nodes are matched by label, ignoring case, so an
// agent that writes "Parser" twice adds one node, not two.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface GraphNode { id: string; label: string; kind: string; chatId?: string; createdAt: number }
export interface GraphEdge { id: string; from: string; to: string; label: string; createdAt: number }
export interface Graph { version: 1; nodes: GraphNode[]; edges: GraphEdge[] }

export interface SaveInput {
  nodes?: { label?: unknown; kind?: unknown }[]
  edges?: { from?: unknown; to?: unknown; label?: unknown }[]
  chatId?: string
}

export interface SaveSummary {
  addedNodes: number
  addedEdges: number
  skipped: string[]
}

export const GRAPH_LIMITS = {
  nodesPerSave: 30,
  edgesPerSave: 40,
  labelChars: 80,
  maxNodes: 1000,
  maxEdges: 3000,
} as const

export function emptyGraph(): Graph {
  return { version: 1, nodes: [], edges: [] }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const keyOf = (label: string) => label.toLowerCase()

/**
 * Adds what one save asks for. Returns the new graph (the input is not
 * changed), what was added, and a note for each thing that was refused.
 */
export function mergeIntoGraph(graph: Graph, input: SaveInput, now = Date.now()): { graph: Graph; summary: SaveSummary } {
  const next: Graph = { version: 1, nodes: [...graph.nodes], edges: [...graph.edges] }
  const skipped: string[] = []
  let addedNodes = 0
  let addedEdges = 0

  const byKey = new Map<string, GraphNode>()
  for (const n of next.nodes) byKey.set(keyOf(n.label), n)

  const nodeInputs = (input.nodes ?? []).slice(0, GRAPH_LIMITS.nodesPerSave)
  if ((input.nodes ?? []).length > GRAPH_LIMITS.nodesPerSave) skipped.push(`only the first ${GRAPH_LIMITS.nodesPerSave} nodes of this save were kept`)
  for (const raw of nodeInputs) {
    const label = clean(raw?.label, GRAPH_LIMITS.labelChars)
    if (!label) { skipped.push('a node had no label'); continue }
    const existing = byKey.get(keyOf(label))
    if (existing) continue
    if (next.nodes.length >= GRAPH_LIMITS.maxNodes) { skipped.push(`the graph is full (${GRAPH_LIMITS.maxNodes} nodes)`); break }
    const node: GraphNode = {
      id: randomUUID(),
      label,
      kind: clean(raw?.kind, 24) || 'concept',
      chatId: input.chatId || undefined,
      createdAt: now,
    }
    next.nodes.push(node)
    byKey.set(keyOf(label), node)
    addedNodes++
  }

  const seenEdges = new Set(next.edges.map((e) => `${e.from}|${e.to}|${e.label}`))
  const edgeInputs = (input.edges ?? []).slice(0, GRAPH_LIMITS.edgesPerSave)
  if ((input.edges ?? []).length > GRAPH_LIMITS.edgesPerSave) skipped.push(`only the first ${GRAPH_LIMITS.edgesPerSave} edges of this save were kept`)
  for (const raw of edgeInputs) {
    // An edge names its ends by label, which is what the agent knows; an id is accepted too.
    const from = byKey.get(keyOf(clean(raw?.from, GRAPH_LIMITS.labelChars)))?.id ?? next.nodes.find((n) => n.id === raw?.from)?.id
    const to = byKey.get(keyOf(clean(raw?.to, GRAPH_LIMITS.labelChars)))?.id ?? next.nodes.find((n) => n.id === raw?.to)?.id
    if (!from || !to) { skipped.push('an edge pointed at a node that is not in the graph'); continue }
    if (from === to) { skipped.push('an edge cannot join a node to itself'); continue }
    const label = clean(raw?.label, 40) || 'relates to'
    const key = `${from}|${to}|${label}`
    if (seenEdges.has(key)) continue
    if (next.edges.length >= GRAPH_LIMITS.maxEdges) { skipped.push(`the graph is full (${GRAPH_LIMITS.maxEdges} edges)`); break }
    next.edges.push({ id: randomUUID(), from, to, label, createdAt: now })
    seenEdges.add(key)
    addedEdges++
  }

  return { graph: next, summary: { addedNodes, addedEdges, skipped } }
}

/** Where the graph file lives: GRAPH_PATH, or next to the database. */
export function graphPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GRAPH_PATH?.trim()) return env.GRAPH_PATH.trim()
  const dbPath = env.DB_PATH ?? './research-engine.db'
  return join(dirname(dbPath), 'birds-eye-graph.json')
}

export function readGraph(path = graphPath()): Graph {
  if (!existsSync(path)) return emptyGraph()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed?.version === 1 && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed as Graph
  } catch { /* a damaged file is treated as empty, and the next save rewrites it */ }
  return emptyGraph()
}

/** Writes the file through a temporary name, so a crash never leaves half a graph. */
export function writeGraph(graph: Graph, path = graphPath()): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(graph, null, 2), 'utf8')
  renameSync(tmp, path)
}

/** Reads, merges and writes in one step. The route uses this. */
export function saveToGraph(input: SaveInput, path = graphPath()): { graph: Graph; summary: SaveSummary } {
  const merged = mergeIntoGraph(readGraph(path), input)
  writeGraph(merged.graph, path)
  return merged
}
