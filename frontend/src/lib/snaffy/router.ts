/**
 * Snaffy — a router, not a model.
 *
 * Snaffy owns no weights and holds no key of its own. It takes the providers
 * you have already configured and routes a request to one of them, applying a
 * persona system prompt on the way. The personas are the point: the same model
 * behaves like a different agent depending on the instructions in front of it,
 * and Snaffy's job is to pick both the model and the behaviour, then get out of
 * the way.
 *
 * This is deliberately not a new provider in the registry. Registering one
 * would mean inventing a model list, a key field and a base URL for something
 * that has none of those. Snaffy reads `settings.providers` and
 * `settings.providerModels`, which are the live truth about what you can
 * actually call.
 *
 * The routing is a scored pick, not a lookup: each persona says what it needs,
 * each model says what it is, and the router picks the best pairing that is
 * actually enabled. When nothing matches it says so rather than falling back
 * to whatever happens to be first.
 */
import { PROVIDERS } from '@/lib/providers/registry'
import { contextWindowFor } from '@/lib/providers/context-window'

export interface SnaffyPersona {
  id: string
  /** The agent this persona behaves like. */
  name: string
  /** One line on what the persona changes. */
  about: string
  /**
   * The system prompt. Kept short on purpose: a persona prompt that runs to
   * three pages is a persona prompt nobody has read, and the model will not
   * follow it either.
   */
  prompt: string
  /** What the persona needs from a model, in order of preference. */
  wants: ('reasoning' | 'speed' | 'code' | 'long-context' | 'vision' | 'cheap')[]
  /** Rough tokens the persona expects to work with. */
  context: number
}

export const PERSONAS: SnaffyPersona[] = [
  {
    id: 'manus',
    name: 'Manus',
    about: 'An autonomous agent: plan, act on the machine, deliver a file.',
    prompt: [
      'You are an autonomous agent. Given a task, work it end to end without asking for permission at each step.',
      '',
      'Start by restating the goal in one sentence and naming what "done" looks like. Then plan the steps, in order, each one concrete and checkable.',
      '',
      'Act. Use the tools you have — shell, files, browser, code — and report what each step produced rather than what you intended.',
      '',
      'When you hit something you cannot do, say which step failed and why, then continue with the rest. Do not stop to ask whether to proceed; the task was given to you to finish.',
      '',
      'Finish with the deliverable itself, not a description of it. If it is a file, produce the file.',
    ].join('\n'),
    wants: ['reasoning', 'long-context', 'code'],
    context: 200_000,
  },
  {
    id: 'researcher',
    name: 'Deep Researcher',
    about: 'Reads widely, cites what it read, says what it could not find.',
    prompt: [
      'You are a research agent. Your job is to find out what is actually true and to show your work.',
      '',
      'Search before you answer. Every claim that is not common knowledge carries a source, named and linked.',
      '',
      'When sources disagree, say so and give both. When you cannot find something, say that plainly rather than filling the gap with what seems likely.',
      '',
      'Separate what the sources say from what you infer. Mark the inference as yours.',
      '',
      'End with the answer first, then the evidence.',
    ].join('\n'),
    wants: ['reasoning', 'long-context'],
    context: 200_000,
  },
  {
    id: 'coder',
    name: 'Coding Agent',
    about: 'Writes and runs code, verifies it runs, leaves the repo better.',
    prompt: [
      'You are a coding agent working in a real repository.',
      '',
      'Read the surrounding code before you change it, and match its conventions rather than yours.',
      '',
      'Write the change, then run it. A test, a typecheck, the command itself — something that proves the change works. If you cannot run it, say which check you skipped.',
      '',
      'Do not leave a change half-applied. If a task needs several files, do all of them.',
      '',
      'Report what changed and what you verified, in that order.',
    ].join('\n'),
    wants: ['code', 'reasoning'],
    context: 200_000,
  },
  {
    id: 'operator',
    name: 'Operator',
    about: 'Drives a browser: clicks, fills, waits, and reports what it saw.',
    prompt: [
      'You are operating a browser on the user\'s behalf.',
      '',
      'Describe what you see before you act, and act one step at a time. After each action, say what changed on screen.',
      '',
      'If a page asks for credentials, a payment or anything irreversible, stop and tell the user rather than proceeding.',
      '',
      'When you reach the goal, report the final state with the URL.',
    ].join('\n'),
    wants: ['speed', 'vision'],
    context: 128_000,
  },
  {
    id: 'triage',
    name: 'Fast Triage',
    about: 'The cheap fast path: classify, summarise, route, do not elaborate.',
    prompt: [
      'You are a fast triage agent. Be brief.',
      '',
      'Classify, summarise or route the input. One short paragraph at most.',
      '',
      'If the input needs real work rather than triage, say what kind of work and stop. Do not attempt the work yourself.',
    ].join('\n'),
    wants: ['cheap', 'speed'],
    context: 32_000,
  },
]

export const DEFAULT_PERSONA = 'manus'

export function personaById(id: string): SnaffyPersona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
}

/* -------------------------------------------------------------- routing -- */

export interface RoutableModel {
  /** "provider:model", the same ref the rest of the app uses. */
  ref: string
  provider: string
  model: string
  context: number
  /** The provider's API shape, kept so a caller can tell them apart. */
  kind: string
}

export interface RouteDecision {
  /** The chosen model ref, or null when nothing can serve the persona. */
  ref: string | null
  provider: string | null
  model: string | null
  /** Why this one. Shown in the UI so the pick is never a mystery. */
  because: string
  /** Everything that was considered, in the order it lost. */
  considered: { ref: string; score: number }[]
}

/** What a provider is good at, in Snaffy's terms. */
function capabilities(providerId: string, model: string, context: number): Set<SnaffyPersona['wants'][number]> {
  const caps = new Set<SnaffyPersona['wants'][number]>()
  const meta = PROVIDERS.find((p) => p.id === providerId)
  const m = model.toLowerCase()

  if (context >= 128_000) caps.add('long-context')
  if (/reason|thinking|o1|o3|o4|r1|qwq/.test(m)) caps.add('reasoning')
  if (/code|coder|codex|swe|dev/.test(m)) caps.add('code')
  if (/vision|vl|4o|gemini|claude/.test(m)) caps.add('vision')
  if (/flash|haiku|mini|nano|lite|small|fast|instant/.test(m)) caps.add('speed')
  if (/free/.test(m)) caps.add('cheap')
  // Capability by family, not only by name. The general models from the three
  // mainstream providers all write code and all read images, and a router that
  // refused to send a coding persona to Claude because the model name did not
  // contain the word "code" would be a router that routes nowhere.
  if (meta && ['openai', 'anthropic', 'gemini'].includes(meta.kind)) {
    caps.add('code')
    caps.add('vision')
  }
  return caps
}

/**
 * Score a model against a persona. A capability the persona wants first is
 * worth more than one it wants third, so the order in `wants` carries weight.
 *
 * A model that cannot fit the persona's context is not a candidate at all,
 * which is why it scores zero rather than scoring low: routing a 200k-context
 * agent to a 32k model is not a slightly worse choice, it is a broken one.
 */
function score(model: RoutableModel, persona: SnaffyPersona): { score: number; because: string } {
  const caps = capabilities(model.provider, model.model, model.context)
  if (model.context < persona.context) {
    return { score: 0, because: `only ${model.context.toLocaleString()} of context, the persona needs ${persona.context.toLocaleString()}` }
  }
  let total = 0
  const hits: string[] = []
  persona.wants.forEach((want, i) => {
    const weight = persona.wants.length - i
    if (caps.has(want)) {
      total += weight
      hits.push(want)
    }
  })
  if (!hits.length) {
    // No capability overlap, but the window fits. Routable at the bottom of the
    // order rather than not at all: a working route with an honest reason beats
    // a router that declines to route.
    // Half a point, below the weight of any single hit (the lowest is 1), so a
    // model that matches even the persona's last preference always outranks one
    // that matches none of them.
    return { score: 0.5, because: `nothing the persona asks for, but it fits the ${Math.round(model.context / 1000)}k window` }
  }
  return {
    score: total,
    because: `${hits.join(' and ')}${model.context >= persona.context ? `, ${Math.round(model.context / 1000)}k of context` : ''}`,
  }
}

/**
 * Pick the model for a persona from what the user can actually call.
 *
 * `enabled` is the set of providers with a key and the switch on; `models` is
 * providerModels. Both are passed in rather than read from the store so this
 * stays pure and testable in node.
 */
export function route(
  personaId: string,
  enabled: { provider: string; models: string[] }[],
): RouteDecision {
  const persona = personaById(personaId)
  const considered: { ref: string; score: number }[] = []
  let best: { ref: string; score: number; because: string } | null = null

  for (const entry of enabled) {
    for (const model of entry.models) {
      const routable: RoutableModel = {
        ref: `${entry.provider}:${model}`,
        provider: entry.provider,
        model,
        context: contextFor(entry.provider, model),
        kind: PROVIDERS.find((p) => p.id === entry.provider)?.kind ?? '',
      }
      const s = score(routable, persona)
      considered.push({ ref: routable.ref, score: s.score })
      if (s.score > 0 && (!best || s.score > best.score)) {
        best = { ref: routable.ref, score: s.score, because: s.because }
      }
    }
  }

  considered.sort((a, b) => b.score - a.score)
  if (!best) {
    return {
      ref: null,
      provider: null,
      model: null,
      because: 'none of your enabled models fit this persona',
      considered,
    }
  }
  const [provider, ...rest] = best.ref.split(':')
  return {
    ref: best.ref,
    provider,
    model: rest.join(':'),
    because: best.because,
    considered: considered.slice(0, 5),
  }
}

/** Context window for a provider/model, from the app's own table. */
function contextFor(provider: string, model: string): number {
  // The table keys off the model name, which is where the family actually shows
  // up; the provider is only there to make the ref unambiguous in logs.
  return contextWindowFor(model)
}
