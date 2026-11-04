// Pre-configured workflow templates — each is a complete, runnable graph.
import { nanoid } from 'nanoid'
import type { Workflow, WorkflowNode, WorkflowEdge } from './types'
import { nodeDef } from './library'

function n(id: string, type: string, label: string, x: number, y: number, config: Record<string, any> = {}): WorkflowNode {
  const def = nodeDef(type)
  return { id, kind: def!.kind, type, label, x, y, config: { ...def!.defaults, ...config } }
}
function e(from: string, to: string, fromHandle?: string): WorkflowEdge {
  return { id: nanoid(6), from, to, fromHandle }
}

interface TemplateSpec { name: string; description: string; build: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] } }

export const WORKFLOW_TEMPLATES: TemplateSpec[] = [
  {
    name: 'Daily research digest',
    description: 'Search a topic every morning, summarize the findings, and file them into your notebook.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'template', 'Topic', 80, 200, { template: 'most important AI research news today' }),
        n('a2', 'groundedChat', 'Research', 80, 340, { prompt: '{{Topic}}' }),
        n('a3', 'summarize', 'Digest', 80, 480, { text: '{{Research}}', style: 'bullet digest' }),
        n('o1', 'toNotebook', 'File to notebook', 80, 620, { title: 'Daily digest', source: 'digest workflow' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'a3'), e('a3', 'o1')],
    }),
  },
  {
    name: 'Email triage',
    description: 'Classify incoming text as urgent or normal and route each branch differently.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 240, 40),
        n('a1', 'classify', 'Classify', 240, 180, { text: '{{input}}', labels: 'urgent, normal' }),
        n('l1', 'ifElse', 'Is urgent?', 240, 320, { value: '{{Classify}}', op: 'contains', compare: 'urgent' }),
        n('o1', 'notify', 'Alert me', 60, 480, { title: 'Urgent message', body: '{{Classify}}' }),
        n('o2', 'toNotebook', 'Log normal', 420, 480, { title: 'Normal message', source: 'triage' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'l1'), e('l1', 'o1', 'true'), e('l1', 'o2', 'false')],
    }),
  },
  {
    name: 'Paper monitor',
    description: 'Deep-dive a research topic and extract the key claims as structured data.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'template', 'Topic', 80, 200, { template: 'solid-state battery breakthroughs this month' }),
        n('a2', 'deepDive', 'Deep dive', 80, 340, { topic: '{{Topic}}' }),
        n('a3', 'extract', 'Key claims', 80, 480, { text: '{{Deep dive}}', schema: 'claim, evidence, date' }),
        n('o1', 'toNotebook', 'Save claims', 80, 620, { title: 'Paper watch', source: 'paper monitor' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'a3'), e('a3', 'o1')],
    }),
  },
  {
    name: 'Study session',
    description: 'Turn any topic into a concise study brief, then into flashcard-ready lines.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'groundedChat', 'Learn topic', 80, 200, { prompt: 'Explain {{input}} at a senior undergraduate level' }),
        n('a2', 'summarize', 'Brief', 80, 340, { text: '{{Learn topic}}', style: 'study brief' }),
        n('a3', 'rewrite', 'Flashcards', 80, 480, { text: '{{Brief}}', tone: 'question-and-answer flashcards, one per line' }),
        n('o1', 'exportFile', 'Download cards', 80, 620, { filename: 'flashcards.txt' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'a3'), e('a3', 'o1')],
    }),
  },
  {
    name: 'Content pipeline',
    description: 'Research, draft, rewrite in your voice, and export as an article.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'webSearch', 'Sources', 80, 200, { query: '{{input}}' }),
        n('a2', 'groundedChat', 'Draft', 80, 340, { prompt: 'Write a 500-word article about {{input}}' }),
        n('a3', 'rewrite', 'Voice pass', 80, 480, { text: '{{Draft}}', tone: 'confident and conversational' }),
        n('o1', 'toArticle', 'Create article', 80, 620, { title: '{{input}}' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'a3'), e('a3', 'o1')],
    }),
  },
  {
    name: 'Meeting prep',
    description: 'Given a meeting topic, gather background and produce a one-page brief.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'groundedChat', 'Background', 80, 200, { prompt: 'Background briefing on {{input}}' }),
        n('a2', 'template', 'Brief', 80, 340, { template: 'MEETING BRIEF\n\nTopic: {{input}}\n\n{{Background}}\n\nPrepared by Research Engine.' }),
        n('o1', 'toNotebook', 'Save brief', 80, 480, { title: 'Meeting brief', source: 'meeting prep' }),
        n('o2', 'notify', 'Ready', 80, 620, { title: 'Meeting brief ready', body: '{{input}}' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'o1'), e('o1', 'o2')],
    }),
  },
  {
    name: 'Code review companion',
    description: 'Paste a diff, get a structured review with risks and suggestions.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'chat', 'Review', 80, 200, { prompt: 'Review this code change. List risks, bugs, and improvements.\n\n{{input}}' }),
        n('a2', 'extract', 'Action items', 80, 340, { text: '{{Review}}', schema: 'risk, suggestion, severity' }),
        n('o1', 'exportFile', 'Download review', 80, 480, { filename: 'review.md' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'o1')],
    }),
  },
  {
    name: 'Newsletter builder',
    description: 'Collect the week’s highlights on your topics and compose a newsletter draft.',
    build: () => ({
      nodes: [
        n('t1', 'manual', 'Start', 80, 60),
        n('a1', 'template', 'Topics', 80, 200, { template: 'AI research, privacy tooling, open science' }),
        n('a2', 'loop', 'Each topic', 80, 340, { list: '{{Topics}}' }),
        n('a3', 'map', 'Search each', 80, 480, { list: '{{Each topic}}', template: '{{item}} — top story this week' }),
        n('a4', 'reduce', 'Combine', 80, 620, { list: '{{Search each}}', join: '\n' }),
        n('a5', 'groundedChat', 'Compose', 80, 760, { prompt: 'Write a friendly newsletter from these items:\n{{Combine}}' }),
        n('o1', 'toArticle', 'Newsletter draft', 80, 900, { title: 'This week' }),
      ],
      edges: [e('t1', 'a1'), e('a1', 'a2'), e('a2', 'a3'), e('a3', 'a4'), e('a4', 'a5'), e('a5', 'o1')],
    }),
  },
]

export function createWorkflow(partial: { name: string; description?: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }): Workflow {
  return {
    id: nanoid(8),
    name: partial.name,
    description: partial.description,
    nodes: partial.nodes,
    edges: partial.edges,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function fromTemplate(i: number): Workflow {
  const t = WORKFLOW_TEMPLATES[i]
  return createWorkflow({ name: t.name, description: t.description, ...t.build() })
}

export function blankWorkflow(): Workflow {
  return createWorkflow({
    name: 'Untitled workflow',
    nodes: [n(nanoid(4), 'manual', 'Start', 120, 80)],
    edges: [],
  })
}

/** Export strips secrets before sharing — defense in depth; nodes should never hold keys. */
export function exportWorkflow(wf: Workflow): string {
  const scrub = (o: any): any => {
    if (Array.isArray(o)) return o.map(scrub)
    if (o && typeof o === 'object') {
      const out: any = {}
      for (const [k, v] of Object.entries(o)) {
        if (/key|secret|token|password/i.test(k)) continue
        out[k] = scrub(v)
      }
      return out
    }
    return o
  }
  return JSON.stringify({ format: 'research-engine.workflow', version: 1, workflow: scrub(wf) }, null, 2)
}

export function importWorkflow(json: string): Workflow {
  const parsed = JSON.parse(json)
  const wf = parsed?.workflow ?? parsed
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) throw new Error('Not a Research Engine workflow file.')
  return { ...createWorkflow(wf), ...wf, id: nanoid(8), createdAt: Date.now(), updatedAt: Date.now() }
}
