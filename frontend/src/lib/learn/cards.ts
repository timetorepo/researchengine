/**
 * The mechanics behind the Learn techniques, kept free of React so each rule
 * can be read and tested on its own.
 *
 *  - Active recall: a sentence from the document with its key term blanked
 *    out. You type the term from memory before it is shown to you.
 *  - Spaced repetition: each card carries an SM-2 schedule (ease, interval,
 *    due date). "Missed" resets the interval, "Easy" stretches it.
 *  - Feynman: you explain a topic in your own words, and it is graded for
 *    coverage of the source. A model grades it when one is configured; the
 *    fallback counts which key terms you used, and says that it did.
 *  - Dual coding: each term is paired with a picture you choose and a line you
 *    write, so the idea is held as words and as an image at once.
 */
import { nanoid } from 'nanoid'
import { sentences } from '@/lib/documents/extract'
import { generateText } from '@/lib/chat/generate'
import type { SpacedCard } from '@/types'

const STOP = new Set([
  'about', 'above', 'after', 'again', 'against', 'along', 'also', 'although', 'among', 'another', 'because',
  'before', 'being', 'between', 'could', 'during', 'each', 'either', 'every', 'example', 'first', 'found',
  'from', 'further', 'given', 'having', 'however', 'important', 'include', 'includes', 'information', 'other',
  'people', 'please', 'provide', 'public', 'rather', 'really', 'second', 'several', 'should', 'since', 'some',
  'their', 'there', 'these', 'thing', 'things', 'think', 'those', 'through', 'under', 'until', 'using', 'where',
  'whether', 'which', 'while', 'would', 'years', 'think', 'within', 'without', 'there', 'becomes', 'called',
])

/** Words worth asking about: capitalised terms first, then long plain words. */
export function keyTerms(sentence: string): string[] {
  const words = sentence.match(/[A-Za-z][A-Za-z-]{3,}/g) ?? []
  const seen = new Set<string>()
  const scored: { w: string; score: number }[] = []
  words.forEach((w, i) => {
    const lower = w.toLowerCase()
    if (STOP.has(lower) || seen.has(lower)) return
    seen.add(lower)
    const capital = /^[A-Z]/.test(w) && i > 0
    const score = (capital ? 4 : 0) + Math.min(w.length, 12) / 3
    scored.push({ w, score })
  })
  return scored.sort((a, b) => b.score - a.score).map((s) => s.w)
}

/** Blank the first occurrence of `term` in `sentence`, whole word and case-insensitive. */
export function blank(sentence: string, term: string): string {
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return sentence.replace(re, '_____')
}

/** Build recall cards from a document. Deterministic: the same text gives the same cards. */
export function clozeCards(text: string, docId: string, max = 12, now = Date.now()): SpacedCard[] {
  const out: SpacedCard[] = []
  const used = new Set<string>()
  for (const s of sentences(text)) {
    if (out.length >= max) break
    const term = keyTerms(s).find((t) => t.length >= 4 && t.length <= 24 && !used.has(t.toLowerCase()))
    if (!term) continue
    used.add(term.toLowerCase())
    out.push({
      id: nanoid(8), docId, front: blank(s, term), answer: term, context: s,
      ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, due: now,
    })
  }
  return out
}

/**
 * Does a typed answer match the expected term? Case, punctuation and a single
 * typo in a long word are forgiven; a different word is not.
 */
export function matchesAnswer(typed: string, expected: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = norm(typed)
  const b = norm(expected)
  if (!a) return false
  if (a === b) return true
  const allow = b.length >= 7 ? 1 : 0
  return levenshtein(a, b) <= allow
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[a.length][b.length]
}

/** The four buttons under a card. Quality follows the SM-2 scale, collapsed to four. */
export type Recall = 'missed' | 'hard' | 'good' | 'easy'

/** One SM-2 step. Returns a new card; the input is not mutated. */
export function scheduleCard(card: SpacedCard, rating: Recall, now = Date.now()): SpacedCard {
  const q = { missed: 0, hard: 2, good: 4, easy: 5 }[rating]
  let { ease, intervalDays, reps, lapses } = card
  if (q < 3) {
    reps = 0
    lapses += 1
    intervalDays = 0
    // a miss returns the card to the queue in ten minutes, not tomorrow
    return {
      ...card, ease: Math.max(1.3, ease - 0.2), intervalDays, reps, lapses,
      due: now + 10 * 60_000,
    }
  }
  reps += 1
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  if (reps === 1) intervalDays = 1
  else if (reps === 2) intervalDays = 3
  else intervalDays = Math.max(1, Math.round(intervalDays * ease))
  if (rating === 'hard') intervalDays = Math.max(1, Math.round(intervalDays * 0.7))
  return { ...card, ease, intervalDays, reps, lapses, due: now + intervalDays * 86_400_000 }
}

/** Cards due now, most overdue first. */
export function dueCards(cards: SpacedCard[], now = Date.now()): SpacedCard[] {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due)
}

/* ------------------------------------------------------------------ */
/* Feynman                                                             */
/* ------------------------------------------------------------------ */

export interface FeynmanGrade {
  score: number // 0–100
  covered: string[]
  missing: string[]
  feedback: string
  /** true when a model graded it, false when the on-device coverage check did */
  byModel: boolean
}

/** Coverage of the source's key terms, in the learner's own words. */
export function heuristicFeynman(explanation: string, excerpt: string): FeynmanGrade {
  const words = new Set((explanation.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []))
  const terms = keyTerms(excerpt).slice(0, 8)
  const covered = terms.filter((t) => words.has(t.toLowerCase()))
  const missing = terms.filter((t) => !words.has(t.toLowerCase()))
  const wc = explanation.trim().split(/\s+/).filter(Boolean).length
  const coverage = terms.length ? covered.length / terms.length : 0
  // A plain explanation that uses half the key ideas is better than a long one that uses none.
  const lengthBonus = wc >= 40 ? 10 : wc >= 20 ? 5 : 0
  const score = Math.round(Math.min(100, coverage * 90 + lengthBonus))
  const feedback = missing.length
    ? `You covered ${covered.length} of ${terms.length} key ideas. Try to say what ${missing.slice(0, 2).join(' and ')} ${missing.length > 1 ? 'are' : 'is'}, in a sentence a friend would follow.`
    : 'You used every key idea. Now check that each one is explained, not just named.'
  return { score, covered, missing, feedback, byModel: false }
}

/**
 * Grade an explanation. A configured model reads it against the source; if
 * none answers, the on-device coverage check runs instead and says so.
 */
export async function gradeFeynman(topic: string, excerpt: string, explanation: string, signal?: AbortSignal): Promise<FeynmanGrade> {
  const fallback = heuristicFeynman(explanation, excerpt)
  try {
    const res = await generateText({
      system: 'You grade a learner\'s explanation against a source passage. Be fair and specific. Reply with JSON only.',
      prompt: [
        `Topic: ${topic}`,
        `Source passage:\n"""${excerpt.slice(0, 6000)}"""`,
        `Learner's explanation (in their own words):\n"""${explanation.slice(0, 4000)}"""`,
        'Score how well the explanation shows understanding of the source, from 0 to 100. A plain-language explanation that is correct scores high; repeating phrases from the source without saying what they mean scores low.',
        'Return JSON only: {"score": number, "covered": [up to 4 key ideas the learner explained correctly], "missing": [up to 4 key ideas the learner left out or got wrong], "feedback": "two sentences, addressed to the learner"}',
      ].join('\n\n'),
      temperature: 0.2,
      maxTokens: 500,
      signal,
    })
    if (res.usedDemo) return fallback
    const parsed = parseJsonObject(res.text)
    if (!parsed || typeof parsed.score !== 'number') return fallback
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      covered: strings(parsed.covered).slice(0, 4),
      missing: strings(parsed.missing).slice(0, 4),
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : fallback.feedback,
      byModel: true,
    }
  } catch {
    return fallback
  }
}

/* ------------------------------------------------------------------ */
/* Dual coding                                                         */
/* ------------------------------------------------------------------ */

export interface DualItem {
  term: string
  /** The sentence the term came from: the words side of the pairing. */
  definition: string
}

/** Terms to pair with a picture: each one with the sentence it appears in. */
export function dualCodeItems(text: string, n = 5): DualItem[] {
  const out: DualItem[] = []
  const used = new Set<string>()
  for (const s of sentences(text)) {
    if (out.length >= n) break
    const term = keyTerms(s).find((t) => t.length >= 4 && !used.has(t.toLowerCase()))
    if (!term) continue
    used.add(term.toLowerCase())
    out.push({ term, definition: s })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function parseJsonObject(raw: string): any | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(raw.slice(start, end + 1)) } catch { return null }
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
}
