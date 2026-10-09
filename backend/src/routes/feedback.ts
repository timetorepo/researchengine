/**
 * Feedback, kept on the user's machine.
 *
 * The about-box in the app says "found a bug, or something you want?" and the
 * answer is written into the same local database as everything else. Nothing is
 * posted anywhere: this app works offline, and a feedback button that silently
 * needs a server would be the one control that breaks the promise. The list is
 * readable from Settings → About at any time, which is what makes it a record
 * rather than a message in a bottle.
 */
import { Hono } from 'hono'
import { db } from '../db'

export const feedbackRoutes = new Hono()

const KINDS = new Set(['bug', 'idea', 'ui', 'performance', 'other'])

feedbackRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = String(body?.text ?? '').trim()
  if (text.length < 3) return c.json({ error: 'Feedback needs at least a few words.' }, 400)
  if (text.length > 8000) return c.json({ error: 'That is longer than this box is meant for (8000 characters).' }, 400)
  const kind = KINDS.has(String(body?.kind)) ? String(body.kind) : 'other'
  const entry = {
    id: String(body?.id ?? `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    kind,
    text,
    contact: body?.contact ? String(body.contact).slice(0, 200) : undefined,
    appVersion: body?.appVersion ? String(body.appVersion).slice(0, 40) : undefined,
    createdAt: Number(body?.createdAt) || Date.now(),
  }
  db.insertFeedback(entry)
  return c.json({ ok: true, entry })
})

feedbackRoutes.get('/', (c) => c.json({ feedback: db.listFeedback() }))

feedbackRoutes.delete('/:id', (c) => {
  db.deleteFeedback(c.req.param('id'))
  return c.json({ ok: true })
})
