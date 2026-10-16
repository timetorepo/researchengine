/**
 * Exam mode.
 *
 * ExamTab (Learn → Exam) picks a country and asks the user to accept the
 * rules. ExamGate is a full-screen overlay that appears while an exam runs. It
 * sits above the whole app, swallows keyboard shortcuts for the rest of the
 * app, and only closes once the exam is finished.
 *
 * This is a web-app lock. It cannot block other programs on the computer.
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Check, GraduationCap, ShieldAlert, Timer, X } from 'lucide-react'
import { EXAM_COUNTRIES, countryById } from '@/lib/exam/bank'
import { useExam } from '@/stores/useExam'
import { Switch } from '@/components/ui/heroui/Switch'
import { Button } from '@/components/ui/heroui/Button'

export function ExamTab() {
  const active = useExam((s) => s.active)
  const [countryId, setCountryId] = useState(EXAM_COUNTRIES[0].id)
  const [accepted, setAccepted] = useState(false)
  const country = countryById(countryId)!

  if (active) {
    return (
      <div className="max-w-[560px]">
        <h2 className="text-[16px] font-semibold mb-2">An exam is running</h2>
        <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>
          ResearchEngine is locked until you finish the exam. Finish it to unlock the app.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[560px]">
      <h2 className="text-[16px] font-semibold mb-1 flex items-center gap-2"><GraduationCap size={16} /> Exam mode</h2>
      <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-2)' }}>
        A practice test: basic civics questions for the country you choose. While it runs, ResearchEngine is
        locked so you cannot look things up. It only locks this app. Other programs and browser tabs stay open.
      </p>

      <div className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>Country</div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {EXAM_COUNTRIES.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === countryId} onClick={() => setCountryId(c.id)}
            className="rounded-full px-3 py-1.5 text-[12px]"
            style={{
              background: c.id === countryId ? 'var(--primary)' : 'var(--elevated)',
              color: c.id === countryId ? '#fff' : 'var(--text-2)',
              border: '1px solid var(--surface-border)',
            }}>
            <span aria-hidden>{c.flag}</span> {c.name}
          </button>
        ))}
      </div>

      <div className="surface p-4 mb-4">
        <Switch
          checked={accepted}
          onChange={setAccepted}
          label="I accept the exam rules"
          description={`${country.questions.length} questions on ${country.name}. Answers are not saved anywhere outside this device. The lock ends when you finish.`}
        />
      </div>

      <Button size="sm" disabled={!accepted} onClick={() => useExam.getState().start(country.id, country.questions.length)}>
        Start the {country.name} exam <ArrowRight size={13} className="inline" />
      </Button>
    </div>
  )
}

/** The lock. Mount it once, near the root of the app. */
export function ExamGate() {
  const active = useExam((s) => s.active)
  const finished = useExam((s) => s.finished)

  // Keys belong to the exam while it runs. Everything else is swallowed before
  // it reaches the app's own shortcuts. Keys typed into the exam still work.
  useEffect(() => {
    if (!active || finished) return
    const block = (e: KeyboardEvent) => {
      const inside = (e.target as HTMLElement | null)?.closest?.('[data-exam-gate]')
      if (!inside) e.stopPropagation()
      if (!inside && e.key !== 'Tab') e.preventDefault()
    }
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('keydown', block, true)
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('keydown', block, true)
      window.removeEventListener('beforeunload', warn)
    }
  }, [active, finished])

  if (!active) return null
  return <ExamScreen />
}

function ExamScreen() {
  const countryId = useExam((s) => s.countryId)
  const index = useExam((s) => s.index)
  const answers = useExam((s) => s.answers)
  const finished = useExam((s) => s.finished)
  const score = useExam((s) => s.score)
  const startedAt = useExam((s) => s.startedAt)
  const country = countryById(countryId ?? '')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [finished])

  if (!country) return null
  const questions = country.questions
  const total = answers.length
  const q = questions[index]
  const chosen = answers[index]
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const answeredCount = answers.filter((a) => a >= 0).length

  return (
    <div data-exam-gate role="dialog" aria-modal="true" aria-label={`${country.name} practice exam`}
      className="fixed inset-0 z-[300] overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[620px] px-5 py-10">
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert size={15} style={{ color: 'var(--warning)' }} />
          <span className="text-[12.5px] font-medium">Exam in progress: {country.flag} {country.name}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] tabular-nums" style={{ color: 'var(--text-3)' }}>
            <Timer size={13} /> {clock}
          </span>
        </div>

        {finished ? (
          <div>
            <h1 className="text-[22px] font-semibold mb-2">Result: {score} of {total}</h1>
            <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>
              {score === total ? 'Every answer is right.' : 'Review the notes below, then try again.'}
            </p>
            <div className="grid gap-3 mb-8">
              {questions.map((qq, i) => (
                <div key={i} className="surface p-3">
                  <div className="text-[13px] font-medium">{i + 1}. {qq.q}</div>
                  <div className="text-[12px] mt-1 flex items-center gap-1.5" style={{ color: answers[i] === qq.answer ? 'var(--success)' : 'var(--danger)' }}>
                    {answers[i] === qq.answer ? <Check size={12} /> : <X size={12} />}
                    Your answer: {answers[i] >= 0 ? qq.options[answers[i]] : 'none'} · Correct: {qq.options[qq.answer]}
                  </div>
                  <div className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>{qq.note}</div>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={() => useExam.getState().dismiss()}>Unlock ResearchEngine</Button>
          </div>
        ) : (
          <div>
            <div className="h-1 rounded-full mb-6" style={{ background: 'var(--elevated)' }}>
              <div className="h-1 rounded-full transition-all" style={{ width: `${((index + 1) / total) * 100}%`, background: 'var(--primary)' }} />
            </div>
            <div className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>Question {index + 1} of {total}</div>
            <h1 className="text-[20px] font-semibold mb-5">{q.q}</h1>
            <div className="grid gap-2 mb-8">
              {q.options.map((opt, i) => (
                <button key={i} type="button" onClick={() => useExam.getState().answer(i)}
                  aria-pressed={chosen === i}
                  className="text-left rounded-[12px] px-4 py-3 text-[13.5px]"
                  style={{
                    background: chosen === i ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))' : 'var(--surface)',
                    border: `1px solid ${chosen === i ? 'var(--primary)' : 'var(--surface-border)'}`,
                  }}>
                  <span className="mr-2 text-[12px]" style={{ color: 'var(--text-3)' }}>{String.fromCharCode(65 + i)}</span>{opt}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{answeredCount} of {total} answered</span>
              {index < total - 1 ? (
                <Button size="sm" disabled={chosen < 0} onClick={() => useExam.getState().next()}>
                  Next <ArrowRight size={13} className="inline" />
                </Button>
              ) : (
                <Button size="sm" disabled={chosen < 0 || answeredCount < total}
                  onClick={() => useExam.getState().finish(country.questions.map((x) => x.answer))}>
                  Finish exam
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
