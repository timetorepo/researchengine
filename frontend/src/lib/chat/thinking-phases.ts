/**
 * Thinking, in phases.
 *
 * A model's chain of thought is not one blob. It reasons, then it questions
 * itself, then it commits, and those are different things happening at
 * different times. Dumped as one preformatted wall it reads like a log nobody
 * asked for, and the part you actually want — where it changed its mind — is
 * buried in the middle of a paragraph.
 *
 * This splits a chain of thought into the phases it actually went through. The
 * boundaries come from the text itself: paragraph breaks, and the words a model
 * uses to turn a corner. Nothing here invents a phase the model did not have,
 * and the segmentation is labelled as inferred in the UI, because it is.
 *
 * The split is deliberately conservative. A phase boundary that is wrong is
 * worse than no boundary at all, so an unrecognised paragraph stays inside the
 * phase it started.
 */

export type PhaseKind =
  | 'reading'
  | 'planning'
  | 'reasoning'
  | 'doubting'
  | 'deciding'
  | 'verifying'
  | 'answering'

export interface ThinkingPhase {
  id: string
  kind: PhaseKind
  /** A short label for the timeline row. */
  label: string
  text: string
  /** Where it starts in the raw text, so the UI can show "so far". */
  from: number
  to: number
}

interface KindRule {
  kind: PhaseKind
  label: string
  /** Matched against the opening words of a paragraph. */
  re: RegExp
}

/**
 * What each kind of turn sounds like at the start of a paragraph. Ordered: the
 * first rule that matches wins, so the more specific ones come first.
 */
const RULES: KindRule[] = [
  { kind: 'doubting', label: 'Checking itself', re: /^(but wait|wait,|hmm|actually,? (let me|i)|on second thought|let me reconsider|hold on|although|however,? (i|let))/i },
  { kind: 'verifying', label: 'Verifying', re: /^(let me (verify|check|double[- ]check|confirm|test)|i should (verify|check)|to (verify|check|confirm)|sanity check)/i },
  { kind: 'deciding', label: 'Deciding', re: /^(so,? (i|the|we)|therefore|thus|in conclusion|the answer is|this means|which means|given that)/i },
  { kind: 'planning', label: 'Planning', re: /^(first,? (i|let)|let me (start|begin|plan|break)|my plan|step \d|i('| wi)ll (start|begin)|plan:|approach:)/i },
  { kind: 'reading', label: 'Reading the request', re: /^(the (user|question|request|prompt) (is|asks|wants|says)|they('| are) asking|i need to (understand|parse)|looking at (the|this))/i },
  { kind: 'answering', label: 'Writing the answer', re: /^(now (i|let)|next,? (i|let)|finally,? (i|let)|to (summarise|summarize|answer|write)|in (short|summary))/i },
]

const FALLBACK: KindRule = { kind: 'reasoning', label: 'Reasoning', re: /$/ }

/** A paragraph is a run of text between blank lines, or a long line. */
function paragraphs(text: string): { text: string; from: number }[] {
  const out: { text: string; from: number }[] = []
  let from = 0
  for (const raw of text.split(/\n{2,}/)) {
    const at = text.indexOf(raw, from)
    const trimmed = raw.trim()
    if (trimmed) out.push({ text: trimmed, from: at < 0 ? from : at })
    from = (at < 0 ? from : at) + raw.length
  }
  // A wall with no blank lines at all: fall back to single newlines, so a
  // stream that arrives one line at a time still gets segments.
  if (out.length <= 1) {
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length > 1) {
      let cursor = 0
      return lines.map((line) => {
        const at = text.indexOf(line, cursor)
        cursor = at + line.length
        return { text: line.trim(), from: at < 0 ? cursor : at }
      })
    }
  }
  return out
}

function kindOf(para: string): KindRule {
  for (const rule of RULES) if (rule.re.test(para.trim())) return rule
  return FALLBACK
}

/**
 * Split a chain of thought into phases.
 *
 * Adjacent paragraphs of the same kind merge, so a model that reasons for four
 * paragraphs shows one reasoning phase rather than four rows that all say the
 * same thing. A change of kind always starts a new phase.
 */
export function splitPhases(text: string): ThinkingPhase[] {
  const paras = paragraphs(text)
  if (!paras.length) return []
  const out: ThinkingPhase[] = []
  for (const para of paras) {
    const rule = kindOf(para.text)
    const last = out[out.length - 1]
    if (last && last.kind === rule.kind) {
      last.text = `${last.text}\n\n${para.text}`
      last.to = para.from + para.text.length
      continue
    }
    out.push({
      id: `${rule.kind}-${para.from}`,
      kind: rule.kind,
      label: rule.label,
      text: para.text,
      from: para.from,
      to: para.from + para.text.length,
    })
  }
  return out
}

/**
 * How far through the reasoning the model is, as a phase index and a label.
 *
 * Returns null when there is nothing to show, which is the common case for a
 * provider that does not expose its reasoning at all. The UI treats that as
 * "no chain of thought available" rather than as an error.
 */
export function currentPhase(text: string): ThinkingPhase | null {
  const phases = splitPhases(text)
  return phases.length ? phases[phases.length - 1] : null
}

/** The distinct kinds present, in the order they occurred, for the summary row. */
export function phaseSequence(text: string): { kind: PhaseKind; label: string }[] {
  const seen: { kind: PhaseKind; label: string }[] = []
  for (const p of splitPhases(text)) {
    if (!seen.some((s) => s.kind === p.kind)) seen.push({ kind: p.kind, label: p.label })
  }
  return seen
}

/** Colour per phase kind, from the theme's own tokens. */
export const PHASE_TONE: Record<PhaseKind, string> = {
  reading: 'var(--primary)',
  planning: 'var(--secondary)',
  reasoning: 'var(--text-2)',
  doubting: 'var(--warning)',
  deciding: 'var(--success)',
  verifying: 'var(--primary)',
  answering: 'var(--text-1)',
}
