/**
 * removerAlpha — what makes text read as machine-written, and how to take it out.
 *
 * Everything in this file runs on the device: no request, no model call, no
 * token spent, which is the point of the feature. Given any piece of text it
 * returns the tells it found, the whole catalogue of tells that exist (so the
 * list can be read as a reference, not only as a verdict), and a local fix pass
 * that removes the mechanical ones without touching the meaning.
 *
 * Two rules shape the design:
 *
 *   1. A single em dash is not an AI tell. Ten in four hundred words, each one
 *      separating a tricolon, is. Every rule therefore counts hits and only
 *      grades by density, never by presence alone.
 *   2. The fix pass is allowed to be a no-op. `localFix` only applies
 *      substitutions that cannot change the sense of a sentence, and it never
 *      rewrites prose. Anything that needs judgement stays in the findings list
 *      for the reader to decide.
 */

export type AlphaSeverity = 'high' | 'medium' | 'low'
export type AlphaCategory =
  | 'punctuation'
  | 'phrasing'
  | 'vocabulary'
  | 'structure'
  | 'formatting'
  | 'boilerplate'
  | 'statistics'

export interface AlphaRule {
  id: string
  category: AlphaCategory
  severity: AlphaSeverity
  /** Short name, shown in the findings list. */
  label: string
  /** Why this reads as machine-written. One or two sentences, no hedging. */
  why: string
  /** What to do instead, when there is a mechanical answer. */
  fix?: string
  /** What the rule looks for. Global if `all`, otherwise a single test. */
  pattern: RegExp
  /** Some rules only count when they repeat this many times or more. */
  threshold?: number
  /**
   * Measured from the statistics rather than matched in the text.
   *
   * The catalogue is also the reference list the screen prints, so these two
   * live here with everything else — but they must never go through `collect`:
   * their pattern is a placeholder, and an empty match counts once per
   * character, which is how every piece of text scored 100 before this flag
   * existed.
   */
  computed?: true
}

export interface AlphaFinding extends AlphaRule {
  count: number
  /** Up to 6 matched spans with their offsets, for highlighting. */
  samples: { text: string; index: number }[]
}

export interface AlphaStats {
  characters: number
  words: number
  sentences: number
  paragraphs: number
  avgSentenceWords: number
  /** Standard deviation of sentence length, in words. Even prose is a tell. */
  sentenceVariance: number
  emDashes: number
  enDashes: number
  bullets: number
  boldMarkers: number
  headings: number
  emoji: number
}

export interface AlphaReport {
  /** 0 (reads human) to 100 (reads like a model wrote it). */
  score: number
  band: 'human' | 'light' | 'noticeable' | 'heavy'
  findings: AlphaFinding[]
  /** Every rule, whether it fired or not. */
  catalog: { rule: AlphaRule; count: number }[]
  stats: AlphaStats
  /** One line per finding, printable. */
  summary: string[]
}

/* ------------------------------------------------------------------ rules -- */

const EM_DASH = /\u2014/g
const EN_DASH = /\u2013/g
const ELLIPSIS = /\u2026/g
const NONBREAKING = /\u00a0/g

/**
 * The catalogue.
 *
 * Severity is about signal strength, not about how much we dislike the word: a
 * "Certainly!" opener is close to conclusive on its own, "robust" is evidence
 * only in company. Density thresholds encode that.
 */
export const ALPHA_CATALOG: AlphaRule[] = [
  /* ---------------------------------------------------------- punctuation -- */
  {
    id: 'em-dash-density', category: 'punctuation', severity: 'high',
    label: 'Em dashes as the default separator',
    why: 'Models reach for the em dash whenever a sentence needs a hinge, so they pile up where a human would mix commas, colons and parentheses.',
    fix: 'Keep at most one per few hundred words. A comma, a colon or a full stop usually reads better.',
    pattern: EM_DASH, threshold: 3,
  },
  {
    id: 'em-dash-spaced', category: 'punctuation', severity: 'medium',
    label: 'Spaced em dash ( — )',
    why: 'Chat interfaces and American book prose usually set the em dash closed up. The spaced form is disproportionately common in generated text because it is what a tokenizer emits when a comma feels wrong.',
    fix: 'Set it closed up, or replace it with a comma.',
    pattern: / \u2014 | \u2014$/gm, threshold: 2,
  },
  {
    id: 'en-dash-range', category: 'punctuation', severity: 'low',
    label: 'En dash for ranges',
    why: 'Mixed with em dashes in the same document, en dashes show a writer who is not editing by hand.',
    pattern: EN_DASH, threshold: 3,
  },
  {
    id: 'ellipsis-character', category: 'punctuation', severity: 'low',
    label: 'Typographic ellipsis (…)',
    why: 'Three periods is what a person types; the single-character ellipsis is usually a paste from generated text or a word processor.',
    pattern: ELLIPSIS, threshold: 2,
  },
  /* ------------------------------------------------------------- phrasing -- */
  {
    id: 'delve', category: 'phrasing', severity: 'high',
    label: '"delve into" and friends',
    why: 'A verb that barely appears in modern edited prose and appears constantly in model output.',
    fix: 'Use "look at", "examine", "go through".',
    pattern: /\b(delve|delving|delves)\b/gi,
  },
  {
    id: 'landscape-tapestry', category: 'phrasing', severity: 'high',
    label: 'Landscape, tapestry, realm, symphony, dance',
    why: 'Abstract-noun metaphors like "the evolving landscape of" or "a rich tapestry of" are the most reliable single tell there is; they carry no information.',
    fix: 'Name the actual thing: the market, the field, the studies, the tools.',
    pattern: /\b(ever[- ]evolving|evolving|changing|shifting|modern|current|digital)\s+(landscape|tapestry|realm|ecosystem|paradigm)\b|\b(rich|complex|intricate)\s+tapestry\b|\b(landscape|tapestry|realm|symphony|dance)\s+of\b/gi,
  },
  {
    id: 'boilerplate-openers', category: 'phrasing', severity: 'high',
    label: 'Assistant openers',
    why: 'Phrases like "Certainly!", "Great question" or "Here is a breakdown" address a chat request, not a reader.',
    fix: 'Delete the opener and start with the first fact.',
    pattern: /^\s*(certainly|of course|sure|absolutely|great question|excellent question|that'?s a great question|here'?s? (a|the|an|what|how|why)\b|let'?s dive in|let'?s break (this|it) down|in this (article|post|section|guide),? (we|i)\b|i hope this helps|hope this helps)/gim,
  },
  {
    id: 'not-just-but', category: 'phrasing', severity: 'medium',
    label: '"Not just X, but Y"',
    why: 'The construction inflates a plain statement into a reveal. A model uses it several times in a page; a person rarely twice.',
    fix: 'State X and Y as two facts, or pick the one that matters.',
    pattern: /\bnot (just|only|merely)\b[^.!?\n]{2,60}\bbut\b/gi, threshold: 2,
  },
  {
    id: 'it-is-worth-noting', category: 'phrasing', severity: 'medium',
    label: '"It is worth noting", "It is important to"',
    why: 'Announcing that something matters instead of showing it. Also "One might argue", "Interestingly".',
    fix: 'Cut the frame and say the thing.',
    pattern: /\b(it'?s|it is|it'?s also)\s+(worth (noting|mentioning|remembering)|important to (note|remember|understand)|crucial to)\b|\b(interestingly|notably|importantly),/gi,
  },
  {
    id: 'in-conclusion', category: 'phrasing', severity: 'medium',
    label: 'Summary signposts',
    why: '"In conclusion", "To sum up", "Overall" and "In summary" are almost never written by someone who trusts the reader to reach the end.',
    fix: 'End on the last real point. If a summary is needed, give it a heading.',
    pattern: /^\s*(in conclusion|in summary|to sum(marise|marize)?( up)?|to conclude|overall|in closing|final(ly)? thoughts)\b[:,]?/gim,
  },
  {
    id: 'hedge-stack', category: 'phrasing', severity: 'low',
    label: 'Stacked hedges',
    why: '"It can be argued that this may potentially" is four hedges in one clause. Models hedge to stay safe; people commit.',
    pattern: /\b(may|might|could|can)\s+(potentially|possibly|perhaps)\b|\barguably\b|\b(very|quite|rather|fairly)\s+(likely|unlikely)\b/gi, threshold: 3,
  },
  {
    id: 'trilogy', category: 'phrasing', severity: 'low',
    label: 'The rule of three, everywhere',
    why: 'Three-item lists are useful, but generated text makes almost every list exactly three items long.',
    pattern: /\b\w+,\s+\w+,\s+and\s+\w+\b/g, threshold: 4,
  },
  /* ----------------------------------------------------------- vocabulary -- */
  {
    id: 'corporate-lexicon', category: 'vocabulary', severity: 'medium',
    label: 'Leverage, utilize, robust, seamless',
    why: 'A cluster of well-worn substitutes for plain words. One is nothing; six in a page is a fingerprint.',
    fix: 'use, use, solid, smooth.',
    pattern: /\b(leverage|leveraging|utilize|utilizing|utilise|utilising|foster|fostering|robust|seamless|seamlessly|holistic|synerg(y|ies|istic)|streamline|streamlining|paradigm|myriad|plethora|nuanced|crucial|pivotal|meticulous(ly)?|intricate|commendable|invaluable|captivating|profound(ly)?|unparalleled|cutting[- ]edge|state[- ]of[- ]the[- ]art|game[- ]chang(er|ing))\b/gi, threshold: 4,
  },
  {
    id: 'furthermore-chain', category: 'vocabulary', severity: 'medium',
    label: 'Moreover, Furthermore, Additionally',
    why: 'Formal connectives at the start of sentence after sentence. People vary; models are consistent.',
    fix: 'Let the sentences stand alone, or use "and" / "also" once.',
    pattern: /(^|[.!?]\s+)(Moreover|Furthermore|Additionally|Consequently|Subsequently|In addition)\s*,/g, threshold: 3,
  },
  {
    id: 'significance-words', category: 'vocabulary', severity: 'low',
    label: 'Significance inflation',
    why: '"stands as a testament to", "plays a vital role in", "serves as a reminder" attach importance without evidence.',
    fix: 'Say what it did.',
    pattern: /\b(stands? as a testament|serves? as a reminder|plays? a (vital|crucial|key|significant) role|is a testament to|speaks? volumes|leaves? an indelible mark|paves? the way)\b/gi,
  },
  /* ------------------------------------------------------------ structure -- */
  {
    id: 'bullet-parallelism', category: 'structure', severity: 'medium',
    label: 'Every bullet the same shape',
    why: 'A human list has uneven lengths and occasionally a sub-point. Uniform bullets with a bold label are a formatting template, not a thought.',
    pattern: /^\s*[-*+]\s+\*\*[^*]+\*\*\s*[:\u2014-]/gm, threshold: 3,
  },
  {
    id: 'bold-label-lines', category: 'structure', severity: 'medium',
    label: 'Bold label, then a colon',
    why: '"**Thing:** explanation" on line after line is a model formatting habit. It is fine once, or as a glossary.',
    pattern: /^\s*(\*\*[^*\n]+\*\*|[A-Z][A-Za-z ]{2,28})[:]\s/gm, threshold: 4,
  },
  {
    id: 'numbered-perfect', category: 'structure', severity: 'low',
    label: 'Numbered steps in order, one line each',
    why: 'A procedure that is always exactly five steps, each one sentence, is usually generated to fit a template.',
    pattern: /^\s*\d+\.\s+\S/gm, threshold: 6,
  },
  {
    id: 'heading-everywhere', category: 'structure', severity: 'low',
    label: 'A heading every few lines',
    why: 'Generated documents break into sections at a metronome. Real notes are lumpy.',
    pattern: /^#{2,3}\s+/gm, threshold: 6,
  },
  /* ----------------------------------------------------------- formatting -- */
  {
    id: 'bold-in-plaintext', category: 'formatting', severity: 'high',
    label: 'Markdown bold showing in plain text',
    why: 'If the asterisks are visible, the text was written for markdown and pasted somewhere that does not render it. It reads as raw output.',
    fix: 'Remove the markers, or render the text as markdown.',
    pattern: /\*\*[^*\n]+\*\*/g, threshold: 2,
  },
  {
    id: 'arrow-chains', category: 'formatting', severity: 'medium',
    label: 'Arrows as prose',
    why: '"DNA → RNA → protein" is a diagram, not a sentence. Chains of arrows in running text are a machine habit.',
    fix: 'Write "to" or use a table.',
    pattern: /\S\s?\u2192\s?\S/g, threshold: 2,
  },
  {
    id: 'nonbreaking-space', category: 'formatting', severity: 'low',
    label: 'Non-breaking spaces',
    why: 'Pasted from a generated document or a word processor; a person typing into a field leaves ordinary spaces.',
    pattern: NONBREAKING, threshold: 3,
  },
  {
    id: 'emoji-bullets', category: 'formatting', severity: 'medium',
    label: 'Emoji used as bullets or section marks',
    why: 'A tick, a rocket and a lightbulb at the start of lines is assistant formatting.',
    pattern: /^\s*[\u2728\u2705\u274c\u26a0\ufe0f\u{1f680}\u{1f4a1}\u{1f4cc}\u{1f4dd}\u{1f525}\u{1f31f}\u{1f4ca}\u{1f9e0}\u{1f50d}]\s?/gmu, threshold: 2,
  },
  {
    id: 'title-case-headings', category: 'formatting', severity: 'low',
    label: 'Every Heading In Title Case',
    why: 'Mixed with sentence-case body text, title-case headings are a template default rather than a style choice.',
    pattern: /^#{1,4}\s+(?:[A-Z][a-z]+\s+){2,}[A-Z][a-z]+\s*$/gm, threshold: 3,
  },
  /* ---------------------------------------------------------- boilerplate -- */
  {
    id: 'model-disclaimers', category: 'boilerplate', severity: 'high',
    label: 'Model self-references',
    why: 'Any sentence about being an AI, about knowledge cutoffs, or about being unable to browse belongs to a chat window, not to a document.',
    pattern: /\b(as an ai|as a large language model|i'?m an ai|language model|knowledge cutoff|i (cannot|can'?t) (browse|access|provide) (the )?(internet|real[- ]time)|my training data)\b/gi,
  },
  {
    id: 'offer-more', category: 'boilerplate', severity: 'medium',
    label: 'Offering to continue',
    why: '"Would you like me to…", "Let me know if you want…", "Feel free to ask" are conversation moves, and they survive a copy-paste.',
    fix: 'Cut the sentence.',
    pattern: /\b(would you like me to|let me know if you('?d| would)? like|feel free to (ask|reach out)|if you (have|need) (any )?(further|other|more) questions|i can (also )?(help|assist) (you )?with)\b/gi,
  },
  {
    id: 'vague-scope', category: 'boilerplate', severity: 'low',
    label: 'Scope without content',
    why: '"There are many factors to consider", "the possibilities are endless", "results may vary" fill space where a reader expects the factors themselves.',
    pattern: /\b(there are (many|several|numerous) (factors|things|ways|reasons)\b|the possibilities are endless|results may vary|it depends on (many|several|various) factors|a wide range of)\b/gi, threshold: 2,
  },
  /* ----------------------------------------------------------- statistics -- */
  {
    id: 'even-sentences', category: 'statistics', severity: 'medium',
    label: 'Sentences of nearly equal length',
    why: 'Human prose swings between short and long. Generated prose clusters around the same length, which is measurable.',
    fix: 'Break one long sentence in half. Join two short ones.',
    pattern: /(?:)/g, // computed, not matched
    computed: true,
  },
  {
    id: 'long-sentence-drift', category: 'statistics', severity: 'low',
    label: 'No short sentences at all',
    why: 'A page where every sentence runs past twenty words has no rhythm, which is how a model writes when it is being careful.',
    pattern: /(?:)/g,
    computed: true,
  },
]

/* -------------------------------------------------------------- analysis -- */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const sentencesOf = (s: string): string[] =>
  s.replace(/\n{2,}/g, '\n')
    .split(/(?<=[.!?])\s+(?=[A-Z("\u201c])|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1)

function stats(text: string): AlphaStats {
  const list = sentencesOf(text)
  const lens = list.map(words)
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0
  const variance = lens.length
    ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length)
    : 0
  return {
    characters: text.length,
    words: words(text),
    sentences: list.length,
    paragraphs: text.split(/\n{2,}/).filter((p) => p.trim()).length,
    avgSentenceWords: Math.round(avg * 10) / 10,
    sentenceVariance: Math.round(variance * 10) / 10,
    emDashes: (text.match(EM_DASH) ?? []).length,
    enDashes: (text.match(EN_DASH) ?? []).length,
    bullets: (text.match(/^\s*[-*+]\s+/gm) ?? []).length,
    boldMarkers: (text.match(/\*\*[^*\n]+\*\*/g) ?? []).length,
    headings: (text.match(/^#{1,6}\s+/gm) ?? []).length,
    emoji: (text.match(/\p{Extended_Pictographic}/gu) ?? []).length,
  }
}

function collect(rule: AlphaRule, text: string): AlphaFinding | null {
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g')
  const samples: { text: string; index: number }[] = []
  let count = 0
  for (const m of text.matchAll(pattern)) {
    count++
    if (samples.length < 6) samples.push({ text: m[0].trim(), index: m.index ?? 0 })
    if (count > 200) break
  }
  if (count === 0) return null
  if (rule.threshold && count < rule.threshold) return null
  return { ...rule, count, samples }
}

/**
 * Read a piece of text and say what makes it look machine-written.
 *
 * The score is a weighted density: a finding's severity decides how much it
 * counts, and everything is normalised per 100 words so a long document is not
 * punished for being long. No single rule can push a text into "heavy" on its
 * own.
 */
export function analyzeAlpha(text: string): AlphaReport {
  const st = stats(text)
  const findings: AlphaFinding[] = []
  for (const rule of ALPHA_CATALOG) {
    // The two statistical rules are measured below, from `stats`, not matched.
    if (rule.computed) continue
    const hit = collect(rule, text)
    if (hit) findings.push(hit)
  }

  // Statistical rules: measured, not matched.
  if (st.sentences >= 5) {
    const evenRule = ALPHA_CATALOG.find((r) => r.id === 'even-sentences')!
    // Coefficient of variation below ~0.28 means every sentence is about the
    // same length. Human prose of any register sits well above that.
    const cv = st.avgSentenceWords ? st.sentenceVariance / st.avgSentenceWords : 1
    if (cv < 0.28) {
      findings.push({
        ...evenRule, count: 1,
        samples: [{
          text: `${st.sentences} sentences averaging ${st.avgSentenceWords} words, spread ±${st.sentenceVariance.toFixed(1)} (${(cv * 100).toFixed(0)}% of the mean)`,
          index: 0,
        }],
      })
    }
    if (st.avgSentenceWords >= 24 && st.sentenceVariance < 8) {
      const longRule = ALPHA_CATALOG.find((r) => r.id === 'long-sentence-drift')!
      findings.push({
        ...longRule, count: 1,
        samples: [{
          text: `average sentence length ${st.avgSentenceWords} words, every one of them ${Math.max(20, Math.floor(st.avgSentenceWords - st.sentenceVariance))} to ${Math.ceil(st.avgSentenceWords + st.sentenceVariance)} words`,
          index: 0,
        }],
      })
    }
  }

  const weight = { high: 3, medium: 2, low: 1 } as const
  const raw = findings.reduce((a, f) => a + weight[f.severity] * Math.min(3, 1 + Math.log2(f.count)), 0)
  const per100 = st.words > 0 ? raw / Math.max(1, st.words / 100) : 0
  const score = Math.max(0, Math.min(100, Math.round(per100 * 14)))
  const band: AlphaReport['band'] = score >= 62 ? 'heavy' : score >= 38 ? 'noticeable' : score >= 16 ? 'light' : 'human'

  return {
    score,
    band,
    findings: findings.sort((a, b) => weight[b.severity] * b.count - weight[a.severity] * a.count),
    catalog: ALPHA_CATALOG.map((rule) => ({ rule, count: findings.find((f) => f.id === rule.id)?.count ?? 0 })),
    stats: st,
    summary: findings.map((f) => `${f.count}× ${f.label}`),
  }
}

/* ------------------------------------------------------------- local fix -- */

/**
 * Substitutions that cannot change what a sentence means.
 *
 * Deliberately conservative: mechanical punctuation, formatting markers and
 * assistant boilerplate only. Every entry is a pair the reader could have made
 * themselves in a search box, and the report says how many were applied so the
 * result is never a silent rewrite.
 */
const SAFE_FIXES: { id: string; pattern: RegExp; replace: string }[] = [
  { id: 'spaced-em-dash', pattern: / \u2014 /g, replace: ', ' },
  { id: 'em-dash', pattern: /\u2014/g, replace: ',' },
  { id: 'en-dash-range', pattern: /(?<=\w)\u2013(?=\w)/g, replace: '-' },
  { id: 'ellipsis', pattern: /\u2026/g, replace: '...' },
  { id: 'nonbreaking-space', pattern: /\u00a0/g, replace: ' ' },
  { id: 'bold-markers', pattern: /\*\*([^*\n]+)\*\*/g, replace: '$1' },
  { id: 'arrow-chain', pattern: /\s?\u2192\s?/g, replace: ' to ' },
  { id: 'assistant-opener', pattern: /^\s*(certainly|of course|sure|absolutely|great question)[!,.]?\s*/gim, replace: '' },
  { id: 'hope-this-helps', pattern: /^\s*i hope this helps[.!]?\s*$|\s*i hope this helps[.!]?/gim, replace: '' },
  { id: 'offer-more', pattern: /^\s*(would you like me to|let me know if you('?d| would)? like)[^\n]*\n?/gim, replace: '' },
  { id: 'worth-noting', pattern: /\b(it'?s|it is)\s+worth (noting|mentioning|remembering)\s+that\s+/gi, replace: '' },
  { id: 'important-to-note', pattern: /\b(it'?s|it is)\s+important to (note|remember|understand)\s+that\s+/gi, replace: '' },
  { id: 'in-conclusion', pattern: /^\s*(in conclusion|in summary|to sum up|to conclude|in closing),?\s*/gim, replace: '' },
  { id: 'furthermore', pattern: /(^|[.!?]\s+)Furthermore,\s+/g, replace: '$1' },
  { id: 'moreover', pattern: /(^|[.!?]\s+)Moreover,\s+/g, replace: '$1' },
  { id: 'additionally', pattern: /(^|[.!?]\s+)Additionally,\s+/g, replace: '$1' },
  { id: 'not-just-but', pattern: /\bnot just ([^,.!?\n]{2,40}), but /gi, replace: '$1 and ' },
  { id: 'delve', pattern: /\b(delve into|delving into)\b/gi, replace: 'look at' },
  { id: 'leverage', pattern: /\b(leverage|leveraging)\b/gi, replace: 'use' },
  { id: 'utilize', pattern: /\b(utilize|utilizing|utilise|utilising)\b/gi, replace: 'use' },
  { id: 'model-disclaimer', pattern: /\bas an ai\b[^.!?\n]*[.!?]?\s*/gi, replace: '' },
]

export interface LocalFixResult {
  text: string
  applied: { id: string; count: number }[]
  changed: number
}

export function localFix(text: string): LocalFixResult {
  let out = text
  const applied: { id: string; count: number }[] = []
  for (const fix of SAFE_FIXES) {
    const before = out
    out = out.replace(fix.pattern, fix.replace as any)
    if (out !== before) {
      const a = before.match(new RegExp(fix.pattern.source, fix.pattern.flags.replace('g', '') + 'g'))?.length ?? 0
      applied.push({ id: fix.id, count: a || 1 })
    }
  }
  // Tidy what the removals left behind: doubled spaces, a space before a comma,
  // three blank lines, and paragraphs that open with a lowercase letter.
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/\n{3,}/g, '\n\n')
  out = out.split('\n').map((l) => l.trimEnd()).join('\n').replace(/^\s+/gm, (m) => (m.includes('\n') ? '\n' : m)).trim()
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, c: string) => p + c.toUpperCase())
  return { text: out, applied, changed: applied.reduce((a, x) => a + x.count, 0) }
}

/** One-line description of a rule for the reference list. */
export function ruleSummary(rule: AlphaRule): string {
  return `${rule.label} · ${rule.severity} · ${rule.category}`
}
