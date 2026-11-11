/**
 * ECC roles, behind plain names.
 *
 * ECC (affaan-m/ecc, MIT) ships 71 agent roles. A person does not pick one of
 * those. They pick a family with a plain name — Researcher, Workflow, Builder,
 * and so on — and the family's members are chosen per request: each member is
 * scored against the request and the custom instructions (the bot's job, or the
 * chat persona), and the best one or two become the working method for that reply.
 *
 * Everything here is pure. It runs the same in the browser, in the bots and in the
 * main chat, and the tests check it without a model.
 */
import { ECC_AGENT_META } from '@/content/ecc/meta'

export type RoleFamilyId =
  | 'researcher' | 'workflow' | 'builder' | 'reviewer' | 'guardian' | 'writer' | 'analyst' | 'maintainer'

export interface RoleFamily {
  id: RoleFamilyId
  name: string
  blurb: string
  /** ECC agent ids. The first one is the lead, used when nothing in the request matches. */
  members: string[]
}

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    id: 'researcher', name: 'Researcher', blurb: 'Finds, reads and checks sources before it answers.',
    members: ['docs-lookup', 'code-explorer', 'spec-miner', 'conversation-analyzer', 'rag-pipeline-reviewer'],
  },
  {
    id: 'workflow', name: 'Workflow', blurb: 'Plans the steps, keeps the work moving, and hands it on.',
    members: ['planner', 'chief-of-staff', 'loop-operator', 'harness-optimizer', 'gan-planner'],
  },
  {
    id: 'builder', name: 'Builder', blurb: 'Designs and writes code, and clears build failures.',
    members: [
      'architect', 'code-architect', 'tdd-guide', 'refactor-cleaner', 'code-simplifier', 'performance-optimizer',
      'e2e-runner', 'build-error-resolver', 'go-build-resolver', 'cpp-build-resolver', 'dart-build-resolver',
      'django-build-resolver', 'java-build-resolver', 'kotlin-build-resolver', 'pytorch-build-resolver',
      'react-build-resolver', 'rust-build-resolver', 'swift-build-resolver', 'harmonyos-app-resolver', 'gan-generator',
    ],
  },
  {
    id: 'reviewer', name: 'Reviewer', blurb: 'Checks code, tests, types and interfaces for problems.',
    members: [
      'code-reviewer', 'commit-reviewer', 'pr-test-analyzer', 'type-design-analyzer', 'silent-failure-hunter',
      'bengali-reviewer', 'cpp-reviewer', 'csharp-reviewer', 'django-reviewer', 'fastapi-reviewer', 'flutter-reviewer',
      'fsharp-reviewer', 'go-reviewer', 'java-reviewer', 'kotlin-reviewer', 'php-reviewer', 'python-reviewer',
      'react-reviewer', 'ruby-reviewer', 'rust-reviewer', 'swift-reviewer', 'typescript-reviewer', 'vue-reviewer',
      'a11y-architect',
    ],
  },
  {
    id: 'guardian', name: 'Guardian', blurb: 'Looks at security, safety, health data and network risk.',
    members: ['security-reviewer', 'healthcare-reviewer', 'network-config-reviewer', 'network-troubleshooter', 'network-architect', 'homelab-architect'],
  },
  {
    id: 'writer', name: 'Writer', blurb: 'Writes and improves docs, copy, comments and search-friendly pages.',
    members: ['doc-updater', 'seo-specialist', 'marketing-agent', 'comment-analyzer'],
  },
  {
    id: 'analyst', name: 'Analyst', blurb: 'Judges results, data quality and model behaviour.',
    members: ['agent-evaluator', 'gan-evaluator', 'mle-reviewer', 'database-reviewer'],
  },
  {
    id: 'maintainer', name: 'Maintainer', blurb: 'Looks after open-source projects: forks, packaging and clean-up.',
    members: ['opensource-forker', 'opensource-packager', 'opensource-sanitizer'],
  },
]

/** Most roles a single reply draws on. */
export const MAX_ROLES_PER_REPLY = 2
/** Total characters of ECC method text added to one system prompt. */
export const MAX_ROLE_TEXT = 9000

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'can', 'use', 'when', 'what', 'how',
  'about', 'into', 'want', 'need', 'make', 'help', 'please', 'should', 'will', 'have', 'has', 'not', 'but', 'all',
  'any', 'its', 'our', 'their', 'they', 'them', 'some', 'more', 'like', 'just', 'also', 'such', 'than', 'then',
  'only', 'over', 'very', 'each', 'other', 'which', 'where', 'who', 'does', 'did', 'was', 'were', 'been', 'being',
  'one', 'two', 'let', 'get', 'got', 'out', 'off', 'per', 'via', 'use', 'using', 'used', 'work', 'working',
  'bot', 'bots', 'agent', 'agents', 'role', 'task', 'tasks', 'people', 'person', 'user', 'users', 'new', 'old',
])

/** Lowercase words of three letters or more, without filler words. */
export function tokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOP.has(w)) out.add(w)
  }
  return out
}

/** Which family an ECC agent belongs to. */
export function familyOfAgent(agentId: string): RoleFamily | undefined {
  return ROLE_FAMILIES.find((f) => f.members.includes(agentId))
}

export function familyById(id: string): RoleFamily | undefined {
  return ROLE_FAMILIES.find((f) => f.id === id)
}

/**
 * The family a stored role points at. New roles store the family id. Older bots
 * stored a single ECC agent id, which still resolves to its family.
 */
export function familyForRole(role: { id: string } | undefined | null): RoleFamily | undefined {
  if (!role) return undefined
  return familyById(role.id) ?? familyOfAgent(role.id)
}

/** Name and description only. Enough to choose; the prompt is loaded separately. */
export interface AgentMeta { id: string; name: string; description: string }

function agentOf(id: string): AgentMeta | undefined {
  return ECC_AGENT_META.find((a) => a.id === id)
}

/**
 * Score one member against the request and the custom instructions. A word in the
 * agent's name (python, sql, planner) is worth more than a word in its description.
 */
export function scoreAgent(agent: AgentMeta, request: Set<string>, instructions: Set<string>): number {
  const nameWords = tokens(agent.name.replace(/-/g, ' '))
  const descWords = tokens(agent.description)
  let score = 0
  for (const w of nameWords) {
    if (request.has(w)) score += 4
    if (instructions.has(w)) score += 2
  }
  for (const w of descWords) {
    if (request.has(w)) score += 1
    if (instructions.has(w)) score += 0.5
  }
  return score
}

/**
 * Pick the members of a family that fit this request. Best matches first, at most
 * MAX_ROLES_PER_REPLY. When nothing matches, the lead member is used alone.
 */
export function selectMembers(family: RoleFamily, request: string, instructions = ''): AgentMeta[] {
  const req = tokens(request)
  const ins = tokens(instructions)
  const scored = family.members
    .map((id) => agentOf(id))
    .filter((a): a is AgentMeta => !!a)
    .map((a) => ({ a, s: scoreAgent(a, req, ins) }))
    .sort((x, y) => y.s - x.s)
  const hits = scored.filter((x) => x.s > 0).slice(0, MAX_ROLES_PER_REPLY).map((x) => x.a)
  if (hits.length) return hits
  const lead = agentOf(family.members[0])
  return lead ? [lead] : []
}

/**
 * The working method text for one reply. It names the family and the members it
 * drew on, then gives each member's ECC instructions, cut so the total stays under
 * MAX_ROLE_TEXT. Nothing is rewritten; a cut is marked. The prompts are loaded
 * here, not at start-up, so the main bundle does not carry them.
 */
export async function roleText(family: RoleFamily, request: string, instructions = ''): Promise<{ text: string; picked: string[] }> {
  const picked = selectMembers(family, request, instructions)
  if (!picked.length) return { text: '', picked: [] }
  const { ECC_AGENTS } = await import('@/content/ecc/agents')
  const prompts = new Map(ECC_AGENTS.map((a) => [a.id, a.prompt]))
  const header = (a: AgentMeta) => `### ${a.name}\n`
  const room = Math.floor(MAX_ROLE_TEXT / picked.length)
  const parts = picked.map((a) => {
    const prompt = prompts.get(a.id) ?? ''
    const budget = Math.max(0, room - header(a).length - 40)
    const body = prompt.length > budget ? `${prompt.slice(0, budget)}\n\n(cut to fit)` : prompt
    return `${header(a)}${body}`
  })
  const text = [
    `Working method, from the ${family.name} role (${picked.map((a) => a.name).join(', ')}). ${family.blurb}`,
    ...parts,
  ].join('\n\n')
  return { text, picked: picked.map((a) => a.name) }
}

/** Every ECC agent sits in exactly one family. Used by the tests and the vendoring check. */
export function unassignedAgents(): string[] {
  const placed = new Set(ROLE_FAMILIES.flatMap((f) => f.members))
  return ECC_AGENT_META.map((a) => a.id).filter((id) => !placed.has(id))
}
