import { generateText } from '@/lib/chat/generate'
import { sampleForModel } from '@/lib/learn/path'

/**
 * Meeting notes from a transcript, written by the model the user has
 * configured. Returns null when no model is set up (the on-device fallback
 * answers with a demo string), so the caller can say so instead of making
 * notes up.
 */
export async function writeMeetingNotes(title: string, transcript: string, signal?: AbortSignal): Promise<string | null> {
  const res = await generateText({
    system: 'You write accurate meeting notes from a transcript. You only use what the transcript says. Markdown only.',
    prompt: [
      `Meeting: ${title}`,
      `Transcript (excerpts from across the meeting; speakers are not labelled):\n"""${sampleForModel(transcript)}"""`,
      'Write the notes with these sections, and leave out any section with nothing in it:',
      '## Summary (three sentences at most)',
      '## Key points (bullets)',
      '## Decisions (bullets)',
      '## Action items (bullets, with the owner when the transcript names one)',
      '## Open questions (bullets)',
      'Do not invent names, numbers or decisions. If the transcript is unclear, say so.',
    ].join('\n\n'),
    temperature: 0.2,
    maxTokens: 1500,
    signal,
  }).catch(() => null)
  if (!res || res.usedDemo) return null
  return res.text.trim() || null
}
