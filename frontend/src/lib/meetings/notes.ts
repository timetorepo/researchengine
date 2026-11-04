import { generateText } from '@/lib/chat/generate'
import type { Gap, Segment, TemplateId } from './model'
import { notesPrompt, templateOf } from './templates'

/**
 * Meeting notes from the typed notes and the timed transcript, written by the
 * model the user has configured. Returns null when no model is set up (the
 * on-device fallback answers with a demo string), so the caller can say so
 * instead of making notes up.
 */
export async function writeMeetingNotes(
  input: { title: string; memo: string; template: TemplateId; segments: Segment[]; transcript: string; gaps: Gap[] },
  signal?: AbortSignal,
): Promise<string | null> {
  const { system, prompt } = notesPrompt({ ...input, template: templateOf(input.template) })
  const res = await generateText({ system, prompt, temperature: 0.2, maxTokens: 1500, signal }).catch(() => null)
  if (!res || res.usedDemo) return null
  return res.text.trim() || null
}
