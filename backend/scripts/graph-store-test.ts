/**
 * Checks the bird's-eye graph merge rules and file store.
 *   npx tsx backend/scripts/graph-store-test.ts
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyGraph, GRAPH_LIMITS, mergeIntoGraph, readGraph, saveToGraph, graphPath } from '../src/services/graph/store'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

async function main() {

  const t0 = 1_700_000_000_000
  const first = mergeIntoGraph(emptyGraph(), {
    nodes: [{ label: 'Parser', kind: 'module' }, { label: 'parser' }, { label: '  Token  stream ' }, { label: '' }],
    edges: [{ from: 'Parser', to: 'Token stream', label: 'reads' }, { from: 'Parser', to: 'Parser' }, { from: 'Parser', to: 'Ghost' }],
    chatId: 'chat-1',
  }, t0)
  const g1 = first.graph
  check('merges nodes by label, ignoring case', g1.nodes.length === 2, `${g1.nodes.length} nodes`)
  check('trims and collapses label spaces', g1.nodes.some((n) => n.label === 'Token stream'))
  check('keeps the node kind, defaulting to concept', g1.nodes.find((n) => n.label === 'Token stream')?.kind === 'concept')
  check('adds one edge between known nodes', g1.edges.length === 1 && g1.edges[0].label === 'reads')
  check('refuses self-edges and unknown endpoints', first.summary.skipped.some((s) => /itself/.test(s)) && first.summary.skipped.some((s) => /not in the graph/.test(s)))
  check('a node with no label is skipped with a note', first.summary.skipped.some((s) => /no label/.test(s)))

  const again = mergeIntoGraph(g1, { nodes: [{ label: 'parser' }], edges: [{ from: 'Parser', to: 'Token stream', label: 'reads' }] }, t0 + 1)
  check('a repeated save adds nothing new', again.summary.addedNodes === 0 && again.summary.addedEdges === 0)

  const many = mergeIntoGraph(emptyGraph(), { nodes: Array.from({ length: GRAPH_LIMITS.nodesPerSave + 5 }, (_, i) => ({ label: `n${i}` })) }, t0)
  check('caps one save at the per-save node limit', many.summary.addedNodes === GRAPH_LIMITS.nodesPerSave && many.summary.skipped.length === 1)

  const dir = mkdtempSync(join(tmpdir(), 'graph-test-'))
  const path = join(dir, 'birds-eye-graph.json')
  try {
    check('default graph file sits next to the database', graphPath({ DB_PATH: '/data/research-engine.db' } as any) === '/data/birds-eye-graph.json')
    check('reads an empty graph when no file exists', readGraph(path).nodes.length === 0)
    saveToGraph({ nodes: [{ label: 'A' }, { label: 'B' }], edges: [{ from: 'A', to: 'B', label: 'calls' }] }, path)
    const back = readGraph(path)
    check('saves to disk and reads back', back.nodes.length === 2 && back.edges.length === 1)
    check('leaves no temporary file behind', !existsSync(`${path}.${process.pid}.tmp`))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(failed ? `\n${failed} check(s) failed` : '\nALL PASS')
  process.exit(failed ? 1 : 0)
}

main()
