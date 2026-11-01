/**
 * Calendar round — the calendar file rules, checked in Node.
 *
 *  1. Reading: folded lines, escaped text, all-day days, UTC times, a time zone
 *     name (Asia/Jakarta), a duration, a cancelled event that is left out, and a
 *     broken event that is counted but does not stop the file from loading.
 *  2. Recurrence: daily with COUNT, weekly on chosen days, monthly on the 31st
 *     (short months skipped, as RFC 5545 says), UNTIL, and a rule that started
 *     years ago still showing in a window far later.
 *  3. Writing: a file written by this app reads back to the same events.
 *
 * Run: npm run calendar-test --workspace frontend
 */
import { parseIcs, unfold, zonedToEpoch, occurrences, toIcs, type CalEvent } from '../src/lib/calendar/ics.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime()

const sample = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:one@example',
  'SUMMARY:Lunch\\, with Ana\\; notes',
  'DESCRIPTION:Bring the report\\nand the budget',
  'DTSTART;TZID=Asia/Jakarta:20261020T090000',
  'DTEND;TZID=Asia/Jakarta:20261020T100000',
  'LOCATION:Room 4B,',
  '  Level 2',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:two@example',
  'SUMMARY:Holiday',
  'DTSTART;VALUE=DATE:20261101',
  'DTEND;VALUE=DATE:20261103',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:three@example',
  'SUMMARY:Standup',
  'DTSTART:20261021T013000Z',
  'DURATION:PT45M',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:four@example',
  'SUMMARY:Cancelled thing',
  'DTSTART:20261022T010000Z',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:five@example',
  'SUMMARY:Broken',
  'DTSTART:not-a-date',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

console.log('1. Reading')
check('folded lines join back with the space kept', unfold('A:1\r\n  2\r\nB:3').join('|') === 'A:1 2|B:3', unfold('A:1\r\n  2\r\nB:3').join('|'))
const parsed = parseIcs(sample)
const byUid = Object.fromEntries(parsed.events.map((e) => [e.uid, e]))
check('four events read (cancelled left out, broken counted)', parsed.events.length === 3 && parsed.skipped === 1, `events ${parsed.events.length}, skipped ${parsed.skipped}`)
check('the cancelled event is not there', !byUid['four@example'])
const lunch = byUid['one@example'] as CalEvent
check('escaped title reads back', lunch.title === 'Lunch, with Ana; notes', lunch.title)
check('escaped notes keep their line break', lunch.notes === 'Bring the report\nand the budget', JSON.stringify(lunch.notes))
check('a folded location joins up', lunch.location === 'Room 4B, Level 2', JSON.stringify(lunch.location))
check('the Jakarta time is 02:00 UTC', lunch.start === Date.UTC(2026, 9, 20, 2, 0), new Date(lunch.start).toISOString())
check('the Jakarta end is an hour later', lunch.end - lunch.start === 3600000)
const holiday = byUid['two@example'] as CalEvent
check('an all-day event is marked all-day', holiday.allDay === true)
check('an all-day event starts at local midnight', holiday.start === local(2026, 11, 1))
check('an all-day end is the day it ends (exclusive)', holiday.end === local(2026, 11, 3))
const standup = byUid['three@example'] as CalEvent
check('a DURATION fills in the end', standup.end - standup.start === 45 * 60000)
check('zonedToEpoch matches a known instant', zonedToEpoch(2026, 10, 20, 9, 0, 0, 'Asia/Jakarta') === Date.UTC(2026, 9, 20, 2, 0))
check('an unknown time zone falls back to local time, not a crash', (() => {
  const p = parseIcs('BEGIN:VEVENT\nDTSTART;TZID=Windows Nope:20261020T090000\nEND:VEVENT')
  return p.events.length === 1 && p.events[0].start === local(2026, 10, 20, 9, 0)
})())

console.log('2. Recurrence')
const from = local(2026, 10, 1)
const to = local(2026, 11, 1)
const daily = { id: 'd', title: 'Daily', start: local(2026, 10, 1, 8), end: local(2026, 10, 1, 8, 30), allDay: false, rrule: 'FREQ=DAILY;COUNT=3' } as CalEvent
const dailyHits = occurrences(daily, from, to)
check('a daily rule with COUNT=3 gives three', dailyHits.length === 3, `${dailyHits.length}`)

const weekly = { id: 'w', title: 'Gym', start: local(2026, 10, 5, 7), end: local(2026, 10, 5, 8), allDay: false, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' } as CalEvent
const weeklyHits = occurrences(weekly, local(2026, 10, 1), local(2026, 10, 19))
const weekdays = weeklyHits.map((e) => new Date(e.start).getDay())
check('weekly on Monday and Wednesday over two weeks gives four', weeklyHits.length === 4, `${weeklyHits.length}`)
check('they fall on Monday and Wednesday only', weekdays.every((d) => d === 1 || d === 3), weekdays.join(','))

const monthly = { id: 'm', title: 'Rent', start: local(2026, 1, 31, 9), end: local(2026, 1, 31, 9, 30), allDay: false, rrule: 'FREQ=MONTHLY' } as CalEvent
const monthHits = occurrences(monthly, local(2026, 1, 1), local(2026, 8, 1)).map((e) => new Date(e.start).getMonth() + 1)
check('monthly on the 31st skips short months', monthHits.join(',') === '1,3,5,7', monthHits.join(','))

const until = { id: 'u', title: 'Until', start: local(2026, 10, 1, 8), end: local(2026, 10, 1, 9), allDay: false, rrule: `FREQ=DAILY;UNTIL=20261003T000000` } as CalEvent
const untilHits = occurrences(until, from, to)
check('UNTIL stops the rule', untilHits.length === 2, `${untilHits.length}`)

const longAgo = { id: 'l', title: 'Old daily', start: local(2019, 1, 1, 6), end: local(2019, 1, 1, 6, 15), allDay: false, rrule: 'FREQ=DAILY' } as CalEvent
const lateHits = occurrences(longAgo, local(2026, 10, 10), local(2026, 10, 12))
check('a daily rule from years ago still appears in a later window', lateHits.length === 2, `${lateHits.length}`)

const single = { id: 's', title: 'One', start: local(2026, 10, 3, 10), end: local(2026, 10, 3, 11), allDay: false } as CalEvent
check('a single event outside the window is not returned', occurrences(single, local(2026, 10, 4), local(2026, 10, 5)).length === 0)

console.log('3. Writing')
const written = toIcs([lunch, holiday, { ...standup, rrule: 'FREQ=DAILY;COUNT=2' }], 'Test')
check('the file has a calendar wrapper', written.startsWith('BEGIN:VCALENDAR') && written.trimEnd().endsWith('END:VCALENDAR'))
const back = parseIcs(written).events
check('three events read back', back.length === 3, `${back.length}`)
const backLunch = back.find((e) => e.title === 'Lunch, with Ana; notes')
check('the escaped title survives the round trip', !!backLunch)
check('the time survives the round trip', backLunch?.start === lunch.start)
check('the all-day flag survives', back.find((e) => e.title === 'Holiday')?.allDay === true)
check('the rule survives', back.find((e) => e.title === 'Standup')?.rrule === 'FREQ=DAILY;COUNT=2')
check('lines stay within 75 characters', written.split(/\r\n/).every((l) => l.length <= 75))

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILED'}: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
