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
/** A draft is clipped before it reaches the chair, so four long drafts cannot crowd out the question. */
const DRAFT_CHARS = 6000

export interface CouncilDraft {
  /** provider:model, as stored in settings. */
  model: string
  label: string
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
  const base = { model: id, label, text: '', promptTokens: 0, completionTokens: 0, reported: false }
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
      system,
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
    .map((d, i) => `--- Draft ${i + 1} (${d.label}) ---\n${d.text.length > DRAFT_CHARS ? `${d.text.slice(0, DRAFT_CHARS)}…` : d.text}`)
    .join('\n\n')
  return [
    '',
    `AI council: ${answered.length} other model${answered.length === 1 ? '' : 's'} answered the same conversation.`,
    'Use their drafts as second opinions. Check them, keep what is right, correct what is wrong, and say briefly where they disagreed and which view you took.',
    'Write one final answer for the person. Do not paste the drafts back.',
    '',
    body,
  ].join('\n')
}
