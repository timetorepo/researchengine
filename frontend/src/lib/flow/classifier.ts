// AIFlowEngine — query classification. Fast regex + intent heuristics,
// fully on-device. No API call for the common path.

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

/** Dynamic prompt shaping — only the instructions relevant to this query type. */
export function shapeSystemPrompt(cls: QueryClass, extra: { math?: boolean; quality?: boolean } = {}): string {
  const base: Record<QueryClass, string> = {
    factual: 'Answer the factual question directly and concisely. Lead with the answer. Cite uncertainty if the fact is not settled.',
    reasoning: 'Reason step by step, then state a clear conclusion. Surface trade-offs explicitly.',
    math: 'Solve step by step using LaTeX for all math ($..$ inline, $$..$$ display). State the final answer clearly at the end.',
    code: 'Provide working code with brief explanation. Prefer idiomatic, minimal solutions. Use fenced code blocks with language tags.',
    creative: 'Be vivid and original. Match tone to the request. Avoid clichés.',
    longform: 'Produce a well-structured long-form answer with Markdown headings, lists, and a brief summary up top.',
  }
  let p = base[cls]
  if (extra.math) p += ' Math mode: give a full step-by-step LaTeX solution.'
  if (extra.quality) p += ' Quality mode: be thorough, structured, and cite sources inline as [n] when web sources are provided.'
  else p += ' Match response length to query complexity — no filler.'
  return p
}

/** Response length calibration hints appended to API requests. */
export function lengthHint(cls: QueryClass): { maxTokens: number } {
  const map: Record<QueryClass, number> = {
    factual: 300, reasoning: 700, math: 800, code: 900, creative: 600, longform: 1600,
  }
  return { maxTokens: map[cls] }
}
