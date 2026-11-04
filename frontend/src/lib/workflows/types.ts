// Workflow data model — persisted in the store, exportable as .workflow.json
export type NodeKind = 'trigger' | 'ai' | 'skill' | 'integration' | 'logic' | 'transform' | 'output'

export interface WorkflowNode {
  id: string
  kind: NodeKind
  type: string                 // key into the node library
  label: string
  x: number
  y: number
  config: Record<string, any>
  disabled?: boolean
}

/** fromHandle selects a branch: 'true' | 'false' | 'case:n' | 'item' | default undefined */
export interface WorkflowEdge {
  id: string
  from: string
  to: string
  fromHandle?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: number
  updatedAt: number
  lastRun?: { status: 'ok' | 'error' | 'stopped'; at: number; ms: number }
}

export type RunStatus = 'running' | 'ok' | 'error' | 'stopped' | 'paused'
export type NodeRunStatus = 'pending' | 'running' | 'ok' | 'error' | 'skipped'

export interface NodeRun {
  nodeId: string
  status: NodeRunStatus
  startedAt?: number
  ms?: number
  output?: any
  error?: string
  log?: string[]
}

export interface WorkflowRunRecord {
  id: string
  workflowId: string
  workflowName: string
  startedAt: number
  finishedAt?: number
  status: RunStatus
  nodes: Record<string, NodeRun>
  order: string[]
  output?: any
  error?: string
  tokensUsed?: number
}

export const NODE_W = 320
