/**
 * AI council members. Turn council on per message from the composer (the Council
 * pill). Here the person picks which models sit on the council: up to four, from
 * the providers they already use.
 */
import React, { useMemo, useState } from 'react'
import { Users, X, Plus } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { Button } from '@/components/ui/heroui/Button'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { COUNCIL_MAX, councilMembers, councilModelOptions } from '@/lib/chat/council'

export function CouncilPanel() {
  const settings = useStore((s) => s.settings)
  const members = useMemo(() => councilMembers(settings), [settings])
  const options = useMemo(() => councilModelOptions(settings).filter((o) => !members.includes(o.id)), [settings, members])
  const [pick, setPick] = useState('')
  const full = members.length >= COUNCIL_MAX

  const save = (next: string[]) => {
    useStore.setState((s) => ({ settings: { ...s.settings, councilMembers: next.slice(0, COUNCIL_MAX) } }))
  }
  const labelOf = (id: string) => councilModelOptions(settings).find((o) => o.id === id)?.label ?? id

  return (
    <section className="surface-elevated p-4 mb-5" style={{ borderRadius: 'var(--radius-card)' }} aria-labelledby="council-heading">
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} strokeWidth={1.6} style={{ color: 'var(--primary)' }} aria-hidden />
        <h3 id="council-heading" className="text-[14px] font-semibold">AI council</h3>
      </div>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
        Turn on <b>Council</b> in the composer for a message. The members below answer the same conversation, then the
        model you chose writes one answer that weighs their drafts. Up to {COUNCIL_MAX} members.
      </p>

      {members.length === 0 ? (
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 mb-3" aria-label="Council members">
          {members.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-[12.5px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <span className="flex-1 min-w-0 truncate">{labelOf(id)}</span>
              <Button size="sm" variant="ghost" color="default" onClick={() => save(members.filter((m) => m !== id))} >
                <X size={12} aria-hidden /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {options.length === 0 && members.length === 0 ? (
        <InlineAlert status="default" title="No models to choose from">
          Add a provider with models under Providers first. Council members come from the providers you already use.
        </InlineAlert>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[220px]">
            <span className="block text-[12.5px] font-medium mb-1.5">Add a member</span>
            <select
              value={pick}
              disabled={full}
              onChange={(e) => setPick(e.target.value)}
              className="w-full rounded-[12px] px-3 py-2 text-[12.5px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
            >
              <option value="">{full ? `The council is full (${COUNCIL_MAX})` : 'Choose a model'}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <Button size="sm" disabled={!pick || full} onClick={() => { save([...members, pick]); setPick('') }}>
            <Plus size={12} aria-hidden /> Add
          </Button>
        </div>
      )}

      <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-3)' }}>
        Each member is a separate request, billed by its provider, and the chair's answer costs one more. Council is for hard questions, not everyday ones. Members answer in text only; they do not use tools.
      </p>
    </section>
  )
}
