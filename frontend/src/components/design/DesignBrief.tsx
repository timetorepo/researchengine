/**
 * "Premium is vague" — the questionnaire.
 *
 * One question at a time, because that is how a person answers honestly, and
 * because the answer to "what does premium mean to you" changes what the next
 * question should be. The result is a brief that is attached to every design
 * prompt afterwards, shown here as the exact block the agent receives.
 */
import React, { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, RotateCcw, ClipboardCopy } from 'lucide-react'
import { useDesign } from '@/stores/useDesign'
import { briefAsPrompt, briefIsComplete } from '@/lib/design/suggest'

interface Question {
  key: keyof ReturnType<typeof useDesign.getState>['brief']
  title: string
  why: string
  kind: 'text' | 'choice' | 'long'
  options?: string[]
  placeholder?: string
}

const QUESTIONS: Question[] = [
  { key: 'subject', title: 'What is it?', why: 'One line. "A booking site for a barber", not "a website".', kind: 'text', placeholder: 'A dashboard for tracking solar output' },
  { key: 'audience', title: 'Who is it for?', why: 'The audience decides density and tone more than taste does.', kind: 'text', placeholder: 'Homeowners with panels, not installers' },
  {
    key: 'style', title: 'When you say premium, which one do you mean?', why: 'This is the question that matters most — the two answers lead to different work.',
    kind: 'choice', options: ['SAAS look', 'unique website', 'editorial', 'playful', 'brutalist'],
  },
  { key: 'density', title: 'How dense should a screen feel?', why: 'Airy pages need fewer features per screen; dense ones need better hierarchy.', kind: 'choice', options: ['airy', 'balanced', 'dense'] },
  { key: 'motion', title: 'How much motion?', why: 'Someone will ask for "smooth" — this decides whether that means a 90 ms fade or a scroll story.', kind: 'choice', options: ['almost none', 'subtle', 'expressive', 'cinematic'] },
  { key: 'theme', title: 'Light, dark, or both?', why: 'Dark-first is a different colour system, not a filter.', kind: 'choice', options: ['dark', 'light', 'both'] },
  { key: 'type', title: 'What should the type feel like?', why: 'Leave it blank to let the direction cards propose pairings.', kind: 'text', placeholder: 'Neutral and technical, or warm serif for headings' },
  { key: 'accent', title: 'One accent colour — what is it allowed to be?', why: 'One accent, or none. Two is how a page starts looking generated.', kind: 'text', placeholder: 'Deep green; nothing neon' },
  { key: 'references', title: 'Any references?', why: 'Links, product names, even "the opposite of X" — all useful. One per line.', kind: 'long', placeholder: 'https://…\nLinear\'s pricing page\nanything but glassmorphism' },
  { key: 'mustHave', title: 'What must be on the first screen?', why: 'The thing the visitor came for. If it is not there, the design failed.', kind: 'text', placeholder: 'The live price chart and a way to try it' },
  { key: 'avoid', title: 'Anything to avoid?', why: 'Named dislikes are the cheapest design review you will ever get.', kind: 'text', placeholder: 'Purple gradients, stock photos of people laughing' },
]

export function DesignBrief({ onDone }: { onDone?: () => void }) {
  const brief = useDesign((s) => s.brief)
  const setBrief = useDesign((s) => s.setBrief)
  const resetBrief = useDesign((s) => s.resetBrief)
  const [step, setStep] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)

  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)]
  const value = String(brief[q.key] ?? '')
  const complete = briefIsComplete(brief)
  const prompt = useMemo(() => briefAsPrompt(brief), [brief])
  const answered = QUESTIONS.filter((x) => String(brief[x.key] ?? '').trim()).length

  const set = (v: string) => setBrief({ [q.key]: v } as any)

  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch { /* blocked */ }
  }

  return (
    <div className="flex flex-col gap-3 min-h-0" data-design-brief>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Design brief</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{answered}/{QUESTIONS.length} answered</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] text-[11px]"
            style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
            <ChevronDown size={11} /> {showAll ? 'One at a time' : 'See all'}
          </button>
          <button onClick={() => { resetBrief(); setStep(0) }} title="Start over"
            className="p-1.5 rounded-[7px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      {/* progress */}
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
        <div className="h-full" style={{ width: `${(answered / QUESTIONS.length) * 100}%`, background: 'var(--primary)', transition: 'width 160ms ease' }} />
      </div>

      {showAll ? (
        <div className="min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
          {QUESTIONS.map((x) => (
            <Field key={x.key} q={x} value={String(brief[x.key] ?? '')} onChange={(v) => setBrief({ [x.key]: v } as any)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-brief-question={q.key}>
          <div>
            <h4 className="text-[13px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{q.title}</h4>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{q.why}</p>
          </div>
          <Field q={q} value={value} onChange={set} hideLabel />
          <div className="flex items-center gap-1.5">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11.5px] disabled:opacity-40"
              style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
              <ArrowLeft size={11} /> Back
            </button>
            {step < QUESTIONS.length - 1 ? (
              <button onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-medium"
                style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
                Next <ArrowRight size={11} />
              </button>
            ) : (
              <button onClick={onDone} disabled={!complete}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
                <Check size={11} /> Use this brief
              </button>
            )}
            {!complete && step === QUESTIONS.length - 1 && (
              <span className="text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                Answer what it is, who it is for, premium, density, motion and theme.
              </span>
            )}
          </div>
        </div>
      )}

      <details className="text-[11px]">
        <summary className="cursor-pointer" style={{ color: 'var(--ide-faint, var(--text-3))' }}>What the agent is told</summary>
        <pre className="mt-1 p-2 rounded-[8px] overflow-x-auto text-[10.5px] whitespace-pre-wrap" style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>{prompt}</pre>
        <button onClick={copy} className="mt-1 inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--primary)' }}>
          {copied ? <Check size={11} /> : <ClipboardCopy size={11} />} {copied ? 'Copied' : 'Copy the brief block'}
        </button>
      </details>
    </div>
  )
}

function Field({ q, value, onChange, hideLabel }: { q: Question; value: string; onChange: (v: string) => void; hideLabel?: boolean }) {
  if (q.kind === 'choice') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(q.options ?? []).map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className="px-2.5 py-1.5 rounded-[9px] text-[11.5px]"
            style={{
              background: value === o ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--ide-hover, var(--elevated))',
              color: value === o ? 'var(--primary)' : 'var(--ide-dim, var(--text-2))',
              border: `1px solid ${value === o ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'transparent'}`,
            }}>
            {o}
          </button>
        ))}
      </div>
    )
  }
  if (q.kind === 'long') {
    return (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
        placeholder={q.placeholder} className="ide-input w-full resize-y" data-brief-field={q.key} />
    )
  }
  return (
    <div>
      {!hideLabel && <label className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{q.title}</label>}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder}
        className="ide-input w-full" data-brief-field={q.key} />
    </div>
  )
}
