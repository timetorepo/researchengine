/* Original Research Engine equivalent of the public BoardUI Pro questionnaire interaction. No Pro source used. */
import { useState } from 'react'
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Send } from 'lucide-react'
import type { Questionnaire } from '@/types'
export function BoardQuestionnaire({ questionnaire: q, onSubmit }: { questionnaire: Questionnaire; onSubmit: (answers: Record<string, string>) => void }) {
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [other, setOther] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const item = q.items[Math.min(step, Math.max(0, q.items.length - 1))]
  const answer = (id: string) => [...(choices[id] ?? []), ...(other[id]?.trim() ? [other[id].trim()] : [])].join('; ')
  const ready = q.items.length > 0 && q.items.every((it) => answer(it.id).length > 0)
  if (q.cancelled) return <p className="bui-questionnaire text-xs text-[var(--text-2)]" role="status">These questions were cancelled when the run stopped. Start a new turn to continue.</p>
  if (!item) return <p role="status">No questions were supplied.</p>
  return <section className="bui-questionnaire mb-3" aria-label={q.title ?? 'Project questions'}>
    <header className="flex items-center gap-2 mb-2"><ClipboardList size={17} /><h3 className="text-sm font-semibold">{q.title ?? 'A few project questions'}</h3>{q.submitted && <CheckCircle2 size={16} className="text-[var(--success)]" />}</header>
    {q.intro && <p className="text-xs text-[var(--text-2)] mb-4">{q.intro}</p>}
    {q.submitted ? <dl className="space-y-3">{q.items.map((it) => <div key={it.id}><dt className="text-xs text-[var(--text-3)]">{it.question}</dt><dd className="text-sm mt-1">{q.answers?.[it.id] || 'Not answered'}</dd></div>)}</dl> : <>
      <fieldset><legend className="text-sm font-medium mb-3">{item.question}</legend>
        <div className="space-y-2">{item.options?.map((option, index) => {
          const checked = choices[item.id]?.includes(option) ?? false
          return <label key={option} className="bui-answer-row" data-selected={checked}>
            <input className="sr-only" type={item.multiple ? 'checkbox' : 'radio'} name={item.id} checked={checked} value={option} onChange={() => setChoices((current) => ({ ...current, [item.id]: item.multiple ? checked ? (current[item.id] ?? []).filter((v) => v !== option) : [...(current[item.id] ?? []), option] : [option] }))} />
            <span className="bui-answer-marker" aria-hidden="true">{checked ? <Check size={13} /> : index + 1}</span><span>{option}</span>
          </label>
        })}</div>
        {item.allowText && <label className="block text-xs mt-3">{item.options?.length ? 'Other or additional details' : 'Your answer'}<textarea rows={2} value={other[item.id] ?? ''} onChange={(e) => setOther((current) => ({ ...current, [item.id]: e.target.value }))} className="bui-field block w-full mt-2" /></label>}
      </fieldset>
      <nav aria-label="Question steps" className="flex flex-wrap gap-1 my-4">{q.items.map((it, index) => <button type="button" key={it.id} onClick={() => setStep(index)} aria-label={`Question ${index + 1}`} aria-current={step === index ? 'step' : undefined} className="px-3 py-1 rounded-full text-xs border border-[var(--surface-border)]" style={{ background: step === index ? 'var(--elevated)' : undefined }}>{answer(it.id) && <Check size={11} className="inline mr-1" />}Step {index + 1}</button>)}</nav>
      <footer className="flex justify-between gap-2"><button type="button" className="bui-button" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={14} />Previous</button>
        {step < q.items.length - 1 ? <button type="button" className="bui-button" disabled={!answer(item.id)} onClick={() => setStep((s) => s + 1)}>Next<ChevronRight size={14} /></button> : <button type="button" className="bui-button bui-button-primary" disabled={!ready || submitting} onClick={() => { if (!ready || submitting) return; setSubmitting(true); onSubmit(Object.fromEntries(q.items.map((it) => [it.id, answer(it.id)]))) }}><Send size={14} />Send answers</button>}
      </footer>
    </>}
  </section>
}
