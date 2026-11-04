// Server-side AIFlowEngine helpers — mirrors the browser implementation so
// deployments that proxy through the backend get the same token savings.
export type QueryClass = 'factual' | 'reasoning' | 'math' | 'code' | 'creative' | 'longform'

const RULES: { cls: QueryClass; re: RegExp }[] = [
  { cls: 'math', re: /(solve|integral|derivative|equation|prove that|\\frac|\b\d+\s*[-+*/^]\s*\d+)/i },
  { cls: 'code', re: /(write (a |some )?(code|function|script)|debug|typescript|python|refactor|```)/i },
  { cls: 'creative', re: /(poem|story|haiku|slogan|brainstorm|lyrics)/i },
  { cls: 'longform', re: /(literature review|essay|in detail|comprehensive|deep dive)/i },
  { cls: 'factual', re: /^(who|what|when|where|which|how many|define)\b/i },
  { cls: 'reasoning', re: /(why|should|analyze|evaluate|trade[- ]?offs?|pros and cons)/i },
]

export function classify(q: string): QueryClass {
  for (const r of RULES) if (r.re.test(q)) return r.cls
  return q.length > 160 ? 'longform' : 'factual'
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}
