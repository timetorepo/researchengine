import React, { useMemo, useState } from 'react'
import { Play, Loader2, AlertTriangle, Check } from 'lucide-react'
import {
  validateRequest, answerValue, answerDistribution, estimateTokens, JEV_LIMITS,
  type JevQuestion, type JevDecision, type ValidationIssue,
} from '@/lib/providers/jev'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

/**
 * Jev, in Settings.
 *
 * Jev is a decision model, not a chat model, so it does not belong in the model
 * picker and there is nothing here that looks like a chat. You give it a state
 * and typed questions, and it gives back answers with probabilities on them.
 *
 * The point of the panel is the probability. A decision with no number on it is
 * a guess; the number is what lets you set a threshold and abstain, so every
 * answer shows its distribution rather than just the winner, and the panel does
 * not decide for you where the line sits.
 */
export function JevTab() {
  const ui = useUI()
  const providers = useStore((s) => s.settings.providers)
  const key = providers.typesafe?.apiKey ?? ''
  const enabled = providers.typesafe?.enabled ?? false

  const [state, setState] = useState(
    'A customer wrote: "The export button does nothing on the reports page. I have tried twice and I am on the deadline for a board pack."',
  )
  const [model, setModel] = useState('jev-latest')
  const [sentiment, setSentiment] = useState({ options: 'frustrated, neutral, pleased' })
  const [urgency, setUrgency] = useState({ levels: 'low, medium, high' })
  const [needsHuman, setNeedsHuman] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<JevDecision | null>(null)
  const [error, setError] = useState('')

  const questions = useMemo<JevQuestion[]>(() => {
    const out: JevQuestion[] = []
    const opts = sentiment.options.split(',').map((s) => s.trim()).filter(Boolean)
    if (opts.length >= 2) out.push({ type: 'choice', name: 'sentiment', instructions: 'How does the customer sound?', options: opts })
    const levels = urgency.levels.split(',').map((s) => s.trim()).filter(Boolean)
    if (levels.length >= 2) out.push({ type: 'score', name: 'urgency', instructions: 'How urgent is this, low to high?', levels })
    if (needsHuman) out.push({ type: 'noul', name: 'needs_human', instructions: 'Does this need a person rather than an automated reply?' })
    return out
  }, [sentiment, urgency, needsHuman])

  const issues: ValidationIssue[] = useMemo(
    () => validateRequest({ state, model, questions }),
    [state, model, questions],
  )

  const ask = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    const r = await fetch('/api/jev/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, model, questions }),
    }).then((x) => x.json()).catch((e) => ({ error: String(e?.message ?? e) }))
    setBusy(false)
    if (r?.error) { setError(`${r.error}${r.detail ? ` ${r.detail}` : ''}`); return }
    if (!r?.answers) { setError('TypeSafe answered, but not with decisions. Check the key and the model.'); return }
    setResult(r)
    ui.toast('Jev answered', `${r.answers.length} decision${r.answers.length === 1 ? '' : 's'}, ${r.usage?.input_tokens ?? 0} input tokens`, 'success')
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Jev</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--text-2)' }}>
        Jev is TypeSafe AI's System One decision model. It does not write prose: you give it a state and typed
        questions, and it returns answers with calibrated probabilities — a choice from the options you named, a
        score on a ladder you set, or a yes/no. It cannot leave the schema, which removes the malformed answer
        but not the mistaken one, so the probability is there for you to set a threshold on.
      </p>

      {!key && (
        <div className="surface p-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={14} style={{ color: 'var(--warning)' }} className="mt-0.5 shrink-0" />
          <div className="text-[12px] leading-snug" style={{ color: 'var(--text-2)' }}>
            No TypeSafe key yet. Jev is early access — request it at typesafe.ai, then add the key in
            {' '}<b>Providers</b>. Jev is not on the free tier: it bills $0.042 per million input tokens and
            nothing for output, because the output is a typed value rather than text.
          </div>
        </div>
      )}

      <div className="surface p-4 mb-4">
        <label className="block text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>State</label>
        <textarea value={state} onChange={(e) => setState(e.target.value)} rows={4}
          className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none resize-y"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
        <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>
          About {estimateTokens(state).toLocaleString()} tokens. Jev allows {JEV_LIMITS.maxRequestTokens.toLocaleString()} per
          request, with the state plus the longest question capped at {JEV_LIMITS.maxStatePlusQuestionTokens.toLocaleString()}.
          An estimate, not a measurement.
        </div>
      </div>

      <div className="surface p-4 mb-4">
        <div className="text-[13px] font-semibold mb-2">Questions</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11.5px] font-medium mb-1" style={{ color: 'var(--text-2)' }}>
              Choice — options, comma separated
            </label>
            <input value={sentiment.options} onChange={(e) => setSentiment({ options: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Up to 255 options.</div>
          </div>
          <div>
            <label className="block text-[11.5px] font-medium mb-1" style={{ color: 'var(--text-2)' }}>
              Score — levels, low to high
            </label>
            <input value={urgency.levels} onChange={(e) => setUrgency({ levels: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>2 to 10 levels.</div>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: 'var(--text-2)' }}>
          <input type="checkbox" checked={needsHuman} onChange={(e) => setNeedsHuman(e.target.checked)} />
          Also ask a yes/no: does this need a person?
        </label>
      </div>

      {issues.length > 0 && (
        <div className="surface p-3 mb-4 flex flex-col gap-1">
          {issues.map((i) => (
            <div key={`${i.at}-${i.problem}`} className="text-[11.5px] leading-snug flex items-start gap-1.5" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              {i.at >= 0 ? `Question ${i.at + 1}: ` : ''}{i.problem}
            </div>
          ))}
        </div>
      )}

      <button onClick={ask} disabled={busy || !key || issues.length > 0 || questions.length === 0}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium disabled:opacity-40"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        {busy ? <><Loader2 size={13} className="animate-spin" /> Asking Jev…</> : <><Play size={13} /> Ask Jev</>}
      </button>

      {error && (
        <div className="surface p-3 mt-4 text-[12px] leading-snug" style={{ color: 'var(--danger)' }}>{error}</div>
      )}

      {result && (
        <div className="surface p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Check size={13} style={{ color: 'var(--success)' }} />
            <span className="text-[12.5px] font-medium">{result.model}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {result.usage?.input_tokens ?? 0} in · {result.usage?.output_tokens ?? 0} out (free)
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {result.answers.map((a) => {
              const q = questions.find((x) => x.name === a.name)
              const value = q ? answerValue(a, q) : null
              const dist = q ? answerDistribution(a, q) : []
              return (
                <div key={a.name}>
                  <div className="text-[11.5px] font-medium mb-1" style={{ color: 'var(--text-2)' }}>{a.name}</div>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: 'var(--text-1)' }}>
                    {value ?? 'no answer'}
                    {a.type === 'noul' && typeof a.probability === 'number' && (
                      <span className="text-[12px] font-normal ml-2 tabular-nums" style={{ color: 'var(--text-3)' }}>
                        {Math.round(a.probability * 100)}% yes
                      </span>
                    )}
                  </div>
                  {dist.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {dist.map((d) => (
                        <div key={d.label} className="flex items-center gap-2">
                          <span className="text-[11px] w-20 shrink-0 truncate" style={{ color: 'var(--text-3)' }}>{d.label}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                            <div style={{ width: `${Math.round(d.p * 100)}%`, height: '100%', background: 'var(--primary)' }} />
                          </div>
                          <span className="text-[10.5px] tabular-nums w-9 text-right shrink-0" style={{ color: 'var(--text-3)' }}>
                            {Math.round(d.p * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="text-[10.5px] mt-3 leading-snug" style={{ color: 'var(--text-3)' }}>
            Jev also runs through OpenRouter as typesafe/jev-1.13 (the decision model) and typesafe/jev-router
            (a router that picks a model and an effort level for you). Add OpenRouter as a provider to reach either.
          </div>
        </div>
      )}
    </div>
  )
}
