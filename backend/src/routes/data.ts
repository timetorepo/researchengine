/**
 * The one route that deletes.
 *
 * Everything else in this app adds, reads, or updates. This exists because the
 * startup lock has a duress code, and a duress code that only clears the
 * browser's local storage is a decoration: the chats are still in the SQLite
 * file on disk. So the lock needs a way to reach the server-side store too.
 *
 * It is deliberately blunt and unauthenticated-looking, for one reason: it runs
 * on a loopback interface for an app whose entire promise is that the data
 * never leaves the machine. Adding a token would not protect the data from
 * anyone who already has the machine, and it would break the one case this
 * route exists for, which is that the person holding the machine is not its
 * owner. The duress code is the authorisation.
 *
 * If Research Engine is ever exposed on a network, this route must be gated
 * first. `health` reports the bind address so that is checkable.
 */
import { Hono } from 'hono'
import { db } from '../db'

export const dataRoutes = new Hono()

/** POST /api/data/wipe — every row, every table, on the server. */
dataRoutes.post('/wipe', (c) => {
  const result = db.wipeAll()
  return c.json({
    ok: true,
    wiped: result,
    note: 'The server-side store is empty. Local storage was cleared by the app before this call.',
  })
})
