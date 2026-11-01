// Interior-style poll results: bars that grow to each option's share. A member
// votes once; the bars update live. Bots open polls from a ```poll fence.
import { useState } from 'react'
import { motion } from 'motion/react'

export type PollSpec = { question: string; options: { label: string; votes?: number }[] }

export function PollResults({ poll }: { poll: PollSpec }) {
  const base = poll.options.map((o) => o.votes ?? 0)
  const [picked, setPicked] = useState<number | null>(null)
  const counts = base.map((v, i) => v + (picked === i ? 1 : 0))
  const total = counts.reduce((s, n) => s + n, 0) || 1

  return (
    <div className="rounded-[14px] p-3 my-2 max-w-md" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="text-[13px] font-medium mb-2" style={{ color: 'var(--text)' }}>{poll.question}</div>
      <ul className="space-y-2">
        {poll.options.map((o, i) => {
          const share = Math.round((counts[i] / total) * 100)
          return (
            <li key={o.label}>
              <button type="button" onClick={() => setPicked(i)} aria-pressed={picked === i}
                className="relative w-full overflow-hidden rounded-[9px] px-3 py-1.5 text-left text-[12.5px]"
                style={{ border: `1px solid ${picked === i ? 'var(--primary)' : 'var(--surface-border)'}`, color: 'var(--text)' }}>
                <motion.span aria-hidden className="absolute inset-y-0 left-0" style={{ background: 'color-mix(in srgb, var(--primary) 22%, transparent)' }}
                  initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                <span className="relative flex justify-between gap-3"><span>{o.label}</span><span className="tabular-nums">{share}%</span></span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>{total} vote{total === 1 ? '' : 's'}{picked === null ? ' · pick one' : ''}</div>
    </div>
  )
}

/** Reads the JSON a bot writes inside a ```poll fence. Returns null if it is not a poll yet (still streaming, or malformed). */
export function parsePoll(text: string): PollSpec | null {
  try {
    const raw = JSON.parse(text) as { question?: unknown; options?: unknown }
    if (typeof raw.question !== 'string' || !Array.isArray(raw.options)) return null
    const options = raw.options
      .map((o) => (typeof o === 'string' ? { label: o } : o && typeof (o as { label?: unknown }).label === 'string'
        ? { label: (o as { label: string }).label, votes: Number((o as { votes?: unknown }).votes) || 0 } : null))
      .filter((o): o is { label: string; votes: number } => !!o)
    return options.length >= 2 ? { question: raw.question, options } : null
  } catch {
    return null
  }
}
