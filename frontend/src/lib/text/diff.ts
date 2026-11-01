/**
 * The smallest diff that is honest.
 *
 * The app shows it in one place: reviewing the edit you are about to make to
 * one of your own messages. A full Myers diff is overkill for a paragraph or
 * two — so this trims the common prefix and suffix (which is most of the text)
 * and marks the middle as removed / added. That is exactly what changed.
 */
export interface DiffLine {
  content: string
  kind: 'added' | 'removed' | 'context'
  number?: number
}

/** Long enough for any message a person edits by hand, short enough to render. */
const MAX_LINES = 400

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n').slice(0, MAX_LINES)
  const b = after.split('\n').slice(0, MAX_LINES)
  const out: DiffLine[] = []

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++

  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB-- }

  for (let i = 0; i < start; i++) out.push({ content: a[i], kind: 'context', number: i + 1 })
  for (let i = start; i <= endA; i++) out.push({ content: a[i], kind: 'removed', number: i + 1 })
  for (let i = start; i <= endB; i++) out.push({ content: b[i], kind: 'added', number: i + 1 })

  for (let i = endA + 1, j = endB + 1; i < a.length && j < b.length; i++, j++) {
    out.push({ content: a[i], kind: 'context', number: i + 1 })
  }
  return out
}
