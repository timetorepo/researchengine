// Working connectors: Local Files, Drive, Mail and Calendar.
// Everything is stored in <dataDir>/connectors and is fully queryable by the
// AI through tool calls. Local-first by design: nothing leaves this machine.
//   drive/    <id>.json  { id, name, mime, text?, dataBase64?, addedAt }
//   mail/     <id>.json  { id, from, to, subject, body, date, read }
//   calendar/ <id>.json  { id, title, date, time?, location?, notes?, attendees? }
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Runtime } from '../runtime'

const BOXES = ['drive', 'mail', 'calendar', 'files'] as const
type Box = typeof BOXES[number]
const CAPS: Record<Box, number> = { drive: 8 * 1024 * 1024, mail: 512 * 1024, calendar: 256 * 1024, files: 8 * 1024 * 1024 }

export function connectorRoutes(rt: Runtime) {
  const r = new Hono()
  const root = resolve(join(rt.dataDir, 'connectors'))
  const boxDir = (box: Box) => join(root, box)

  const isBox = (b: string): b is Box => (BOXES as readonly string[]).includes(b)

  const listItems = async (box: Box): Promise<any[]> => {
    await mkdir(boxDir(box), { recursive: true })
    const out: any[] = []
    for (const f of await readdir(boxDir(box))) {
      if (!f.endsWith('.json')) continue
      try { out.push(JSON.parse(await readFile(join(boxDir(box), f), 'utf8'))) } catch { /* skip */ }
    }
    return out.sort((a, b) => (b.addedAt ?? b.date ?? 0) - (a.addedAt ?? a.date ?? 0))
  }

  r.get('/connectors/list', async (c) => {
    const box = c.req.query('box') ?? ''
    if (!isBox(box)) return c.json({ error: 'Unknown connector box.' }, 400)
    const items = await listItems(box)
    // List view drops heavy payloads.
    return c.json({ box, items: items.map(({ dataBase64, body, notes, ...rest }: any) => ({ ...rest, preview: (body ?? notes ?? '').slice(0, 160) })) })
  })

  r.get('/connectors/item', async (c) => {
    const box = c.req.query('box') ?? ''
    const id = (c.req.query('id') ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
    if (!isBox(box) || !id) return c.json({ error: 'Bad request.' }, 400)
    try {
      const item = JSON.parse(await readFile(join(boxDir(box), `${id}.json`), 'utf8'))
      if (box !== 'drive') delete item.dataBase64
      return c.json({ item })
    } catch {
      return c.json({ error: 'Item not found.' }, 404)
    }
  })

  // Full-text search across one box (or all boxes).
  r.get('/connectors/search', async (c) => {
    const q = (c.req.query('q') ?? '').toLowerCase()
    const box = c.req.query('box') ?? ''
    const boxes: Box[] = isBox(box) ? [box] : ['drive', 'mail', 'calendar']
    const hits: any[] = []
    for (const b of boxes) {
      for (const item of await listItems(b)) {
        const hay = JSON.stringify({ ...item, dataBase64: undefined }).toLowerCase()
        if (!q || hay.includes(q)) hits.push({ box: b, id: item.id, title: item.name ?? item.subject ?? item.title, snippet: (item.body ?? item.notes ?? item.text ?? '').slice(0, 200), date: item.date ?? item.addedAt })
      }
    }
    return c.json({ q, hits: hits.slice(0, 40) })
  })

  r.post('/connectors/add', async (c) => {
    let body: any
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON body.' }, 400) }
    const box = body.box as Box
    if (!isBox(box)) return c.json({ error: 'Unknown connector box.' }, 400)
    const id = randomUUID().slice(0, 8)
    let item: any
    if (box === 'drive' || box === 'files') {
      const buf = Buffer.from(body.dataBase64 ?? '', 'base64')
      if (buf.length > CAPS[box]) return c.json({ error: 'File larger than 8 MB.' }, 413)
      // Accept either a file (dataBase64) or a pasted text note.
      if (!buf.length && !String(body.text ?? '').trim()) return c.json({ error: 'Provide a file or some text.' }, 400)
      item = { id, name: String(body.name ?? 'file').slice(0, 200), mime: body.mime ?? (buf.length ? 'application/octet-stream' : 'text/plain'), text: body.text ?? null, dataBase64: buf.length ? body.dataBase64 : null, addedAt: Date.now() }
    } else if (box === 'mail') {
      item = { id, from: body.from ?? '', to: body.to ?? '', subject: String(body.subject ?? '').slice(0, 300), body: String(body.body ?? '').slice(0, CAPS.mail), date: body.date ?? new Date().toISOString(), read: false, addedAt: Date.now() }
    } else {
      item = { id, title: String(body.title ?? '').slice(0, 300), date: body.date ?? '', time: body.time ?? '', location: body.location ?? '', notes: String(body.notes ?? '').slice(0, CAPS.calendar), attendees: body.attendees ?? [], addedAt: Date.now() }
    }
    await mkdir(boxDir(box), { recursive: true })
    await writeFile(join(boxDir(box), `${id}.json`), JSON.stringify(item))
    return c.json({ ok: true, id })
  })

  r.delete('/connectors/item', async (c) => {
    const box = c.req.query('box') ?? ''
    const id = (c.req.query('id') ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
    if (!isBox(box) || !id) return c.json({ error: 'Bad request.' }, 400)
    await rm(join(boxDir(box), `${id}.json`), { force: true })
    return c.json({ ok: true })
  })

  return r
}
