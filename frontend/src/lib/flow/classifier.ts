// AIFlowEngine — query classification. Fast regex + intent heuristics,
// fully on-device. No API call for the common path.

import { getMaster, STYLE_RULES, type MasterKey } from '@/lib/prompts/masters'
import { workModePrompt, type WorkMode } from '@/lib/prompts/workModes'

export type QueryClass = 'factual' | 'reasoning' | 'math' | 'code' | 'creative' | 'longform'

const RULES: { cls: QueryClass; re: RegExp }[] = [
  { cls: 'math', re: /(solve|integral|derivative|equation|latex|\\frac|prove that|calculat|\b\d+\s*[-+*/^]\s*\d+|matrix|eigenvalue|probability of)/i },
  { cls: 'code', re: /(write (a |an |some )?(code|function|script|program|regex)|debug|typescript|python|javascript|rust|golang|sql query|refactor|stack trace|```)/i },
  { cls: 'creative', re: /(poem|story|haiku|slogan|brainstorm|creative|fiction|lyrics|write a (letter|email|tweet))/i },
  { cls: 'longform', re: /(literature review|essay|in detail|comprehensive|deep dive|compare and contrast|write (an? )?(article|guide|report|overview))/i },
  { cls: 'factual', re: /^(who|what|when|where|which|how many|how much|define|capital of|population of|year of|date of)\b/i },
  { cls: 'reasoning', re: /(why|should|analyze|evaluate|trade[- ]?offs?|pros and cons|implications|explain (the )?reason)/i },
]

export function classifyQuery(q: string): QueryClass {
  for (const r of RULES) if (r.re.test(q)) return r.cls
  return q.length > 160 ? 'longform' : 'factual'
}

/**
 * Master-prompt composition.
 * Final shape: [Master Prompt] + [voice rules] + [mode-specific injections].
 * Skills and pruned history are appended by the caller (runChat).
 */
/** Tool results reach the person as cards, so the answer summarises them instead of pasting data. */
const RESULT_CARDS_RULE = 'Tool results are shown to the person as rich cards inside the app. Never paste raw tool output, JSON or long field dumps into the answer. Summarise in one or two sentences, name the best result and say what the person can do next.'

export function shapeSystemPrompt(
  cls: QueryClass,
  extra: { math?: boolean; quality?: boolean; flow?: boolean; replicate?: boolean; workMode?: WorkMode } = {},
  overrides: Record<string, string> = {},
): string {
  // Mode wins over classification.
  let key: MasterKey = extra.replicate ? 'replicate'
    : extra.math ? 'math'
    : extra.quality ? 'quality'
    : extra.flow ? 'flow'
    : 'research'
  const master = getMaster(key, overrides).text

  // Class-specific micro-injections — kept tiny so we never bloat the prompt.
  const inject: Partial<Record<QueryClass, string>> = {
    code: 'For code: provide working, idiomatic, minimal solutions in fenced blocks with language tags.',
    creative: 'For this creative request: be vivid and original; match tone to the request; avoid clichés.',
    factual: 'Lead with the direct answer.',
  }
  const bits = [master, workModePrompt(extra.workMode), STYLE_RULES, RESULT_CARDS_RULE].filter(Boolean)
  if (inject[cls]) bits.push(inject[cls]!)
  return bits.join('\n\n')
}

/** Response length calibration hints appended to API requests. */
export function lengthHint(cls: QueryClass): { maxTokens: number } {
  const map: Record<QueryClass, number> = {
    factual: 300, reasoning: 700, math: 800, code: 900, creative: 600, longform: 1600,
  }
  return { maxTokens: map[cls] }
}
