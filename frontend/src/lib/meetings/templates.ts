import type { Gap, Segment, TemplateId } from './model'
import { clock, timedText } from './model'

export interface MeetingTemplate {
  id: TemplateId
  label: string
  sections: string[]
}

/** What the notes contain. The sections are the only shape the model is asked for. */
export const TEMPLATES: MeetingTemplate[] = [
  {
    id: 'general',
    label: 'General meeting',
    sections: [
      'Summary (three sentences at most)',
      'Key points (bullets)',
      'Decisions (bullets)',
      'Action items (bullets, with the owner when the transcript names one)',
      'Open questions (bullets)',
    ],
  },
  {
    id: 'one-to-one',
    label: '1:1',
    sections: [
      'What we talked about (bullets)',
      'Feedback and asks (bullets, with who said them)',
      'Follow-ups (bullets, with the owner)',
    ],
  },
  {
    id: 'interview',
    label: 'Interview or research call',
    sections: [
      'Who and why (only what the transcript says)',
      'Main answers (bullets, each with the question it answers)',
      'Quotes worth keeping (verbatim, with the time)',
      'Follow-ups (bullets)',
    ],
  },
  {
    id: 'study',
    label: 'Lecture or study session',
    sections: [
      'Topic in one line',
      'Main ideas (bullets)',
      'Terms to know (term: meaning as it was explained)',
      'Questions to check yourself (bullets)',
    ],
  },
]

export function templateOf(id: TemplateId | undefined): MeetingTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

/**
 * The prompt for notes. The typed notes are the person's own intent and are
 * given first; the timed transcript is the evidence. Lost audio is named so the
 * model does not fill the hole.
 */
export function notesPrompt(input: {
  title: string
  memo: string
  template: MeetingTemplate
  segments: Segment[]
  transcript: string
  gaps: Gap[]
}): { system: string; prompt: string } {
  const timed = input.segments.length ? timedText(input.segments, input.gaps) : input.transcript
  const missing = input.gaps.map((g) => `${clock(g.startSec)} to ${clock(g.endSec)}`)
  const parts = [
    `Meeting: ${input.title}`,
    input.memo.trim()
      ? `Notes typed during the meeting (the person's own words; they show what mattered to them, so check them against the transcript):\n"""${input.memo.trim()}"""`
      : 'No notes were typed during the meeting.',
    `Timed transcript. Speakers are not labelled:\n"""${timed}"""`,
    missing.length
      ? `Audio was missing for these spans, so nothing is known about them: ${missing.join('; ')}. Say so if it matters; do not fill them in.`
      : '',
    `Write the notes with these sections, and leave out any section with nothing in it:\n${input.template.sections.map((s) => `## ${s}`).join('\n')}`,
    'Do not invent names, numbers or decisions. If the transcript is unclear, say so.',
  ]
  return {
    system: 'You write accurate meeting notes. You only use what the transcript and the typed notes say. Markdown only.',
    prompt: parts.filter(Boolean).join('\n\n'),
  }
}
