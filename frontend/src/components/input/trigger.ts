// Finds a "/" (skills) or "@" (sources) trigger at the caret.
//
// The trigger is the word the caret is at the end of. It counts anywhere in the
// message, but only when the word starts with the character, so "https://…" or
// "mail@host" do not open a picker.
export interface Trigger {
  kind: 'skill' | 'source'
  query: string
  /** Index of the trigger character. */
  start: number
  /** Caret position (end of the trigger word). */
  end: number
}

export function triggerAt(text: string, caret: number): Trigger | null {
  let start = caret
  while (start > 0 && !/\s/.test(text[start - 1])) start--
  const token = text.slice(start, caret)
  const ch = token[0]
  if (ch !== '/' && ch !== '@') return null
  return { kind: ch === '/' ? 'skill' : 'source', query: token.slice(1), start, end: caret }
}

/** Replace the trigger word with `replacement` and return the new text. */
export function replaceTrigger(text: string, t: { start: number; end: number }, replacement: string): string {
  return text.slice(0, t.start) + replacement + text.slice(t.end)
}
