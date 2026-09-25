import { Markdown } from '@/components/chat/Markdown'
import { normalizeStepText } from '@/lib/reader/format'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronRight, Flame } from 'lucide-react'
import type { QuizQuestion } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { burstConfetti } from '@/lib/quiz/confetti'

const LETTERS = ['A', 'B', 'C', 'D']
const spring = { type: 'spring', damping: 25, stiffness: 300 } as const

export interface PlayResult {
  answers: Record<string, string>
  correct: Record<string, boolean>
  streakBest: number
  msPerQuestion: Record<string, number>
}

export function QuizPlay({ questions, timed, onQuit, onFinish, onSeeSource }: {
  questions: QuizQuestion[]
  timed: boolean
  onQuit: () => void
  onFinish: (r: PlayResult) => void
  onSeeSource?: (needle: string) => void
}) {
  const autoAdvance = useStore((s) => s.settings.quizAutoAdvance)
  // Tell the shell what this is, so a running focus timer can say "Quiz"
  // instead of a bare clock.
  useEffect(() => {
    useUI.getState().setActivity({ kind: 'quiz', label: 'Quiz' })
    return () => { if (useUI.getState().activity.kind === 'quiz') useUI.getState().setActivity({ kind: 'idle' }) }
  }, [])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [correct, setCorrect] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<string | null>(null) // chosen option pre-reveal (mc/tf)
  const [revealed, setRevealed] = useState(false)
  const [showExpl, setShowExpl] = useState(false)
  const [streak, setStreak] = useState(0)
  const [streakBest, setStreakBest] = useState(0)
  const [thump, setThump] = useState(false)
  const [typed, setTyped] = useState('')
  const [dir, setDir] = useState(1)
  const [order, setOrder] = useState<string[]>([])
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [selLeft, setSelLeft] = useState<string | null>(null)
  const startedAt = useRef(Date.now())
  const msPer = useRef<Record<string, number>>({})
  const timeLimit = timed ? 30 : 0
  const [timeLeft, setTimeLeft] = useState(timeLimit)

  const q = questions[idx]

  useEffect(() => {
    startedAt.current = Date.now(); setTimeLeft(timeLimit); setPicked(null); setRevealed(false); setShowExpl(false); setTyped('')
    const cur = questions[idx]
    setOrder(cur?.type === 'ordering' ? [...(cur.options ?? [])] : [])
    setMatches({}); setSelLeft(null)
  }, [idx])

  useEffect(() => {
    if (!timed || revealed) return
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100)
    return () => clearInterval(iv)
  }, [idx, timed, revealed])

  useEffect(() => {
    if (timed && timeLeft === 0 && !revealed) reveal('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const grade = (given: string): boolean => {
    if (q.type === 'ordering') return given === (q.correctOrder ?? []).join(' | ')
    if (q.type === 'matching') return given === (q.pairs ?? []).map((p) => `${p.left}→${p.right}`).join(' | ')
    const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
    const target = norm(q.answer)
    const g = norm(given)
    if (q.type === 'short') {
      const words = target.split(' ').filter((w) => w.length > 3)
      const hit = words.filter((w) => g.includes(w)).length
      return hit >= Math.max(1, Math.ceil(words.length * 0.4))
    }
    return g === target
  }

  const reveal = (given: string, tileEl?: HTMLElement | null) => {
    if (revealed) return
    const ok = grade(given)
    msPer.current[q.id] = Date.now() - startedAt.current
    setAnswers((a) => ({ ...a, [q.id]: given }))
    setCorrect((c) => ({ ...c, [q.id]: ok }))
    setRevealed(true)
    if (ok) {
      const ns = streak + 1
      setStreak(ns)
      setStreakBest((b) => Math.max(b, ns))
      if (ns % 5 === 0) { setThump(true); setTimeout(() => setThump(false), 600) }
      const r = tileEl?.getBoundingClientRect()
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2
      const y = r ? r.top + r.height / 2 : window.innerHeight / 2
      burstConfetti(x, y)
    } else {
      setStreak(0)
    }
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
      onFinish({ answers, correct, streakBest, msPerQuestion: msPer.current })
      return
    }
    setDir(1)
    setIdx((i) => i + 1)
  }

  // Space/Enter advances after reveal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!revealed) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, idx, answers, correct])

  useEffect(() => {
    if (revealed && autoAdvance) { const t = setTimeout(next, 1400); return () => clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const options = useMemo(() => q.options ?? (q.type === 'tf' ? ['True', 'False'] : []), [q])
  const timePct = timeLimit ? timeLeft / timeLimit : 1

  const variants = {
    enter: (d: number) => ({ x: d * 80, opacity: 0, scale: 0.97 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: -d * 80, opacity: 0, scale: 0.97 }),
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Segmented progress */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <div className="max-w-[760px] mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={onQuit} aria-label="Quit quiz" className="p-1.5 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}><X size={15} /></button>
            <div className="flex-1 flex gap-1">
              {questions.map((qq, i) => (
                <div key={qq.id} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: correct[qq.id] === undefined ? (i === idx ? '45%' : '0%') : '100%',
                      background: correct[qq.id] === undefined ? 'var(--text-3)' : correct[qq.id] ? 'var(--success)' : 'var(--danger)',
                    }} />
                </div>
              ))}
            </div>
            {/* streak pill */}
            <motion.div
              animate={thump ? { scale: [1, 1.35, 0.92, 1.15, 1], rotate: [0, -6, 5, -3, 0] } : { scale: 1 }}
              transition={{ duration: 0.55 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold tabular-nums"
              style={{ background: streak >= 3 ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'var(--surface)', color: streak >= 3 ? 'var(--warning)' : 'var(--text-3)', border: '1px solid var(--surface-border)' }}>
              {streak >= 3 && <Flame size={12} fill="currentColor" />}
              {streak > 0 ? `${streak} streak` : 'Streak'}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 flex items-start justify-center">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={q.id}
            custom={dir}
            variants={variants} initial="enter" animate="center" exit="exit"
            transition={spring}
            className="w-full max-w-[760px] rounded-[24px] p-6 sm:p-8 mt-2 grad-quiz"
            style={{ boxShadow: '0 24px 80px -24px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-3 mb-5">
              {/* question number + timer ring */}
              <span className="relative w-11 h-11 shrink-0">
                <svg viewBox="0 0 44 44" width="44" height="44" className="absolute inset-0">
                  <circle cx="22" cy="22" r="19" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
                  {timed && (
                    <circle cx="22" cy="22" r="19" fill="none"
                      stroke={timePct > 0.3 ? '#fff' : timePct > 0.15 ? 'var(--warning)' : 'var(--danger)'}
                      strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={`${timePct * 119.4} 119.4`} transform="rotate(-90 22 22)"
                      className={timePct <= 0.15 ? 'animate-pulse' : ''} />
                  )}
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-[13px] font-bold">
                  {timed ? Math.ceil(timeLeft) : idx + 1}
                </span>
              </span>
              <div className="flex-1">
                <div className="text-white/70 text-[10.5px] font-semibold uppercase tracking-wider">
                  Question {idx + 1} of {questions.length} · {q.type === 'mc' ? 'Multiple choice' : q.type === 'tf' ? 'True or false' : q.type === 'fill' ? 'Fill in the blank' : q.type === 'ordering' ? 'Reorder' : q.type === 'matching' ? 'Matching' : 'Short answer'}
                </div>
              </div>
            </div>

            <h2 className="text-white text-[19px] sm:text-[22px] font-semibold leading-snug mb-6" style={{ letterSpacing: '-0.01em' }}>
              {q.prompt}
            </h2>

            {/* Answer area */}
            {(q.type === 'mc' || q.type === 'tf') ? (
              <div className={`grid gap-2.5 ${q.type === 'tf' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {options.map((opt, i) => {
                  const isPicked = picked === opt
                  const isAnswer = opt === q.answer
                  const state = !revealed ? 'idle' : isAnswer ? 'correct' : isPicked ? 'wrong' : 'dim'
                  return (
                    <motion.button
                      key={opt}
                      whileHover={!revealed ? { scale: 1.04, y: -2 } : undefined}
                      whileTap={!revealed ? { scale: 0.98 } : undefined}
                      onClick={(e) => { if (revealed) return; setPicked(opt); reveal(opt, e.currentTarget) }}
                      animate={
                        state === 'wrong' ? { x: [0, -4, 4, -4, 4, -4, 0] } :
                        state === 'correct' && revealed ? { scale: [1, 1.03, 1] } : {}
                      }
                      transition={state === 'wrong' ? { duration: 0.4 } : { duration: 0.5 }}
                      className="relative overflow-hidden text-left px-4 py-3.5 rounded-[16px] min-h-[64px] flex items-center gap-3"
                      style={{
                        background:
                          state === 'correct' ? 'rgba(52,211,153,0.9)' :
                          state === 'wrong' ? 'rgba(248,113,113,0.85)' :
                          `linear-gradient(135deg, rgba(255,255,255,${0.14 + (i % 2) * 0.05}), rgba(255,255,255,${0.05 + (i % 2) * 0.04}))`,
                        border: '1px solid rgba(255,255,255,0.22)',
                        opacity: state === 'dim' ? 0.5 : 1,
                      }}
                    >
                      {state === 'correct' && (
                        <motion.span className="absolute inset-0" style={{ background: 'rgba(52,211,153,0.95)' }}
                          initial={{ x: '-100%' }} animate={{ x: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} />
                      )}
                      <span className="relative w-7 h-7 rounded-[9px] flex items-center justify-center text-[12px] font-bold shrink-0"
                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        {q.type === 'tf' ? (i === 0 ? 'T' : 'F') : LETTERS[i]}
                      </span>
                      <span className="relative text-white text-[14px] font-medium leading-snug">{opt}</span>
                    </motion.button>
                  )
                })}
              </div>
            ) : q.type === 'ordering' ? (
              <div className="space-y-2">
                {order.map((o, i) => {
                  const correctPos = (q.correctOrder ?? []).indexOf(o)
                  const good = revealed && correctPos === i
                  const bad = revealed && correctPos !== i
                  return (
                    <motion.div key={o} layout transition={spring}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-[14px]"
                      style={{
                        background: good ? 'rgba(52,211,153,0.9)' : bad ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.13)',
                        border: '1px solid rgba(255,255,255,0.22)',
                      }}>
                      <span className="w-6 h-6 rounded-[8px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{i + 1}</span>
                      <span className="flex-1 text-[12.5px] text-white leading-snug">{o}</span>
                      {!revealed && (
                        <span className="flex flex-col">
                          <button aria-label="Move up" disabled={i === 0} onClick={() => setOrder((ord) => { const n = [...ord]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}
                            className="text-white/70 disabled:opacity-25 leading-none text-[13px] px-1">▲</button>
                          <button aria-label="Move down" disabled={i === order.length - 1} onClick={() => setOrder((ord) => { const n = [...ord]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })}
                            className="text-white/70 disabled:opacity-25 leading-none text-[13px] px-1">▼</button>
                        </span>
                      )}
                    </motion.div>
                  )
                })}
                {!revealed && (
                  <button onClick={() => reveal(order.join(' | '))}
                    className="w-full py-2.5 rounded-[14px] text-[13px] font-semibold text-white"
                    style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.25)' }}>
                    Check order
                  </button>
                )}
              </div>
            ) : q.type === 'matching' ? (
              <MatchingBoard q={q} revealed={revealed} matches={matches} selLeft={selLeft}
                onPickLeft={(l) => !revealed && setSelLeft(selLeft === l ? null : l)}
                onPickRight={(r) => { if (revealed || !selLeft) return; setMatches((m) => ({ ...m, [selLeft]: r })); setSelLeft(null) }}
                onCheck={() => reveal((q.pairs ?? []).map((p) => `${p.left}→${matches[p.left] ?? ''}`).join(' | '))}
                canCheck={Object.keys(matches).length === (q.pairs ?? []).length}
              />
            ) : (
              <div className="flex gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) reveal(typed) }}
                  disabled={revealed}
                  placeholder={q.type === 'fill' ? 'Type the missing word…' : 'Your answer…'}
                  className="flex-1 px-4 py-3 rounded-[14px] text-[14px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                />
                <button onClick={() => typed.trim() && reveal(typed)} disabled={revealed || !typed.trim()}
                  className="px-5 rounded-[14px] text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  Check
                </button>
              </div>
            )}

            {/* Feedback + explanation */}
            <AnimatePresence>
              {revealed && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="mt-5 rounded-[14px] px-4 py-3.5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <div className="flex items-center gap-2 text-white text-[13px] font-semibold">
                      {correct[q.id] ? 'Correct.' : 'Not quite.'}
                      <button onClick={() => setShowExpl((s) => !s)} className="ml-auto text-[11.5px] font-normal underline underline-offset-2 text-white/70">
                        {showExpl ? 'Hide explanation' : 'Why?'}
                      </button>
                    </div>
                    {!correct[q.id] && (
                      <div className="text-white/85 text-[12.5px] mt-1.5">Accepted answer: <b>{q.answer}</b></div>
                    )}
                    <AnimatePresence>
                      {showExpl && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white/80 text-[12.5px] leading-relaxed mt-2">
                          <Markdown content={normalizeStepText(q.explanation)} />
                          {onSeeSource && (q as any).source && (
                            <button onClick={() => onSeeSource((q as any).source)} className="block mt-2 text-[11.5px] underline underline-offset-2 text-white/90">
                              See this in the source →
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next */}
      <div className="shrink-0 flex justify-end px-6 pb-5">
        <AnimatePresence>
          {revealed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={next}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              {idx + 1 >= questions.length ? 'See results' : 'Next'} <ChevronRight size={14} />
              <kbd className="text-[9.5px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.2)' }}>Space</kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- Matching board: click a term, then click its statement ---------- */
function MatchingBoard({ q, revealed, matches, selLeft, onPickLeft, onPickRight, onCheck, canCheck }: {
  q: QuizQuestion
  revealed: boolean
  matches: Record<string, string>
  selLeft: string | null
  onPickLeft: (l: string) => void
  onPickRight: (r: string) => void
  onCheck: () => void
  canCheck: boolean
}) {
  const pairs = q.pairs ?? []
  const rights = useMemo(() => pairs.map((p) => p.right).sort(() => Math.random() - 0.5), [q.id])
  const chosenRight = new Set(Object.values(matches))
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map((p) => {
            const chosen = matches[p.left]
            const good = revealed && chosen === p.right
            const bad = revealed && chosen && chosen !== p.right
            return (
              <button key={p.left} onClick={() => onPickLeft(p.left)}
                className="w-full px-3 py-2.5 rounded-[14px] text-[12.5px] font-medium text-left transition-all"
                style={{
                  background: good ? 'rgba(52,211,153,0.9)' : bad ? 'rgba(248,113,113,0.85)' : selLeft === p.left ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)',
                  border: `1.5px solid ${selLeft === p.left ? '#fff' : 'rgba(255,255,255,0.22)'}`,
                  color: '#fff',
                }}>
                {p.left}
                {chosen && <span className="block text-[10.5px] opacity-80 mt-0.5">→ {chosen.slice(0, 28)}{chosen.length > 28 ? '…' : ''}</span>}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r) => {
            const taken = chosenRight.has(r)
            const owner = pairs.find((p) => matches[p.left] === r)?.left
            const good = revealed && owner && pairs.find((p) => p.left === owner)?.right === r
            const bad = revealed && owner && pairs.find((p) => p.left === owner)?.right !== r
            return (
              <button key={r} onClick={() => onPickRight(r)} disabled={revealed}
                className="w-full px-3 py-2.5 rounded-[14px] text-[11.5px] text-left leading-snug transition-all"
                style={{
                  background: good ? 'rgba(52,211,153,0.9)' : bad ? 'rgba(248,113,113,0.85)' : taken ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: taken && !revealed ? 'rgba(255,255,255,0.45)' : '#fff',
                }}>
                {r}
              </button>
            )
          })}
        </div>
      </div>
      {!revealed && (
        <button onClick={onCheck} disabled={!canCheck}
          className="w-full mt-3 py-2.5 rounded-[14px] text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.25)' }}>
          Check matches
        </button>
      )}
    </div>
  )
}
