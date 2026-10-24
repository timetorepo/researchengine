/**
 * The duolingo-style path: a document becomes units, units hold lessons, and
 * each lesson is three or four short questions taken from one passage.
 *
 * A path is only built when the learner presses the button. When a provider is
 * configured, a model writes the lessons from spaced slices of the document.
 * When none is, the on-device sentence engine writes them instead, and the path
 * records `builtWith: 'on-device'` so nobody mistakes the one for the other.
 */
import { nanoid } from 'nanoid'
import { sentences } from '@/lib/documents/extract'
import { generateText } from '@/lib/chat/generate'
import { generateQuiz } from '@/lib/quiz/generate'
import { useStore } from '@/stores/useStore'
import type { LearnPath, LearnProgress, PathLesson, PathUnit, QuizQuestion } from '@/types'
import { parseJsonObject } from './cards'

const LESSONS_PER_UNIT = 3
const MAX_UNITS = 4

/** Up to 24 000 characters, taken as six slices spread across the whole document. */
export function sampleForModel(text: string, budget = 24000): string {
  if (text.length <= budget) return text
  const slices = 6
  const size = Math.floor(budget / slices)
  const out: string[] = []
  for (let i = 0; i < slices; i++) {
    const start = Math.floor(((text.length - size) * i) / (slices - 1))
    out.push(text.slice(start, start + size))
  }
  return out.join('\n\n[…]\n\n')
}

export async function buildLearnPath(doc: { id: string; name: string; text: string }, signal?: AbortSignal): Promise<LearnPath> {
  const modelPath = await pathFromModel(doc, signal)
  if (modelPath) return modelPath
  return pathOnDevice(doc)
}

async function pathFromModel(doc: { id: string; name: string; text: string }, signal?: AbortSignal): Promise<LearnPath | null> {
  const res = await generateText({
    system: 'You write short, accurate study lessons from a document. You only use what the document says. Reply with JSON only.',
    prompt: [
      `Document title: ${doc.name}`,
      `Document text (excerpts from across the document):\n"""${sampleForModel(doc.text)}"""`,
      `Write a learning path: ${MAX_UNITS} units at most, ${LESSONS_PER_UNIT} lessons per unit, each lesson with exactly 3 questions.`,
      'Each lesson has: "title" (short), "goal" (one sentence: what the learner can do after it), "excerpt" (a passage copied word for word from the document, 25–60 words, that the questions come from), and "questions".',
      'Each question has: "type" ("mc" with four options, or "tf"), "prompt", "options" (for mc: four strings; for tf: ["True","False"]), "answer" (the exact text of the correct option), "explanation" (one sentence saying why).',
      'Return JSON only: {"title": string, "units": [{"title": string, "lessons": [...]}]}',
    ].join('\n\n'),
    temperature: 0.3,
    maxTokens: 4000,
    signal,
  }).catch(() => null)
  if (!res || res.usedDemo) return null
  const parsed = parseJsonObject(res.text)
  const units: PathUnit[] = []
  for (const u of Array.isArray(parsed?.units) ? parsed.units : []) {
    const lessons: PathLesson[] = []
    for (const l of Array.isArray(u?.lessons) ? u.lessons : []) {
      const questions = (Array.isArray(l?.questions) ? l.questions : []).map(toQuestion).filter(Boolean) as QuizQuestion[]
      if (questions.length < 2 || typeof l?.title !== 'string') continue
      lessons.push({
        id: nanoid(8),
        title: l.title,
        goal: typeof l.goal === 'string' ? l.goal : '',
        excerpt: typeof l.excerpt === 'string' ? l.excerpt : '',
        questions: questions.slice(0, 4),
      })
    }
    if (lessons.length && typeof u?.title === 'string') units.push({ id: nanoid(8), title: u.title, lessons })
    if (units.length >= MAX_UNITS) break
  }
  if (!units.length) return null
  return {
    id: nanoid(8), docId: doc.id, docName: doc.name,
    title: typeof parsed?.title === 'string' ? parsed.title : doc.name,
    units, builtWith: `${res.provider} · ${res.model}`, createdAt: Date.now(),
  }
}

function toQuestion(q: any): QuizQuestion | null {
  if (!q || typeof q.prompt !== 'string' || typeof q.answer !== 'string') return null
  const type = q.type === 'tf' ? 'tf' : 'mc'
  const options: string[] = type === 'tf' ? ['True', 'False'] : (Array.isArray(q.options) ? q.options.filter((o: unknown) => typeof o === 'string') : [])
  if (options.length < 2 || !options.includes(q.answer)) return null
  return {
    id: nanoid(8), type, prompt: q.prompt, options, answer: q.answer,
    explanation: typeof q.explanation === 'string' ? q.explanation : '',
  }
}

/** The on-device path: sentence-based questions, grouped into units by position in the text. */
export function pathOnDevice(doc: { id: string; name: string; text: string }): LearnPath {
  const sents = sentences(doc.text)
  const perLesson = Math.max(4, Math.ceil(sents.length / (MAX_UNITS * LESSONS_PER_UNIT)))
  const chunks: string[][] = []
  for (let i = 0; i < sents.length; i += perLesson) chunks.push(sents.slice(i, i + perLesson))
  const lessons: PathLesson[] = []
  chunks.forEach((chunk, i) => {
    const text = chunk.join(' ')
    const questions = generateQuiz(text, { count: 3, types: ['mc', 'tf', 'fill'], difficulty: 'easy' })
    if (questions.length < 2) return
    const first = chunk[0].replace(/\s+/g, ' ')
    lessons.push({
      id: nanoid(8),
      title: `Part ${i + 1}: ${first.split(' ').slice(0, 5).join(' ')}…`,
      goal: 'Recall the main point of this passage without looking.',
      excerpt: text.slice(0, 420),
      questions: questions.slice(0, 4),
    })
  })
  const units: PathUnit[] = []
  for (let i = 0; i < lessons.length && units.length < MAX_UNITS; i += LESSONS_PER_UNIT) {
    units.push({
      id: nanoid(8),
      title: `Unit ${units.length + 1}`,
      lessons: lessons.slice(i, i + LESSONS_PER_UNIT),
    })
  }
  return {
    id: nanoid(8), docId: doc.id, docName: doc.name, title: doc.name,
    units, builtWith: 'on-device', createdAt: Date.now(),
  }
}

/* ------------------------------------------------------------------ */
/* progress                                                            */
/* ------------------------------------------------------------------ */

export const XP_PER_CORRECT = 10
export const XP_FOR_FINISHING = 5

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)

/** Add XP and keep the day streak honest: a gap of more than one day resets it. */
export function awardXp(amount: number): void {
  useStore.setState((s) => {
    const p = s.learnProgress
    const today = dayKey()
    let streak = p.streak
    if (p.lastActiveDay !== today) {
      const yesterday = dayKey(Date.now() - 86_400_000)
      streak = p.lastActiveDay === yesterday ? p.streak + 1 : 1
    }
    const next: LearnProgress = { ...p, xp: p.xp + amount, streak, lastActiveDay: today }
    return { learnProgress: next }
  })
}

/** Record the best result for a lesson. Stars: 3 for all correct, 2 for most, 1 for passing. */
export function recordLesson(lessonId: string, correct: number, total: number): number {
  const ratio = total ? correct / total : 0
  const stars = ratio === 1 ? 3 : ratio >= 0.66 ? 2 : ratio >= 0.5 ? 1 : 0
  useStore.setState((s) => {
    const prev = s.learnProgress.lessons[lessonId]
    const best = Math.max(prev?.stars ?? 0, stars)
    return {
      learnProgress: {
        ...s.learnProgress,
        lessons: { ...s.learnProgress.lessons, [lessonId]: { stars: best, at: Date.now() } },
      },
    }
  })
  return stars
}

/** Lessons in path order, with whether each one is open yet. */
export function lessonOrder(path: LearnPath, progress: LearnProgress): { lesson: PathLesson; unit: PathUnit; locked: boolean; stars: number }[] {
  const flat: { lesson: PathLesson; unit: PathUnit; locked: boolean; stars: number }[] = []
  let previousDone = true
  for (const unit of path.units) {
    for (const lesson of unit.lessons) {
      const stars = progress.lessons[lesson.id]?.stars ?? 0
      flat.push({ lesson, unit, locked: !previousDone, stars })
      previousDone = stars > 0
    }
  }
  return flat
}
