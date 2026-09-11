import { nanoid } from 'nanoid'
import type { QuizQuestion } from '@/types'
import { sentences } from '@/lib/documents/extract'

export interface QuizConfig {
  count: number
  types: ('mc' | 'tf' | 'short' | 'fill')[]
  difficulty: 'easy' | 'medium' | 'hard'
  focus?: string
}

/** Deterministic-ish distractor pool. */
function distractors(correct: string, pool: string[], n = 3): string[] {
  const others = pool.filter((p) => p !== correct)
  const out: string[] = []
  for (const p of others.sort(() => Math.random() - 0.5)) {
    if (out.length >= n) break
    out.push(p)
  }
  while (out.length < n) out.push(`None of the above`)
  return out
}

function keyTerm(s: string): string | null {
  // pick the most "important" capitalized or long word
  const words = s.split(/\s+/).filter((w) => /^[A-Z][a-z]{3,}/.test(w) || w.length > 8)
  if (!words.length) return null
  return words.sort((a, b) => b.length - a.length)[0].replace(/[^A-Za-z0-9-]/g, '')
}

export function generateQuiz(text: string, cfg: QuizConfig): QuizQuestion[] {
  const sents = sentences(text)
  if (sents.length === 0) return []
  const questions: QuizQuestion[] = []
  const used = new Set<number>()
  const terms = sents.map((s) => keyTerm(s)).filter(Boolean) as string[]

  const pickSentence = (): [string, number] => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const i = Math.floor(Math.random() * sents.length)
      if (!used.has(i)) { used.add(i); return [sents[i], i] }
    }
    const i = Math.floor(Math.random() * sents.length)
    return [sents[i], i]
  }

  for (let q = 0; q < cfg.count; q++) {
    const type = cfg.types[q % cfg.types.length] ?? 'mc'
    const [sent, idx] = pickSentence()
    const term = keyTerm(sent)
    const section = `Section ${Math.floor(idx / Math.max(1, Math.floor(sents.length / 4))) + 1}`

    if (type === 'tf') {
      const negate = Math.random() > 0.5
      const flipped = negate ? sent.replace(/\bis\b|\bare\b|\bwas\b|\bwere\b/, (m) => m + ' not') : sent
      questions.push({
        id: nanoid(8), type: 'tf',
        prompt: `True or false: "${flipped}"`,
        answer: negate ? 'False' : 'True',
        explanation: negate
          ? `The source states the affirmative: "${sent.slice(0, 120)}…"`
          : `This matches the source: "${sent.slice(0, 120)}…"`,
        section,
      })
    } else if (type === 'fill' && term) {
      questions.push({
        id: nanoid(8), type: 'fill',
        prompt: sent.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '_____'),
        answer: term,
        explanation: `From the document: "${sent.slice(0, 140)}"`,
        section,
      })
    } else if (type === 'short') {
      questions.push({
        id: nanoid(8), type: 'short',
        prompt: `In your own words, explain: "${sent.slice(0, 90)}…"`,
        answer: sent,
        explanation: `Reference answer: "${sent.slice(0, 160)}"`,
        section,
      })
    } else {
      // multiple choice on the key term
      const correct = term ?? sent.split(' ')[0]
      const opts = [correct, ...distractors(correct, terms.length ? terms : sents.map((s) => s.split(' ')[0]))]
        .sort(() => Math.random() - 0.5)
      questions.push({
        id: nanoid(8), type: 'mc',
        prompt: `Which term completes or best relates to: "${sent.replace(correct, '_____').slice(0, 160)}"`,
        options: opts,
        answer: correct,
        explanation: `The document states: "${sent.slice(0, 140)}"`,
        section,
      })
    }
  }
  return questions
}
