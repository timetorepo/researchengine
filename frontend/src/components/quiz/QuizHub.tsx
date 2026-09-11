import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  UploadCloud, FileText, Trash2, Play, Check, X, ChevronRight, RotateCcw,
  Layers, Timer, BookOpen, Sparkles, GraduationCap,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import type { DocumentRecord, QuizQuestion, QuizRecord } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { extractText } from '@/lib/documents/extract'
import { generateQuiz } from '@/lib/quiz/generate'
import { timeAgo, fmt } from '@/lib/utils'

const TYPES = [
  { id: 'mc', label: 'Multiple choice' },
  { id: 'tf', label: 'True / false' },
  { id: 'short', label: 'Short answer' },
  { id: 'fill', label: 'Fill in blank' },
]

export function QuizHub() {
  const documents = useStore((s) => s.documents)
  const quizzes = useStore((s) => s.quizzes)
  const ui = useUI()
  const [selected, setSelected] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // quiz config
  const [count, setCount] = useState(8)
  const [types, setTypes] = useState<string[]>(['mc', 'tf'])
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [timed, setTimed] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState<QuizRecord | null>(null)
  const [results, setResults] = useState<{ quiz: QuizRecord; answers: Record<string, string> } | null>(null)

  const doc = documents.find((d) => d.id === selected) ?? null

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setExtracting(true)
      try {
        const text = await extractText(file)
        const rec: DocumentRecord = {
          id: nanoid(8), name: file.name, kind: file.name.split('.').pop() ?? 'file',
          text: text.slice(0, 400000), addedAt: Date.now(),
        }
        useStore.setState((s) => ({ documents: [rec, ...s.documents] }))
        setSelected(rec.id)
        ui.toast('Document ready', `${file.name} · ${fmt(Math.round(text.length / 4))} tokens extracted locally.`, 'success')
      } catch (e: any) {
        ui.toast('Could not read file', e?.message ?? 'Unknown error', 'danger')
      } finally {
        setExtracting(false)
      }
    }
  }

  const startQuiz = () => {
    if (!doc) return
    const questions = generateQuiz(doc.text, { count, types: types as any, difficulty })
    if (!questions.length) { ui.toast('Not enough text', 'Add a longer document to generate questions.', 'warning'); return }
    const rec: QuizRecord = { id: nanoid(8), docId: doc.id, title: doc.name, questions, createdAt: Date.now() }
    useStore.setState((s) => ({ quizzes: [rec, ...s.quizzes] }))
    setActiveQuiz(rec)
    setResults(null)
  }

  if (activeQuiz && !results) {
    return <QuizRunner quiz={activeQuiz} timed={timed}
      onFinish={(answers) => setResults({ quiz: activeQuiz, answers })}
      onQuit={() => setActiveQuiz(null)} />
  }

  if (results) {
    return <QuizResults quiz={results.quiz} answers={results.answers}
      onRetry={() => { setActiveQuiz(results.quiz); setResults(null) }}
      onBack={() => setResults(null)} />
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Document library */}
      <aside className="w-[260px] shrink-0 hidden md:flex flex-col p-3 overflow-y-auto" style={{ borderRight: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <GraduationCap size={16} style={{ color: 'var(--primary)' }} />
          <span className="font-semibold text-[14px]">Read &amp; Quiz</span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className="p-4 rounded-[14px] text-center cursor-pointer transition-colors mb-3"
          style={{ border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--surface-border)'}`, background: dragOver ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent' }}
        >
          <UploadCloud size={20} strokeWidth={1.5} className="mx-auto mb-1.5" style={{ color: dragOver ? 'var(--primary)' : 'var(--text-3)' }} />
          <div className="text-[12px] font-medium">{extracting ? 'Extracting…' : 'Drop a document'}</div>
          <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>PDF · DOCX · TXT · Markdown</div>
          <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,.markdown,.epub"
            onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: 'var(--text-3)' }}>Documents · {documents.length}</div>
        {documents.map((d) => (
          <button key={d.id} onClick={() => setSelected(d.id)}
            className="group flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-left mb-0.5 transition-colors"
            style={{ background: selected === d.id ? 'var(--elevated)' : 'transparent' }}>
            <FileText size={14} strokeWidth={1.5} className="shrink-0" style={{ color: selected === d.id ? 'var(--primary)' : 'var(--text-3)' }} />
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] truncate">{d.name}</span>
              <span className="block text-[10px]" style={{ color: 'var(--text-3)' }}>{timeAgo(d.addedAt)}</span>
            </span>
            <Trash2 size={11} className="opacity-0 group-hover:opacity-100 shrink-0" style={{ color: 'var(--text-3)' }}
              onClick={(e) => { e.stopPropagation(); useStore.setState((s) => ({ documents: s.documents.filter((x) => x.id !== d.id) })); if (selected === d.id) setSelected(null) }} />
          </button>
        ))}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!doc ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: 'var(--elevated)' }}>
              <BookOpen size={24} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ letterSpacing: '-0.02em' }}>Study anything</h2>
            <p className="text-[13px] max-w-[380px]" style={{ color: 'var(--text-2)' }}>
              Drop a PDF, DOCX, or notes on the left. Everything is processed locally — then generate quizzes, flashcards, and track progress.
            </p>
            <button onClick={() => fileRef.current?.click()}
              className="mt-2 px-4 py-2 rounded-full text-[13px] font-medium md:hidden" style={{ background: 'var(--primary)', color: '#fff' }}>
              Choose a file
            </button>
            <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,.markdown,.epub"
              onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
        ) : (
          <div className="max-w-[840px] mx-auto p-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
            {/* Reader */}
            <div className="surface p-5 min-h-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} style={{ color: 'var(--primary)' }} />
                <span className="font-medium text-[14px] truncate flex-1">{doc.name}</span>
                <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{fmt(Math.round(doc.text.length / 4))} tokens</span>
              </div>
              <div className="text-[13px] leading-relaxed max-h-[52vh] overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
                {doc.text.slice(0, 20000)}
                {doc.text.length > 20000 && <span style={{ color: 'var(--text-3)' }}> …truncated in preview.</span>}
              </div>
            </div>

            {/* Config */}
            <div className="space-y-4">
              <div className="surface p-4">
                <div className="text-[13px] font-semibold mb-3 flex items-center gap-1.5"><Sparkles size={14} style={{ color: 'var(--secondary)' }} /> Quiz generator</div>
                <label className="block mb-3">
                  <span className="text-[11.5px] mb-1 block" style={{ color: 'var(--text-2)' }}>Questions · {count}</span>
                  <input type="range" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[var(--secondary)]" />
                </label>
                <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Types</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TYPES.map((t) => {
                    const on = types.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => setTypes((prev) => on ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                        className="px-2.5 py-1 rounded-full text-[11px]"
                        style={{ background: on ? 'var(--secondary)' : 'var(--elevated)', color: on ? '#fff' : 'var(--text-2)' }}>
                        {t.label}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>Difficulty</div>
                <div className="flex gap-1.5 mb-3">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className="flex-1 py-1 rounded-[10px] text-[11px] capitalize"
                      style={{ background: difficulty === d ? 'var(--secondary)' : 'var(--elevated)', color: difficulty === d ? '#fff' : 'var(--text-2)' }}>
                      {d}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[12px] mb-3 cursor-pointer" style={{ color: 'var(--text-2)' }}>
                  <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="accent-[var(--secondary)]" />
                  Per-question timer
                </label>
                <button onClick={startQuiz} disabled={types.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[12px] text-[13px] font-medium disabled:opacity-40"
                  style={{ background: 'var(--secondary)', color: '#fff' }}>
                  <Play size={14} /> Generate &amp; start
                </button>
              </div>

              {/* History */}
              <div className="surface p-4">
                <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5"><Timer size={13} style={{ color: 'var(--text-3)' }} /> History</div>
                {quizzes.filter((q) => q.docId === doc.id).length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>No attempts yet.</div>}
                {quizzes.filter((q) => q.docId === doc.id).slice(0, 5).map((q) => (
                  <div key={q.id} className="flex items-center justify-between py-1.5 text-[11.5px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <span style={{ color: 'var(--text-2)' }}>{q.questions.length} Qs · {timeAgo(q.createdAt)}</span>
                    {q.bestScore != null && <span style={{ color: q.bestScore >= 70 ? 'var(--success)' : 'var(--warning)' }}>{q.bestScore}%</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Runner ---------- */
function QuizRunner({ quiz, timed, onFinish, onQuit }: {
  quiz: QuizRecord; timed: boolean; onFinish: (answers: Record<string, string>) => void; onQuit: () => void
}) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const q = quiz.questions[i]

  React.useEffect(() => {
    if (!timed || feedback) return
    setTimeLeft(30)
    const iv = setInterval(() => setTimeLeft((t) => {
      if (t <= 1) { clearInterval(iv); submit('') ; return 0 }
      return t - 1
    }), 1000)
    return () => clearInterval(iv)
  }, [i, timed])

  const submit = (val: string) => {
    if (feedback) return
    const correct = val.trim().toLowerCase() === q.answer.trim().toLowerCase()
    setPicked(val)
    setFeedback(correct ? 'correct' : 'wrong')
    setAnswers((a) => ({ ...a, [q.id]: val }))
    setTimeout(() => {
      setFeedback(null); setPicked(null)
      if (i + 1 >= quiz.questions.length) onFinish(answers)
      else setI(i + 1)
    }, 1400)
  }

  return (
    <div className="h-full flex items-center justify-center p-5 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="aurora" />
      <button onClick={onQuit} className="absolute top-4 left-4 text-[12px] flex items-center gap-1 z-10" style={{ color: 'var(--text-3)' }}>
        <X size={13} /> Quit
      </button>
      <div className="absolute top-4 right-4 text-[12px] z-10" style={{ color: 'var(--text-3)' }}>
        {i + 1} / {quiz.questions.length}
        {timed && <span className="ml-2 font-mono" style={{ color: timeLeft < 8 ? 'var(--danger)' : 'var(--text-2)' }}>{timeLeft}s</span>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id}
          initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-[620px] relative z-10">
          <div className="mb-4 h-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${((i) / quiz.questions.length) * 100}%`, background: 'var(--secondary)' }} />
          </div>
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--secondary)' }}>
            {q.type === 'mc' ? 'Multiple choice' : q.type === 'tf' ? 'True or false' : q.type === 'fill' ? 'Fill in the blank' : 'Short answer'}
            {q.section && <span className="ml-2" style={{ color: 'var(--text-3)' }}>· {q.section}</span>}
          </div>
          <h2 className="text-[17px] font-medium mb-5 leading-relaxed" style={{ letterSpacing: '-0.01em' }}>{q.prompt}</h2>

          {(q.type === 'mc' || q.type === 'tf') ? (
            <div className="space-y-2">
              {(q.type === 'tf' ? ['True', 'False'] : q.options ?? []).map((opt) => {
                const isPicked = picked === opt
                const isAnswer = opt === q.answer
                let bg = 'var(--surface)'
                if (feedback && isAnswer) bg = 'color-mix(in srgb, var(--success) 18%, var(--surface))'
                else if (feedback && isPicked && !isAnswer) bg = 'color-mix(in srgb, var(--danger) 16%, var(--surface))'
                return (
                  <button key={opt} onClick={() => submit(opt)} disabled={!!feedback}
                    className={`w-full text-left px-4 py-3 rounded-[14px] text-[13.5px] transition-transform ${feedback && isPicked && !isAnswer ? 'shake-x' : ''} ${feedback && isAnswer ? 'fill-correct' : ''}`}
                    style={{ background: bg, border: '1px solid var(--surface-border)', transform: isPicked && !feedback ? 'scale(1.02)' : undefined }}>
                    {opt}
                  </button>
                )
              })}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('ans') as HTMLInputElement).value; submit(v) }} className="space-y-3">
              <input name="ans" autoFocus placeholder="Your answer…"
                className="w-full px-4 py-3 rounded-[14px] outline-none text-[14px]"
                style={{ background: 'var(--surface)', border: `1px solid ${feedback ? (feedback === 'correct' ? 'var(--success)' : 'var(--danger)') : 'var(--surface-border)'}` }} />
              <button type="submit" disabled={!!feedback} className="px-5 py-2 rounded-full text-[13px] font-medium" style={{ background: 'var(--secondary)', color: '#fff' }}>
                Check
              </button>
            </form>
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 p-3.5 rounded-[14px] text-[12.5px]"
                style={{
                  background: feedback === 'correct' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  color: 'var(--text-2)', border: `1px solid ${feedback === 'correct' ? 'var(--success)' : 'var(--danger)'}33`,
                }}>
                <div className="font-medium mb-0.5 flex items-center gap-1.5" style={{ color: feedback === 'correct' ? 'var(--success)' : 'var(--danger)' }}>
                  {feedback === 'correct' ? <Check size={14} /> : <X size={14} />}
                  {feedback === 'correct' ? 'Correct' : `Answer: ${q.answer}`}
                </div>
                {q.explanation}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------- Results ---------- */
function QuizResults({ quiz, answers, onRetry, onBack }: {
  quiz: QuizRecord; answers: Record<string, string>; onRetry: () => void; onBack: () => void
}) {
  const ui = useUI()
  const [showMistakes, setShowMistakes] = useState(false)
  const correct = quiz.questions.filter((q) => (answers[q.id] ?? '').trim().toLowerCase() === q.answer.trim().toLowerCase())
  const score = Math.round((correct.length / quiz.questions.length) * 100)

  React.useEffect(() => {
    useStore.setState((s) => ({
      quizzes: s.quizzes.map((q) => q.id === quiz.id ? { ...q, bestScore: Math.max(q.bestScore ?? 0, score) } : q),
    }))
  }, [quiz.id, score])

  const bySection = useMemo(() => {
    const m = new Map<string, { total: number; right: number }>()
    for (const q of quiz.questions) {
      const sec = q.section ?? 'General'
      const cur = m.get(sec) ?? { total: 0, right: 0 }
      cur.total++
      if ((answers[q.id] ?? '').trim().toLowerCase() === q.answer.trim().toLowerCase()) cur.right++
      m.set(sec, cur)
    }
    return [...m.entries()]
  }, [quiz, answers])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-[640px] mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8 pt-6">
          <div className="text-[64px] font-bold leading-none" style={{ letterSpacing: '-0.03em', color: score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
            {score}%
          </div>
          <div className="text-[14px] mt-2" style={{ color: 'var(--text-2)' }}>
            {correct.length} of {quiz.questions.length} correct · {quiz.title}
          </div>
        </motion.div>

        <div className="surface p-4 mb-4">
          <div className="text-[12px] font-semibold mb-3">Topic accuracy</div>
          {bySection.map(([sec, v]) => (
            <div key={sec} className="mb-2.5">
              <div className="flex justify-between text-[11.5px] mb-1"><span style={{ color: 'var(--text-2)' }}>{sec}</span><span style={{ color: 'var(--text-3)' }}>{v.right}/{v.total}</span></div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(v.right / v.total) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }} style={{ background: v.right / v.total >= 0.7 ? 'var(--success)' : 'var(--warning)' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={onRetry} className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium" style={{ background: 'var(--secondary)', color: '#fff' }}>
            <RotateCcw size={13} /> Retake
          </button>
          <button onClick={() => setShowMistakes(!showMistakes)} className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Layers size={13} /> Review mistakes ({quiz.questions.length - correct.length})
          </button>
          <button onClick={() => { ui.set({ focus: { running: true, endsAt: Date.now() + 25 * 60 * 1000, remaining: 25 * 60, total: 25 * 60, mode: 'work' } }); ui.toast('Focus session started', '25 minutes — perfect for reviewing your mistakes.') }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Timer size={13} /> Study session
          </button>
          <button onClick={onBack} className="px-4 py-2 rounded-full text-[13px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Done</button>
        </div>

        <AnimatePresence>
          {showMistakes && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {quiz.questions.filter((q) => (answers[q.id] ?? '').trim().toLowerCase() !== q.answer.trim().toLowerCase()).map((q) => (
                <div key={q.id} className="surface p-4 mb-2">
                  <div className="text-[13px] font-medium mb-1">{q.prompt}</div>
                  <div className="text-[12px]" style={{ color: 'var(--danger)' }}>You: {answers[q.id] || '(no answer)'}</div>
                  <div className="text-[12px]" style={{ color: 'var(--success)' }}>Correct: {q.answer}</div>
                  <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-3)' }}>{q.explanation}</div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
