/**
 * The citation audit — the fix for Perplexity's most-documented failure.
 *
 * Studies of AI search found up to 13% of deep-research citations pointing at
 * URLs that never existed: the model writes a plausible-looking [n] that was
 * never in the retrieved set. Here the grounding context only ever contains
 * the sources the pipeline actually retrieved, numbered 1..N — so any [n] the
 * model writes with n outside that range is by definition invented, and this
 * audit strips it before the answer is shown. What remains can still
 * misattribute a real source to the wrong claim (no pipeline fixes that
 * completely), but a fabricated reference number cannot survive.
 */

export interface CitationAudit {
  text: string
  /** How many invented markers were removed. */
  removed: number
  /** The distinct citation numbers that survived. */
  used: number[]
}

export function auditCitations(text: string, sourceCount: number): CitationAudit {
  if (!text || sourceCount <= 0) return { text, removed: 0, used: [] }
  let removed = 0
  const used = new Set<number>()
  const cleaned = text.replace(/\[(\d{1,3})(?:\s*,\s*(\d{1,3}))*\]/g, (whole, a: string, b?: string) => {
    const nums = [Number(a), ...(b ? [Number(b)] : [])]
    const valid = nums.filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount)
    if (valid.length === 0) {
      removed++
      return ''
    }
    valid.forEach((n) => used.add(n))
    if (valid.length === nums.length) return whole
    removed++
    return `[${valid.join(',')}]`
  }).replace(/\[\]/g, '')
  return { text: cleaned, removed, used: [...used].sort((x, y) => x - y) }
}
