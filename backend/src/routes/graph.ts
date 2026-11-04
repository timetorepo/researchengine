/**
 * The bird's-eye graph, kept on this machine.
 *
 *   GET    /api/graph   — the whole graph
 *   POST   /api/graph   — { nodes, edges, chatId? } → what was added, and the graph
 *   DELETE /api/graph   — clears it (the file is removed by writing an empty graph)
 *
 * The agent reaches the same save through the `graph_save` tool. The user sees
 * each save in the chat and can open the preview window from there.
 */
import { Hono } from 'hono'
import { emptyGraph, readGraph, saveToGraph, writeGraph, type SaveInput } from '../services/graph/store'

export const graphRoutes = new Hono()

graphRoutes.get('/graph', (c) => c.json(readGraph()))

graphRoutes.post('/graph', async (c) => {
  let body: SaveInput
  try { body = (await c.req.json()) as SaveInput } catch { return c.json({ error: 'Send JSON with nodes and edges.' }, 400) }
  if (!body || (typeof body !== 'object') || (!Array.isArray(body.nodes) && !Array.isArray(body.edges))) {
    return c.json({ error: 'Send at least one node or edge.' }, 400)
  }
  const { graph, summary } = saveToGraph({ ...body, chatId: typeof body.chatId === 'string' ? body.chatId.slice(0, 80) : undefined })
  return c.json({ ...summary, graph })
})

graphRoutes.delete('/graph', (c) => {
  writeGraph(emptyGraph())
  return c.json({ ok: true })
})
