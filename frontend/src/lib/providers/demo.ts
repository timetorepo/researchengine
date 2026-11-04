// Local demo model — runs entirely on-device so Research Engine is fully
// usable before any API key is configured. Clearly labeled in the UI.
import { classifyQuery } from '@/lib/flow/classifier'
import type { Source } from '@/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const DOMAINS = ['arxiv.org', 'nature.com', 'wikipedia.org', 'ncbi.nlm.nih.gov', 'acm.org', 'ieee.org', 'sciencedirect.com', 'stanford.edu', 'mit.edu', 'theatlantic.com']

export function demoSources(query: string, count = 5): Source[] {
  const words = query.split(/\s+/).filter((w) => w.length > 3).slice(0, 5)
  const topic = words.length ? words.join(' ') : query
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const templates = [
    (t: string) => `A systematic review of ${t}`,
    (t: string) => `${cap(t)}: current evidence and open questions`,
    (t: string) => `Understanding ${t} — a practical guide`,
    (t: string) => `Recent advances in ${t}`,
    (t: string) => `${cap(t)} explained: mechanisms, data, and debate`,
    (t: string) => `The state of ${t} in 2026`,
  ]
  return Array.from({ length: count }, (_, i) => {
    const domain = DOMAINS[(i * 3 + topic.length) % DOMAINS.length]
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    return {
      id: `src-${i}`,
      title: templates[i % templates.length](topic),
      url: `https://${domain}/${slug}`,
      domain,
      snippet: `Peer-reviewed coverage of ${topic}, with emphasis on methodology, reproducibility, and the strongest competing interpretations of the evidence.`,
      faviconHue: (topic.length * 47 + i * 61) % 360,
    }
  })
}

export function demoAnswer(query: string, opts: { math?: boolean; quality?: boolean; search?: boolean }): string {
  if (query.trim().toLowerCase() === 'origin story') {
    return [
      `### A build note`,
      ``,
      `Research Engine was made for the person who reads papers at midnight — researchers, scientists, students, and the privacy-conscious power users who refuse to hand their thinking to a server farm.`,
      ``,
      `Every design decision starts from one rule: **your data stays on your device**. The only bytes that leave this machine are the ones you explicitly aim at a provider you configured, with a key you own.`,
      ``,
      `It was built to feel like a tool you'd use every day — because someone does.`,
      ``,
      `> *You found one of the quiet corners of this app. There are others.*`,
    ].join('\n')
  }
  const cls = opts.math ? 'math' : classifyQuery(query)
  const q = query.trim()
  const short = q.length > 64 ? q.slice(0, 64) + '…' : q
  const cite = (n: number) => (opts.search ? ` [${n}]` : '')

  if (cls === 'math' || opts.math) {
    return [
      `**Problem.** ${short}`,
      ``,
      `### Step 1 — Set up`,
      `Let's translate the question into math. Suppose the key quantity is $x$. We want to isolate it, so we write the relationship as`,
      `$$f(x) = ax^2 + bx + c = 0$$`,
      ``,
      `### Step 2 — Solve`,
      `Applying the quadratic formula,`,
      `$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$`,
      `The discriminant $\\Delta = b^2 - 4ac$ determines the nature of the roots: two real roots when $\\Delta > 0$, one repeated root at $\\Delta = 0$, and complex conjugate roots when $\\Delta < 0$.`,
      ``,
      `### Step 3 — Interpret`,
      `Substituting the concrete coefficients from the problem gives the final values. Always verify by plugging back into the original equation.`,
      ``,
      `> **Answer.** $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ — with the sign chosen to satisfy the problem's constraints.`,
      ``,
      `*This is a local demo response — connect a model in Settings for real step-by-step solutions.*`,
    ].join('\n')
  }

  if (cls === 'code') {
    return [
      `Here's a clean, idiomatic take on **${short}**:`,
      ``,
      '```typescript',
      `// ${short}`,
      `export function solve(input: string): string {`,
      `  const normalized = input.trim().toLowerCase();`,
      `  // 1. validate early, 2. transform, 3. return`,
      `  if (!normalized) throw new Error("empty input");`,
      `  return normalized.split(/\\s+/).reverse().join(" ");`,
      `}`,
      '```',
      ``,
      `**How it works**`,
      `1. Normalize the input so behavior is deterministic.`,
      `2. Fail fast on invalid data — no silent fallbacks.`,
      `3. Keep the transform pure so it's trivially testable.`,
      ``,
      `Complexity is $O(n)$ in input length. Want me to adapt this to a specific language or edge case?`,
      ``,
      `*Local demo response — add a provider key in Settings to run real models.*`,
    ].join('\n')
  }

  if (cls === 'longform' || opts.quality) {
    return [
      `## ${short}`,
      ``,
      `**Summary.** This is a structured, long-form treatment. The short version: the question has a defensible core answer, two or three genuine points of contention, and a set of practical implications worth separating cleanly${cite(1)}.`,
      ``,
      `### 1. What we know`,
      `The strongest evidence points in a consistent direction. Key findings from recent work include:`,
      `- Replicated results across independent datasets${cite(2)}`,
      `- Effect sizes that survive correction for multiple comparisons`,
      `- Mechanistic explanations that align with the observed data${cite(3)}`,
      ``,
      `### 2. Where the real debate is`,
      `| Position | Evidence | Weakness |`,
      `|---|---|---|`,
      `| Mainstream view | Broad replication | Publication bias |`,
      `| Skeptical view | Methodology audits | Small samples |`,
      `| Emerging view | New instrumentation | Not yet replicated |`,
      ``,
      `### 3. Practical implications`,
      `1. **For researchers** — pre-register the decisive comparison.`,
      `2. **For practitioners** — the core result is robust enough to act on, conservatively.`,
      `3. **For students** — learn the methodology; the conclusions follow from it.`,
      ``,
      `### Bottom line`,
      `Treat the core claim as well-supported, hold the edge cases lightly, and watch the replication pipeline more than any single headline${cite(1)}.`,
      ``,
      `*Local demo response — configure a model in Settings for real answers.*`,
    ].join('\n')
  }

  // default factual / reasoning / creative
  return [
    `**${short}**`,
    ``,
    `Here's the direct answer, followed by the reasoning.`,
    ``,
    `The core of it: this comes down to a small number of well-understood factors. The most important one is the mechanism itself — once you see it, the rest follows. Second-order effects matter, but they shift the answer by degrees, not kind${cite(1)}.`,
    ``,
    `- **Key point 1** — the primary driver, responsible for most of the effect${cite(2)}`,
    `- **Key point 2** — the main modifier; context-dependent`,
    `- **Key point 3** — the common misconception worth correcting`,
    ``,
    `If you want, I can go deeper on any of these, or turn this into a quiz${opts.search ? ' with these sources' : ''}.`,
    ``,
    `> *Local demo response — Research Engine runs fully offline until you add a provider key in Settings.*`,
  ].join('\n')
}

export const DEMO_FOLLOW_UPS = [
  'Go deeper on the strongest point',
  'Turn this into a quiz',
  'Show the counter-argument',
  'Summarize in one sentence',
  'Save this as a knowledge card',
  'Make it a literature review section',
]

/** Streams a demo answer token-by-token with human-ish pacing. */
export async function streamDemo(
  query: string,
  opts: { math?: boolean; quality?: boolean; search?: boolean },
  onChunk: (t: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  await sleep(350 + Math.random() * 350) // "thinking"
  const text = demoAnswer(query, opts)
  const words = text.split(/(?<=\s)/)
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    onChunk(words[i])
    // batch a few words per frame-ish tick for smooth streaming
    if (i % 3 === 0) await sleep(16 + Math.random() * 30)
  }
}
