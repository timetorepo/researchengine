/**
 * AI council: several models answer the same conversation, then the model you
 * chose writes one answer that weighs their drafts.
 *
 * Members answer in plain text (no tools), in parallel, each with its own provider
 * key and endpoint. Their drafts go into the chair's system prompt, so the chair
 * can check them, keep what is right and say where they disagreed. Every member's
 * tokens count toward the message's usage, so the cost is visible, not hidden.
 */
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { streamToCallback } from '@/lib/providers/stream'
import type { Settings } from '@/types'

export const COUNCIL_MAX = 4

/**
 * The jobs a council member can be given. A researcher gathers what is known and where it
 * comes from; a critic argues against the obvious answer and looks for errors; a drafter
 * proposes the clearest structure and wording. The chair (the model that writes the answer)
 * is the orchestrator: it weighs the three and writes one answer.
 */
export type CouncilRole = 'researcher' | 'critic' | 'drafter'
export const COUNCIL_ROLES: { id: CouncilRole; label: string; brief: string }[] = [
  { id: 'researcher', label: 'Researcher', brief: 'Your job is facts and sources. Set out what is known, say how sure you are of each point, and flag what would need checking.' },
  { id: 'critic', label: 'Critic', brief: 'Your job is to challenge. Find the weakest claim, the likeliest error, and the case the obvious answer misses. Be specific; do not invent objections.' },
  { id: 'drafter', label: 'Drafter', brief: 'Your job is the answer itself. Write the clearest complete draft you can, with the structure the question needs.' },
]
const DEFAULT_ROLE_ORDER: CouncilRole[] = ['researcher', 'critic', 'drafter', 'researcher']

/** The role a member plays: the one the person chose, else the default for its place in the council. */
export function councilRoleOf(settings: Settings, id: string): CouncilRole {
  const chosen = settings.councilRoles?.[id]
  if (chosen && COUNCIL_ROLES.some((r) => r.id === chosen)) return chosen
  const index = councilMembers(settings).indexOf(id)
  return DEFAULT_ROLE_ORDER[Math.max(0, index) % DEFAULT_ROLE_ORDER.length]
}

/** The chair's instructions for weighing the drafts. Added to its system prompt when the council ran. */
export const CHAIR_ORCHESTRATION = [
  'You are the chair of the council and you write the final answer.',
  'Weigh the drafts by their roles: take the researcher\'s facts only where they hold up, let the critic\'s objections change your answer where they are right, and borrow the drafter\'s structure where it reads better.',
  'Where two drafts disagree, say so in one sentence and state which view you took and why.',
].join(' ')
/** A draft is clipped before it reaches the chair, so four long drafts cannot crowd out the question. */
const DRAFT_CHARS = 6000

export interface CouncilDraft {
  /** provider:model, as stored in settings. */
  model: string
  label: string
  role: CouncilRole
  text: string
  ok: boolean
  error?: string
  promptTokens: number
  completionTokens: number
  reported: boolean
}

/** Council members from settings, validated and capped. */
export function councilMembers(settings: Settings): string[] {
  return (settings.councilMembers ?? []).filter((id) => id.includes(':')).slice(0, COUNCIL_MAX)
}

export interface CouncilOption { id: string; label: string }

/** Every model the person has a provider for, for the members picker. */
export function councilModelOptions(settings: Settings): CouncilOption[] {
  const out: CouncilOption[] = []
  for (const pid of settings.addedProviders ?? []) {
    const meta = providerById(pid)
    if (!meta) continue
    for (const m of settings.providerModels?.[pid] ?? []) {
      out.push({ id: `${pid}:${m}`, label: `${meta.name} · ${m}` })
    }
  }
  return out
}

function labelFor(id: string): string {
  const [pid, ...rest] = id.split(':')
  return `${providerById(pid)?.name ?? pid} · ${rest.join(':')}`
}

/** One member's answer. Never throws: a failed member is reported, and the others still count. */
export async function runCouncilMember(
  id: string,
  messages: any[],
  system: string,
  settings: Settings,
  signal: AbortSignal,
): Promise<CouncilDraft> {
  const [providerId, ...rest] = id.split(':')
  const model = rest.join(':')
  const label = labelFor(id)
  const role = councilRoleOf(settings, id)
  const base = { model: id, label, role, text: '', promptTokens: 0, completionTokens: 0, reported: false }
  const roleBrief = COUNCIL_ROLES.find((r) => r.id === role)?.brief ?? ''
  const roleSystem = `${system}\n\n# Your role on the council: ${COUNCIL_ROLES.find((r) => r.id === role)?.label}\n${roleBrief}`
  const meta = providerById(providerId)
  if (!meta) return { ...base, ok: false, error: 'That provider is no longer available.' }
  const conf = settings.providers?.[providerId]
  let apiKey = ''
  try {
    apiKey = conf?.apiKey ? await usableKey(conf.apiKey) : ''
  } catch (e: any) {
    return { ...base, ok: false, error: e?.message ?? 'Could not unlock the key.' }
  }
  if (meta.needsKey && !apiKey) return { ...base, ok: false, error: `No key saved for ${meta.name}.` }
  let text = ''
  try {
    const res = await streamToCallback({
      providerId,
      model,
      apiKey,
      baseUrl: conf?.baseUrl || undefined,
      timeoutMs: (settings.providerTimeouts?.[providerId] ?? 45) * 1000,
      system: roleSystem,
      messages,
      temperature: 0.7,
      maxTokens: 1500,
      signal,
    }, (chunk) => { text += chunk })
    return {
      ...base,
      text: text.trim(),
      ok: text.trim().length > 0,
      error: text.trim() ? undefined : 'No answer came back.',
      promptTokens: res.usage?.prompt ?? res.promptEstimate,
      completionTokens: res.usage?.completion ?? res.completionTokens,
      reported: !!res.usage?.reported,
    }
  } catch (e: any) {
    if (signal.aborted) throw e
    return { ...base, text: text.trim(), ok: false, error: String(e?.message ?? e) }
  }
}

/** The block added to the chair's system prompt, built from the members that answered. */
export function councilBlock(drafts: CouncilDraft[]): string {
  const answered = drafts.filter((d) => d.ok && d.text)
  if (answered.length === 0) return ''
  const body = answered
    .map((d, i) => `--- Draft ${i + 1} (${d.label}, ${COUNCIL_ROLES.find((r) => r.id === d.role)?.label ?? 'member'}) ---\n${d.text.length > DRAFT_CHARS ? `${d.text.slice(0, DRAFT_CHARS)}…` : d.text}`)
    .join('\n\n')
  return [
    '',
    `AI council: ${answered.length} other model${answered.length === 1 ? '' : 's'} answered the same conversation.`,
    'Use their drafts as second opinions. Check them, keep what is right, correct what is wrong, and say briefly where they disagreed and which view you took.',
    CHAIR_ORCHESTRATION,
    'Write one final answer for the person. Do not paste the drafts back.',
    '',
    body,
  ].join('\n')
}
