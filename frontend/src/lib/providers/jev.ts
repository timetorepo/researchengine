/**
 * Jev, TypeSafe AI's System One decision model.
 *
 * Jev is not a chat model and this is not a chat client. You send it `state`
 * (any text or JSON) plus `questions`, and it returns typed answers with
 * calibrated probabilities — a choice from the options you declared, a score on
 * a ladder you set, or a yes/no with a probability. There is no string to parse,
 * because the space of answers is fixed before the call runs.
 *
 * The API is documented at https://docs.typesafe.ai/api. Two endpoints matter:
 * POST /v1/systemone to evaluate, GET /v1/models to list. Auth is a bearer key.
 *
 * What is worth knowing before you use it, from the docs rather than from
 * marketing: 64k tokens per request, with the state plus the longest question
 * capped at 32k. A choice takes up to 255 options; a score takes 2 to 10 levels.
 * Questions in one request are evaluated in parallel against the same state, and
 * their types can be mixed. Latency is 70 to 500 ms, and output tokens are free.
 *
 * Jev cannot leave the schema. That removes the malformed answer, not the
 * mistaken one — it can still confidently pick the wrong allowed value. The
 * probability is there so you can set a threshold and abstain, and
 * `decide()` returns the raw probability rather than a decision, because the
 * threshold is the caller's to choose.
 */
import { providerById } from './registry'

export const TYPESAFE_BASE = 'https://api.typesafe.ai'

/** The three question types Jev documents. */
export type JevQuestionType = 'noul' | 'choice' | 'score'

export interface JevChoiceQuestion {
  type: 'choice'
  name: string
  instructions?: string
  /** 2 to 255 options. The answer is always one of these. */
  options: string[]
}

export interface JevScoreQuestion {
  type: 'score'
  name: string
  instructions?: string
  /** 2 to 10 levels, named from low to high. */
  levels: string[]
}

export interface JevNoulQuestion {
  type: 'noul'
  name: string
  instructions?: string
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion

/** One answer, with the probability Jev attached to it. */
export interface JevAnswer {
  name: string
  type: JevQuestionType
  /** The chosen option, or the chosen level, as the index into what you sent. */
  answer?: number
  /** Present on a noul question. */
  probability?: number
  /** Present on choice and score: the distribution over what you sent. */
  probabilities?: number[]
}

export interface JevUsage {
  input_tokens: number
  output_tokens: number
}

export interface JevDecision {
  model: string
  answers: JevAnswer[]
  usage: JevUsage
}

export interface JevDecideRequest {
  state: string
  model: string
  questions: JevQuestion[]
}

/** The documented limits, as constants rather than as comments. */
export const JEV_LIMITS = {
  /** Tokens per request. */
  maxRequestTokens: 64_000,
  /** State plus the longest question. */
  maxStatePlusQuestionTokens: 32_000,
  /** Options on a choice question. */
  maxChoiceOptions: 255,
  /** Levels on a score question. */
  maxScoreLevels: 10,
  minScoreLevels: 2,
} as const

/**
 * A rough token count, so the UI can warn before sending something that will
 * come back 422. Four characters to a token is the usual crude estimate, and it
 * is labelled as one — this is a guard rail, not a measurement.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface ValidationIssue {
  /** Which question, by index. -1 for the state or the request itself. */
  at: number
  problem: string
}

/**
 * Check a request against Jev's documented limits before sending it.
 *
 * This runs client-side so the UI can say what is wrong while you are still
 * typing, rather than after a round trip. The server checks again, because a
 * client-side check is a courtesy and not a guarantee.
 */
export function validateRequest(req: JevDecideRequest): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const stateTokens = estimateTokens(req.state)
  if (stateTokens > JEV_LIMITS.maxRequestTokens) {
    out.push({ at: -1, problem: `The state is about ${stateTokens.toLocaleString()} tokens, over the ${JEV_LIMITS.maxRequestTokens.toLocaleString()} Jev allows per request.` })
  }
  let longest = 0
  req.questions.forEach((q, i) => {
    const text = [q.name, q.instructions ?? ''].join(' ')
    longest = Math.max(longest, estimateTokens(text))
    if (!q.name.trim()) out.push({ at: i, problem: 'A question needs a name.' })
    if (q.type === 'choice') {
      if (q.options.length < 2) out.push({ at: i, problem: 'A choice needs at least two options.' })
      if (q.options.length > JEV_LIMITS.maxChoiceOptions) out.push({ at: i, problem: `A choice allows up to ${JEV_LIMITS.maxChoiceOptions} options; this one has ${q.options.length}.` })
      if (new Set(q.options).size !== q.options.length) out.push({ at: i, problem: 'A choice cannot list the same option twice.' })
    }
    if (q.type === 'score') {
      if (q.levels.length < JEV_LIMITS.minScoreLevels || q.levels.length > JEV_LIMITS.maxScoreLevels) {
        out.push({ at: i, problem: `A score takes ${JEV_LIMITS.minScoreLevels} to ${JEV_LIMITS.maxScoreLevels} levels; this one has ${q.levels.length}.` })
      }
    }
  })
  if (stateTokens + longest > JEV_LIMITS.maxStatePlusQuestionTokens) {
    out.push({ at: -1, problem: `The state plus the longest question is about ${(stateTokens + longest).toLocaleString()} tokens, over the ${JEV_LIMITS.maxStatePlusQuestionTokens.toLocaleString()} Jev allows.` })
  }
  return out
}

/**
 * The answer to a question, as the value you sent rather than an index.
 *
 * Jev answers with positions; a caller wants the option. Reading it off here
 * means one place handles the index, and an out-of-range answer — which should
 * not happen, since the schema forbids it — comes back as null rather than as
 * `undefined` silently becoming the wrong label.
 */
export function answerValue(answer: JevAnswer, question: JevQuestion): string | null {
  if (answer.type === 'noul') {
    if (typeof answer.probability !== 'number') return null
    // Jev gives a probability for the affirmative; the caller decides where the
    // line is, so this reports both rather than picking a side.
    return answer.probability >= 0.5 ? 'yes' : 'no'
  }
  if (typeof answer.answer !== 'number') return null
  const list = question.type === 'choice' ? question.options : question.type === 'score' ? question.levels : []
  return list[answer.answer] ?? null
}

/** The full distribution for a question, labelled. Empty when there is none. */
export function answerDistribution(answer: JevAnswer, question: JevQuestion): { label: string; p: number }[] {
  if (!answer.probabilities) return []
  const list = question.type === 'choice' ? question.options : question.type === 'score' ? question.levels : []
  return list.map((label, i) => ({ label, p: answer.probabilities?.[i] ?? 0 }))
}

/** Whether the provider entry is Jev, so callers do not string-match. */
export function isDecisionProvider(providerId: string): boolean {
  return providerById(providerId)?.kind === 'decision'
}
