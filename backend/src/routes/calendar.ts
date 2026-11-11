/**
 * Google Calendar, without a Google account login.
 *
 * Google Calendar gives every calendar a "secret address in iCal format": a
 * private link that anyone holding it can read. This route fetches that one
 * kind of link on the server, because Google's file does not allow a browser
 * to read it directly. It only accepts Google's own calendar host, so the
 * route cannot be pointed at anything else on the network.
 *
 * Nothing is stored here. The address is kept in the browser, and the events
 * are kept in the browser too.
 */
import { Hono } from 'hono'

export const calendarRoutes = new Hono()

const GOOGLE_ICS = /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s]+\.ics$/
const MAX_BYTES = 5_000_000

calendarRoutes.get('/ics', async (c) => {
  const url = c.req.query('url') ?? ''
  if (!GOOGLE_ICS.test(url)) {
    return c.json({ error: 'Only a Google Calendar secret address in iCal format can be fetched here (calendar.google.com/calendar/ical/…/basic.ics).' }, 400)
  }
  let res: Response
  try {
    res = await fetch(url, { headers: { 'user-agent': 'ResearchEngine-calendar' }, signal: AbortSignal.timeout(15_000) })
  } catch {
    return c.json({ error: 'Google did not answer. Check your connection and try again.' }, 502)
  }
  if (new URL(res.url || url).host !== 'calendar.google.com') {
    return c.json({ error: 'Google sent the request somewhere else, so nothing was read.' }, 502)
  }
  if (!res.ok) {
    return c.json({ error: `Google answered ${res.status}. Check the secret address in Google Calendar settings.` }, 502)
  }
  const text = await res.text()
  if (text.length > MAX_BYTES) return c.json({ error: 'That calendar is larger than 5 MB. Import an .ics file for it instead.' }, 413)
  if (!text.includes('BEGIN:VCALENDAR')) return c.json({ error: 'Google answered, but not with a calendar file.' }, 502)
  return c.body(text, 200, { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' })
})
