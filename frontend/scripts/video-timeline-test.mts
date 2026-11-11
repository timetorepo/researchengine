// Video timeline: the AI's answer is read safely, clock times are understood, and
// the store adds, edits, removes and bulk-adds timeline notes without losing
// videos saved before the timeline existed.
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const lib = await import('../src/lib/library/videos')
const { parseAiTimeline, isClockText, parseStart, sortTimeline, timelinePrompt, useLibraryVideos, TRANSCRIPT_MAX } = lib

// ---- reading the AI's answer ----
{
  const fenced = '```json\n[{"time":"0:30","note":"Intro"},{"time":"1:05","note":"Main example"}]\n```'
  const a = parseAiTimeline(fenced)
  check('a fenced JSON array is read', a.length === 2 && a[0].at === 30 && a[1].at === 65, JSON.stringify(a))
}
{
  const prose = 'Here you go: [{"time": 90, "note": "Numeric seconds"}] Hope it helps.'
  const a = parseAiTimeline(prose)
  check('a sentence around the array is ignored, numeric time read', a.length === 1 && a[0].at === 90)
}
{
  const messy = JSON.stringify([
    { time: '1:02:03', note: 'Hour mark' },
    { time: 'soon', note: 'Not a clock time' },
    { time: '0:10', note: '' },
    { time: '0:10', note: '   ' },
    { time: '0:20' },
    { note: 'No time' },
    { time: '0:05', note: 'Early' },
    { time: '0:05', note: 'Early' },
    null,
    42,
  ])
  const a = parseAiTimeline(messy)
  check('bad lines are dropped, duplicates removed, rest sorted',
    a.length === 2 && a[0].at === 5 && a[1].at === 3723, JSON.stringify(a))
}
{
  const a = parseAiTimeline('[{"time":"0:30","note":"In"},{"time":"12:00","note":"Beyond the video"}]', 600)
  check('moments past the video length are dropped when the length is known', a.length === 1 && a[0].text === 'In')
}
{
  check('an answer with no array gives nothing', parseAiTimeline('Sorry, I cannot do that.').length === 0)
  check('broken JSON gives nothing', parseAiTimeline('[{"time": "0:10", "note": "oops"').length === 0)
  check('a non-array JSON value gives nothing', parseAiTimeline('{"time":"0:10","note":"x"}').length === 0)
}
{
  const long = JSON.stringify([{ time: '0:01', note: 'x'.repeat(500) }])
  const a = parseAiTimeline(long)
  check('very long note text is cut to 220 characters', a[0].text.length === 220)
}

// ---- clock text ----
{
  check('accepts 5, 1:23 and 1:02:03', ['5', '1:23', '1:02:03'].every(isClockText))
  check('rejects words and empty text', !isClockText('soon') && !isClockText('') && !isClockText('1:2'))
  check('parseStart reads 1:23 as 83 seconds', parseStart('1:23') === 83)
  check('parseStart reads 1:02:03 as 3723 seconds', parseStart('1:02:03') === 3723)
}

// ---- the prompt ----
{
  const p = timelinePrompt('Lecture 4', 'a'.repeat(TRANSCRIPT_MAX + 500))
  check('the prompt names the video', p.prompt.includes('Video: Lecture 4'))
  check('the transcript is cut to the limit', p.prompt.length < TRANSCRIPT_MAX + 200)
  check('the system prompt says the AI cannot watch the video', p.system.includes('cannot watch'))
}

// ---- the store ----
{
  useLibraryVideos.setState({
    videos: [{ id: 'vid_legacy', ytId: 'legacyvid01', title: 'Saved before timelines', addedAt: 1, notes: 'old', startAt: 0 }],
  })
  const legacy = useLibraryVideos.getState().videos[0]
  check('a video saved before the timeline has no timeline yet', legacy.timeline === undefined)

  useLibraryVideos.getState().addNote('vid_legacy', { at: 75, text: 'My point', by: 'user' })
  let v = useLibraryVideos.getState().videos[0]
  check('adding a note creates the timeline and keeps the old fields',
    v.timeline?.length === 1 && v.timeline[0].text === 'My point' && v.notes === 'old')
  const noteId = v.timeline![0].id
  check('a note gets an id and a time it was written', typeof noteId === 'string' && noteId.length > 0 && v.timeline![0].createdAt > 0)

  useLibraryVideos.getState().updateNote('vid_legacy', noteId, { at: 80, text: 'Edited point' })
  v = useLibraryVideos.getState().videos[0]
  check('editing a note changes its time and text', v.timeline![0].at === 80 && v.timeline![0].text === 'Edited point')

  const added = useLibraryVideos.getState().addNotes('vid_legacy', [
    { at: 10, text: 'AI intro', by: 'ai' },
    { at: 200, text: 'AI close', by: 'ai' },
  ])
  v = useLibraryVideos.getState().videos[0]
  check('bulk add returns how many were added', added === 2 && v.timeline!.length === 3)
  check('AI notes are marked as the AI\'s', v.timeline!.filter((n) => n.by === 'ai').length === 2)

  const ids = new Set(v.timeline!.map((n) => n.id))
  check('every note has its own id', ids.size === v.timeline!.length)

  check('sortTimeline puts notes in moment order', sortTimeline(v.timeline!).map((n) => n.at).join(',') === '10,80,200')

  useLibraryVideos.getState().removeNote('vid_legacy', noteId)
  v = useLibraryVideos.getState().videos[0]
  check('removing a note leaves the others', v.timeline!.length === 2 && !v.timeline!.some((n) => n.id === noteId))

  check('adding to a missing video adds nothing', useLibraryVideos.getState().addNotes('nope', [{ at: 1, text: 'x', by: 'user' }]) === 0)
  check('adding no notes adds nothing', useLibraryVideos.getState().addNotes('vid_legacy', []) === 0)

  useLibraryVideos.getState().addNote('vid_legacy', { at: 5, text: 'Only one', by: 'user' })
  check('timeline notes persist to storage', (mem.get('re.library.videos.v1') ?? '').includes('Only one'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
