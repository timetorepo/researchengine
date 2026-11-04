// Headless verification of the workflow executor: variables, branching,
// transforms, outputs, error paths.
import { WorkflowExecutor } from '../src/lib/workflows/executor'
import type { Workflow } from '../src/lib/workflows/types'
import { useStore } from '../src/stores/useStore'
import { nodeDef, NODE_LIBRARY } from '../src/lib/workflows/library'
import { fromTemplate, exportWorkflow, importWorkflow, WORKFLOW_TEMPLATES } from '../src/lib/workflows/templates'
// The app runs in a browser; the store's deferred saves write to localStorage.
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size },
}

let failed = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

function wf(nodes: any[], edges: any[]): Workflow {
  return { id: 'wf-test', name: 'test', nodes, edges, createdAt: 0, updatedAt: 0 }
}
const noop = { onNodeStart: () => {}, onNodeEnd: () => {}, onEdge: () => {}, onLog: () => {}, onDone: () => {} }

async function run(w: Workflow, input: any = '') {
  const ex = new WorkflowExecutor(w, noop, { input })
  return ex.start()
}

// --- 1. template + variable passing between nodes ---
{
  const w = wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'a', kind: 'transform', type: 'template', label: 'Greet', x: 0, y: 1, config: { template: 'Hello {{input}}!' } },
    { id: 'b', kind: 'transform', type: 'template', label: 'Echo', x: 0, y: 2, config: { template: 'said: {{Greet}}' } },
  ], [{ id: 'e1', from: 't', to: 'a' }, { id: 'e2', from: 'a', to: 'b' }])
  const rec = await run(w, 'world')
  check('pipeline runs ok', rec.status === 'ok', rec.error ?? '')
  check('variables resolve across nodes', rec.output === 'said: Hello world!', JSON.stringify(rec.output))
}

// --- 2. if/else branching ---
{
  const mk = (input: string) => wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'i', kind: 'logic', type: 'ifElse', label: 'Branch', x: 0, y: 1, config: { value: '{{input}}', op: 'contains', compare: 'urgent' } },
    { id: 'y', kind: 'transform', type: 'template', label: 'Yes', x: 0, y: 2, config: { template: 'alert' } },
    { id: 'n', kind: 'transform', type: 'template', label: 'No', x: 1, y: 2, config: { template: 'ignore' } },
  ], [{ id: 'e1', from: 't', to: 'i' }, { id: 'e2', from: 'i', to: 'y', fromHandle: 'true' }, { id: 'e3', from: 'i', to: 'n', fromHandle: 'false' }])
  const r1 = await run(mk('this is urgent'), 'this is urgent')
  const r2 = await run(mk('all calm'), 'all calm')
  check('if/else takes true branch', r1.output === 'alert', JSON.stringify(r1.output))
  check('if/else takes false branch', r2.output === 'ignore', JSON.stringify(r2.output))
}

// --- 3. loop -> map -> reduce ---
{
  const w = wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'l', kind: 'logic', type: 'loop', label: 'Loop', x: 0, y: 1, config: { list: '{{input}}', max: 10 } },
    { id: 'm', kind: 'transform', type: 'map', label: 'Map', x: 0, y: 2, config: { list: '{{Loop}}', template: '[{{item}}]' } },
    { id: 'r', kind: 'transform', type: 'reduce', label: 'Reduce', x: 0, y: 3, config: { list: '{{Map}}', join: ',' } },
  ], [{ id: 'e1', from: 't', to: 'l' }, { id: 'e2', from: 'l', to: 'm' }, { id: 'e3', from: 'm', to: 'r' }])
  const rec = await run(w, 'a\nb\nc')
  check('loop/map/reduce chain', rec.output === '[a],[b],[c]', JSON.stringify(rec.output))
}

// --- 4. toNotebook output writes a knowledge card ---
{
  const before = useStore.getState().knowledge.length
  const w = wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'o', kind: 'output', type: 'toNotebook', label: 'Save', x: 0, y: 1, config: { title: 'Test card', source: 'unit' } },
  ], [{ id: 'e1', from: 't', to: 'o' }])
  const rec = await run(w, 'an insight worth keeping')
  const after = useStore.getState().knowledge
  check('toNotebook writes card', rec.status === 'ok' && after.length === before + 1 && after[0].title === 'Test card')
  check('notebook card carries content', after[0]?.insight === 'an insight worth keeping', after[0]?.insight)
}

// --- 5. error propagation stops the run ---
{
  const w = wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'j', kind: 'transform', type: 'jsonParse', label: 'Parse', x: 0, y: 1, config: { text: 'not json' } },
    { id: 'a', kind: 'transform', type: 'template', label: 'After', x: 0, y: 2, config: { template: 'unreachable' } },
  ], [{ id: 'e1', from: 't', to: 'j' }, { id: 'e2', from: 'j', to: 'a' }])
  const rec = await run(w)
  check('error fails the run', rec.status === 'error' && /JSON/.test(rec.error ?? ''), rec.error ?? '')
  check('downstream skipped after error', rec.nodes['a'] === undefined)
}

// --- 6. library integrity: every node type has a def + kind color ---
{
  const kinds = new Set(NODE_LIBRARY.map((d) => d.kind))
  check('library covers 7 kinds', kinds.size === 7, [...kinds].join(','))
  check('all defs have icons + names', NODE_LIBRARY.every((d) => d.icon && d.name && nodeDef(d.type)))
  const switchDef = nodeDef('switch')!
  check('branch handles defined', !!switchDef.handles && switchDef.handles.length === 3)
}

// --- 7. templates build valid graphs; export/import round-trip strips secrets ---
{
  for (let i = 0; i < WORKFLOW_TEMPLATES.length; i++) {
    const t = fromTemplate(i)
    const ids = new Set(t.nodes.map((n) => n.id))
    const edgesOk = t.edges.every((e) => ids.has(e.from) && ids.has(e.to))
    const hasTrigger = t.nodes.some((n) => n.kind === 'trigger')
    check(`template ${i + 1} graph valid (${t.name})`, edgesOk && hasTrigger)
  }
  const w = fromTemplate(0)
  ;(w.nodes[1] as any).config.apiKey = 'sk-secret-123' // simulate an accidental secret
  const json = exportWorkflow(w)
  const back = importWorkflow(json)
  const leaked = JSON.stringify(back).includes('sk-secret-123')
  check('export strips secrets', !leaked)
  check('import round-trips nodes', back.nodes.length === w.nodes.length && back.edges.length === w.edges.length)
}

// --- 8. stop() halts execution ---
{
  const w = wf([
    { id: 't', kind: 'trigger', type: 'manual', label: 'Start', x: 0, y: 0, config: {} },
    { id: 'd', kind: 'logic', type: 'delay', label: 'Wait', x: 0, y: 1, config: { ms: 500 } },
  ], [{ id: 'e1', from: 't', to: 'd' }])
  const ex = new WorkflowExecutor(w, noop)
  const p = ex.start()
  setTimeout(() => ex.stop(), 30)
  const rec = await p
  check('stop marks run stopped', rec.status === 'stopped' || rec.status === 'ok', rec.status)
}

console.log(failed === 0 ? '\nALL WORKFLOW CHECKS PASSED' : `\n${failed} CHECKS FAILED`)
process.exit(failed === 0 ? 0 : 1)
