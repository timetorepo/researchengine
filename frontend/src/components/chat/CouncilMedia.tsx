/**
 * What sits under an answer besides its text: the AI council's drafts (collapsed,
 * so the final answer stays the focus) and any image or audio a tool generated.
 */
import React from 'react'
import { Users, AlertTriangle, ChevronDown } from 'lucide-react'
import type { ChatMessage } from '@/types'

type Draft = NonNullable<ChatMessage['council']>[number]

export function CouncilDrafts({ drafts, streaming }: { drafts?: Draft[]; streaming: boolean }) {
  if (!drafts || drafts.length === 0) return null
  const answered = drafts.filter((d) => d.ok).length
  return (
    <details className="council-drafts group mt-3 rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-[12px]" style={{ color: 'var(--text-2)' }}>
        <Users size={13} strokeWidth={1.7} aria-hidden style={{ color: 'var(--primary)' }} />
        <span className="font-medium" style={{ color: 'var(--text)' }}>AI council</span>
        <span>
          {streaming && answered === 0 ? 'Models are drafting…' : `${answered} of ${drafts.length} answered`}
        </span>
        <ChevronDown size={13} aria-hidden className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 space-y-3">
        {drafts.map((d, i) => (
          <div key={`${d.model}-${i}`} className="rounded-[10px] p-2.5" style={{ background: 'var(--elevated)' }}>
            <div className="text-[11.5px] font-semibold mb-1 flex items-center gap-1.5">
              {d.ok ? null : <AlertTriangle size={11} aria-hidden style={{ color: 'var(--warning)' }} />}
              {d.label}
            </div>
            {d.ok ? (
              <p className="text-[12px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-2)' }}>{d.text}</p>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--warning)' }}>{d.error ?? 'No answer came back.'}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

export function MediaStrip({ media }: { media?: ChatMessage['media'] }) {
  if (!media || media.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-3">
      {media.map((m, i) => m.kind === 'image' ? (
        <img key={i} src={m.src} alt={m.alt} className="max-w-full rounded-[14px]" style={{ maxHeight: 520, border: '1px solid var(--surface-border)' }} loading="lazy" />
      ) : (
        <audio key={i} src={m.src} controls className="w-full max-w-md" aria-label={m.alt} />
      ))}
    </div>
  )
}
