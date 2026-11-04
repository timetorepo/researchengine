/**
 * Calls the graph and browse routes the way the frontend does.
 *   npx tsx backend/scripts/graph-route-test.ts
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'

const dir = mkdtempSync(join(tmpdir(), 'graph-route-'))
process.env.GRAPH_PATH = join(dir, 'birds-eye-graph.json')
const { graphRoutes } = await import('../src/routes/graph')
const { headlessRoutes } = await import('../src/routes/headless')
const app = new Hono()
app.route('/api', graphRoutes)
app.route('/api', headlessRoutes)

let failed = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }
const json = (method: string, path: string, body?: unknown) =>
  app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

try {
  const empty = await json('GET', '/api/graph')
  check('GET /api/graph starts empty', empty.status === 200 && ((await empty.json()) as any).nodes.length === 0)

  const saved = await json('POST', '/api/graph', { nodes: [{ label: 'Router', kind: 'module' }, { label: 'Store' }], edges: [{ from: 'Router', to: 'Store', label: 'writes' }], chatId: 'c1' })
  const body: any = await saved.json()
  check('POST /api/graph adds nodes and edges', saved.status === 200 && body.addedNodes === 2 && body.addedEdges === 1)
  check('POST returns the whole graph for the window', body.graph.nodes.length === 2)

  const bad = await json('POST', '/api/graph', { hello: 'world' })
  check('POST without nodes or edges is refused with 400', bad.status === 400)
  const notJson = await app.request('/api/graph', { method: 'POST', body: '{nope' })
  check('POST with broken JSON is refused with 400', notJson.status === 400)

  const cleared = await json('DELETE', '/api/graph')
  const after: any = await (await json('GET', '/api/graph')).json()
  check('DELETE clears the graph', cleared.status === 200 && after.nodes.length === 0 && after.edges.length === 0)

  const noUrl = await json('POST', '/api/browse', {})
  check('POST /api/browse without a url is refused with 400', noUrl.status === 400)
  const local = await json('POST', '/api/browse', { url: 'http://127.0.0.1/' })
  check('POST /api/browse refuses a private address', local.status === 400)
  const status: any = await (await json('GET', '/api/browse/status')).json()
  check('GET /api/browse/status reports the install folder', typeof status.installDir === 'string')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(failed ? `\n${failed} failed` : '\nALL PASS')
process.exit(failed ? 1 : 0)
