/**
 * Learning techniques, named.
 *
 * The old quiz asked you to pick "question types", which is an answer to a
 * question nobody had. What a learner is actually choosing between is a
 * technique: whether to be made to recall, to be interrupted before the
 * forgetting curve takes hold, to mix topics, to explain in their own words.
 * Each of those is a named method with a body of evidence behind it, and each
 * maps to a set of question shapes.
 *
 * The list is deliberately short and each entry says what it is for in plain
 * words. A technique you cannot explain in a sentence is not a technique, it
 * is a label.
 */
export type QuestionType = 'mc' | 'tf' | 'short' | 'fill' | 'ordering' | 'matching'

export type TechniqueId =
  | 'retrieval'
  | 'spaced'
  | 'interleaving'
  | 'elaboration'
  | 'feynman'
  | 'dualcoding'
  | 'pretesting'

export interface Technique {
  id: TechniqueId
  /** The name a learner would recognise. */
  name: string
  /** One line on what it does and why it works. */
  why: string
  /** The question shapes this technique is made of. */
  types: QuestionType[]
  /**
   * How many questions of each shape. A technique built on recall wants
   * retrieval, not a wall of multiple choice, so the mix is per-technique.
   */
  shape: Partial<Record<QuestionType, number>>
  /** Whether it wants the material in one sitting or shuffled across topics. */
  order: 'in-order' | 'shuffled'
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'retrieval',
    name: 'Active recall',
    why: 'Pulling an answer out of your own head, rather than reading it back, is what makes it stay.',
    types: ['mc', 'short', 'fill'],
    shape: { short: 4, mc: 2, fill: 1 },
    order: 'shuffled',
  },
  {
    id: 'spaced',
    name: 'Spaced repetition',
    why: 'Revisiting something just as it starts to fade beats reading it five times in a row.',
    types: ['mc', 'tf', 'fill'],
    shape: { tf: 3, mc: 2, fill: 1 },
    order: 'shuffled',
  },
  {
    id: 'interleaving',
    name: 'Interleaving',
    why: 'Mixing problem types instead of blocking them teaches you to tell them apart, which is the part exams test.',
    types: ['mc', 'matching', 'ordering'],
    shape: { mc: 3, matching: 2, ordering: 1 },
    order: 'shuffled',
  },
  {
    id: 'elaboration',
    name: 'Elaborative interrogation',
    why: 'Asking why something is true, and answering it, connects the fact to what you already know.',
    types: ['short', 'mc'],
    shape: { short: 4, mc: 2 },
    order: 'in-order',
  },
  {
    id: 'feynman',
    name: 'The Feynman method',
    why: 'Explaining an idea in plain words exposes the exact point where you were only pretending to understand it.',
    types: ['short', 'fill'],
    shape: { short: 5, fill: 1 },
    order: 'in-order',
  },
  {
    id: 'dualcoding',
    name: 'Dual coding',
    why: 'Pairing words with structure, order and match, gives the same material two routes back to memory.',
    types: ['ordering', 'matching', 'mc'],
    shape: { ordering: 3, matching: 3, mc: 1 },
    order: 'in-order',
  },
  {
    id: 'pretesting',
    name: 'Pre-testing',
    why: 'Being asked before you have studied makes the gaps visible, so the reading afterwards has somewhere to land.',
    types: ['tf', 'mc'],
    shape: { tf: 3, mc: 2 },
    order: 'in-order',
  },
]

export const DEFAULT_TECHNIQUE: TechniqueId = 'retrieval'

export function techniqueById(id: string): Technique {
  return TECHNIQUES.find((t) => t.id === id) ?? TECHNIQUES[0]
}

/**
 * The question shapes a set of techniques produces, in the counts each
 * technique asks for, scaled to `count`.
 *
 * Shaping by technique rather than by hand means the mix a learner gets is the
 * mix the technique is for. `retrieval` weighted to short answer is not
 * interchangeable with `dualcoding` weighted to ordering, and pretending they
 * are is how you end up with a quiz that is always the same quiz.
 */
export function shapeFor(ids: TechniqueId[], count: number): { type: QuestionType; weight: number }[] {
  const chosen = ids.length ? ids.map(techniqueById) : [TECHNIQUES[0]]
  const raw = new Map<QuestionType, number>()
  for (const t of chosen) {
    for (const [type, n] of Object.entries(t.shape) as [QuestionType, number][]) {
      raw.set(type, (raw.get(type) ?? 0) + n)
    }
  }
  const total = [...raw.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return [{ type: 'mc', weight: 1 }]
  return [...raw.entries()]
    .map(([type, n]) => ({ type, weight: n / total }))
    .sort((a, b) => b.weight - a.weight)
    .filter((shape, i) => {
      // Drop shapes that would round to nothing at this question count: a
      // quarter of four questions is one, a twelfth of four is not a question.
      // The most common shape always survives, so the list is never empty.
      return shape.weight * count >= 0.5 || i < 1
    })
}

/**
 * The concrete question list a technique set produces, of exactly `count`
 * questions, scaled by each technique's weights.
 *
 * `shapeFor` gives proportions; this gives you something you can iterate. A
 * technique that wants short answers gets short answers, at roughly the share
 * it asked for, rounded by largest remainder so the counts always sum to
 * `count` and nothing is silently dropped.
 */
export function typesFor(ids: TechniqueId[], count: number): QuestionType[] {
  const shaped = shapeFor(ids, count)
  if (!shaped.length) return ['mc']
  const quotas = shaped.map((s) => Math.floor(s.weight * count))
  let left = count - quotas.reduce((a, b) => a + b, 0)
  // Largest remainder first, so the leftover goes to the types that were
  // closest to earning it rather than to whichever happened to sort first.
  const byRemainder = [...shaped.keys()].sort(
    (a, b) => (shaped[b].weight * count - Math.floor(shaped[b].weight * count)) - (shaped[a].weight * count - Math.floor(shaped[a].weight * count)),
  )
  let i = 0
  while (left > 0 && byRemainder.length) {
    quotas[byRemainder[i % byRemainder.length]] += 1
    left -= 1
    i += 1
  }
  const out: QuestionType[] = []
  shaped.forEach((s, idx) => {
    for (let n = 0; n < quotas[idx]; n++) out.push(s.type)
  })
  // Interleaving is the point of several of these techniques, so the order is
  // deliberately not grouped.
  for (let n = out.length - 1; n > 0; n--) {
    const j = Math.floor(Math.random() * (n + 1))
    ;[out[n], out[j]] = [out[j], out[n]]
  }
  return out.length ? out : ['mc']
}

/** Every question type at least one technique uses, for the picker. */
export function allTypes(): { type: QuestionType; label: string }[] {
  return [
    { type: 'mc', label: 'Multiple choice' },
    { type: 'tf', label: 'True / false' },
    { type: 'short', label: 'Short answer' },
    { type: 'fill', label: 'Fill in blank' },
    { type: 'ordering', label: 'Reorder' },
    { type: 'matching', label: 'Matching' },
  ]
}

/* --------------------------------------------------------------- levels -- */

export type LevelId = 'first' | 'building' | 'fluent'

export interface Level {
  id: LevelId
  name: string
  /** What it changes about the questions, not a vague promise about depth. */
  why: string
  /** The difficulty the generator is given. */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Longer sentences survive at a higher level; a first pass should not be. */
  maxSentenceWords: number
  /** How many questions to ask before the set feels like a wall. */
  suggestedCount: number
}

export const LEVELS: Level[] = [
  {
    id: 'first',
    name: 'First pass',
    why: 'Short sentences and plain terms. The shape of the material before the detail.',
    difficulty: 'easy',
    maxSentenceWords: 22,
    suggestedCount: 8,
  },
  {
    id: 'building',
    name: 'Building',
    why: 'The detail, including the sentences that run long and the terms that carry weight.',
    difficulty: 'medium',
    maxSentenceWords: 38,
    suggestedCount: 12,
  },
  {
    id: 'fluent',
    name: 'Fluent',
    why: 'Everything, including the qualifications and the numbers, and no help from the wording.',
    difficulty: 'hard',
    maxSentenceWords: 999,
    suggestedCount: 16,
  },
]

export const DEFAULT_LEVEL: LevelId = 'building'

export function levelById(id: string): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[1]
}
