import { Markdown } from '@/components/chat/Markdown'
import { normalizeStepText } from '@/lib/reader/format'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, ChevronRight, Flame, Check, Sparkles, Timer as TimerIcon, BookOpen } from 'lucide-react'
import type { QuizQuestion } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { burstConfetti } from '@/lib/quiz/confetti'
// shadcn-space @shadcn-space/badge-13 — the streak display. The quiz's own
// thump (a spring on the wrapper) is kept; the number itself rolls over with
// NumberFlow instead of swapping digits.
import { StreakBadge } from '@/components/shadcn-space/badge/badge-13'

const LETTERS = ['A', 'B', 'C', 'D']
const spring = { type: 'spring', damping: 25, stiffness: 300 } as const

export interface PlayResult {
  answers: Record<string, string>
  correct: Record<string, boolean>
  streakBest: number
  msPerQuestion: Record<string, number>
}

export function QuizPlay({ questions, timed, onQuit, onFinish, onSeeSource, title, source }: {
  questions: QuizQuestion[]
  timed: boolean
  onQuit: () => void
  onFinish: (r: PlayResult) => void
  onSeeSource?: (needle: string) => void
  /** The quiz's own name, shown at the top of the card. */
  title?: string
  /** Where the questions came from — rendered as a pill beside the title. */
  source?: string
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

  // Keyboard, the way a quiz should behave: 1-6 answers, Space/Enter advances.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      if (revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next() }
        return
      }
      const n = Number(e.key)
      const opts = q.options ?? (q.type === 'tf' ? ['True', 'False'] : [])
      if (Number.isInteger(n) && n >= 1 && n <= opts.length && (q.type === 'mc' || q.type === 'tf')) {
        e.preventDefault()
        setPicked(opts[n - 1])
        reveal(opts[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, idx, answers, correct, q])

  useEffect(() => {
    if (revealed && autoAdvance) { const t = setTimeout(next, 1400); return () => clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const options = useMemo(() => q.options ?? (q.type === 'tf' ? ['True', 'False'] : []), [q])
  const timePct = timeLimit ? timeLeft / timeLimit : 1

  // Arriving questions are dealt in (rise + a touch of yaw), leaving ones slide
  // away — cheap on the compositor and unmistakably a *movement*.
  const variants = {
    enter: (d: number) => ({ x: d * 70, opacity: 0, scale: 0.97, rotateY: d * -6, filter: 'blur(6px)' }),
    center: { x: 0, opacity: 1, scale: 1, rotateY: 0, filter: 'blur(0px)' },
    exit: (d: number) => ({ x: -d * 70, opacity: 0, scale: 0.97, rotateY: d * 6, filter: 'blur(6px)' }),
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Progress capsules + streak */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={onQuit} aria-label="Quit quiz" className="p-1.5 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}><X size={15} /></button>
            <div className="flex-1 flex gap-1">
              {questions.map((qq, i) => {
                const answered = correct[qq.id] !== undefined
                const current = i === idx && !answered
                return (
                  <div key={qq.id} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                    {/* Width springs; the colour is a CSS transition between
                        theme tokens (framer cannot interpolate var()) — so an
                        answered pill settles into green or red on its own. */}
                    <motion.div className={`re-quiz-capsule h-full rounded-full ${current ? 're-quiz-capsule-current' : ''}`}
                      data-fill={answered ? (correct[qq.id] ? 'ok' : 'bad') : current ? 'current' : 'idle'}
                      initial={false}
                      animate={{ width: answered ? '100%' : current ? '45%' : '0%' }}
                      transition={{ type: 'spring', damping: 24, stiffness: 260 }} />
                  </div>
                )
              })}
            </div>
            {/* Countdown — a ring you can read at a glance, with the type of
                quiz beside it so the card says what it is asking of you. */}
            {timed && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="relative w-8 h-8 shrink-0 grid place-items-center"
                title="Time left on this question"
              >
                <svg viewBox="0 0 36 36" width="32" height="32" className="absolute inset-0">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--elevated)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none"
                    stroke={timePct > 0.3 ? 'var(--primary)' : timePct > 0.15 ? 'var(--warning)' : 'var(--danger)'}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, timePct) * 97.4} 97.4`} transform="rotate(-90 18 18)"
                    className={timePct <= 0.15 ? 'animate-pulse' : ''} data-static-icon />
                </svg>
                <span className="text-[10.5px] font-bold tabular-nums">{Math.ceil(timeLeft)}</span>
              </motion.span>
            )}
            {/* streak — badge-13 once there is something to count */}
            <motion.div
              animate={thump ? { scale: [1, 1.35, 0.92, 1.15, 1], rotate: [0, -6, 5, -3, 0] } : { scale: 1 }}
              transition={{ duration: 0.55 }}
              title={streak > 0 ? `${streak} correct in a row` : 'Answer a few in a row to start a streak'}>
              {streak > 0 ? (
                <StreakBadge value={streak} label="streak" />
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                  style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--surface-border)' }}>
                  Streak
                </span>
              )}
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
            className="re-quiz-card w-full max-w-[720px] p-6 sm:p-7 mt-2"
            style={{ transformPerspective: 1200 }}
          >
            {/* Card header, as in the reference: centred source pills, a big
                centred title, then a hairline rule. */}
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                {source && (
                  <span className="re-quiz-badge" style={{ background: 'color-mix(in srgb, var(--primary) 18%, transparent)', color: 'var(--primary)' }}>
                    <BookOpen size={12} strokeWidth={2} /> {source}
                  </span>
                )}
                <span className="re-quiz-badge" style={{ background: 'color-mix(in srgb, var(--secondary) 18%, transparent)', color: 'var(--secondary)' }}>
                  <Sparkles size={12} strokeWidth={2} /> {questions.length} question{questions.length === 1 ? '' : 's'}
                </span>
                {timed && (
                  <span className="re-quiz-badge tabular-nums" style={{ background: 'color-mix(in srgb, var(--warning) 18%, transparent)', color: 'var(--warning)' }}>
                    <TimerIcon size={12} strokeWidth={2} /> Timed
                  </span>
                )}
              </div>
              <h1 className="text-[24px] sm:text-[27px] font-semibold leading-tight" style={{ letterSpacing: '-0.025em' }}>
                {title?.trim() || 'Quiz'}
              </h1>
              <hr className="re-quiz-rule w-full mt-5" />
            </motion.div>

            {/* Question */}
            <motion.h2
              key={`prompt-${q.id}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-[17px] sm:text-[19px] font-semibold leading-snug mt-5 mb-1.5"
              style={{ letterSpacing: '-0.01em' }}
            >
              {q.prompt}
            </motion.h2>
            <motion.p
              key={`hint-${q.id}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-[12.5px] mb-4"
              style={{ color: 'var(--text-3)' }}
            >
              {q.type === 'mc' ? 'Choose only 1 answer:' : q.type === 'tf' ? 'True or false:' : q.type === 'fill' ? 'Fill in the blank:' : q.type === 'ordering' ? 'Put these in the right order:' : q.type === 'matching' ? 'Match each term to its statement:' : 'Type your answer:'}
            </motion.p>

            {/* Answer area */}
            {(q.type === 'mc' || q.type === 'tf') ? (
              <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answers">
                {options.map((opt, i) => {
                  const isPicked = picked === opt
                  const isAnswer = opt === q.answer
                  const state = !revealed ? (isPicked ? 'picked' : 'idle') : isAnswer ? 'correct' : isPicked ? 'wrong' : 'dim'
                  return (
                    <QuizOption
                      key={opt}
                      index={i}
                      label={opt}
                      letter={q.type === 'tf' ? (i === 0 ? 'T' : 'F') : LETTERS[i]}
                      state={state}
                      locked={revealed}
                      revealDelay={i * 0.05}
                      onPick={(el) => { setPicked(opt); reveal(opt, el) }}
                    />
                  )
                })}
              </div>
            ) : q.type === 'ordering' ? (
              <div className="flex flex-col gap-2.5">
                {order.map((o, i) => {
                  const correctPos = (q.correctOrder ?? []).indexOf(o)
                  const good = revealed && correctPos === i
                  const bad = revealed && correctPos !== i
                  return (
                    <motion.div key={o} layout transition={spring}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-[16px]"
                      data-state={good ? 'correct' : bad ? 'wrong' : 'idle'}
                      style={{
                        background: good ? 'color-mix(in srgb, var(--success) 16%, var(--elevated))'
                          : bad ? 'color-mix(in srgb, var(--danger) 14%, var(--elevated))'
                          : 'var(--elevated)',
                        border: `2px solid ${good ? 'var(--success)' : bad ? 'var(--danger)' : 'transparent'}`,
                      }}>
                      <span className="w-6 h-6 rounded-[8px] grid place-items-center text-[11.5px] font-bold shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--primary) 18%, transparent)', color: 'var(--primary)' }}>{i + 1}</span>
                      <span className="flex-1 text-[13.5px] leading-snug">{o}</span>
                      {!revealed && (
                        <span className="flex flex-col gap-0.5">
                          <button aria-label="Move up" disabled={i === 0}
                            onClick={() => setOrder((ord) => { const n = [...ord]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}
                            className="w-6 h-5 rounded-[6px] grid place-items-center disabled:opacity-25 hover:bg-[var(--surface)]"
                            style={{ color: 'var(--text-2)' }}>▲</button>
                          <button aria-label="Move down" disabled={i === order.length - 1}
                            onClick={() => setOrder((ord) => { const n = [...ord]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })}
                            className="w-6 h-5 rounded-[6px] grid place-items-center disabled:opacity-25 hover:bg-[var(--surface)]"
                            style={{ color: 'var(--text-2)' }}>▼</button>
                        </span>
                      )}
                    </motion.div>
                  )
                })}
                {!revealed && (
                  <button onClick={() => reveal(order.join(' | '))}
                    className="w-full py-3 rounded-[16px] text-[13.5px] font-semibold"
                    style={{ background: 'var(--primary)', color: '#fff' }}>
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
                  className="flex-1 px-4 py-3 rounded-[16px] text-[14px] outline-none transition-shadow focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                  style={{ background: 'var(--elevated)', color: 'var(--text)', border: '2px solid transparent' }}
                />
                <button onClick={() => typed.trim() && reveal(typed)} disabled={revealed || !typed.trim()}
                  className="px-5 rounded-[16px] text-[13.5px] font-semibold disabled:opacity-40"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  Check
                </button>
              </div>
            )}

            {/* Feedback + explanation */}
            <AnimatePresence>
              {revealed && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="overflow-hidden">
                  <div className="mt-5 rounded-[18px] px-4 py-3.5"
                    style={{
                      background: correct[q.id] ? 'color-mix(in srgb, var(--success) 10%, var(--elevated))' : 'color-mix(in srgb, var(--danger) 9%, var(--elevated))',
                      border: `1px solid ${correct[q.id] ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--danger) 35%, transparent)'}`,
                    }}>
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 14, stiffness: 420 }}
                        className="flex items-center gap-1.5"
                        style={{ color: correct[q.id] ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {correct[q.id] ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}
                        {correct[q.id] ? 'Correct.' : 'Not quite.'}
                      </motion.span>
                      <button onClick={() => setShowExpl((s) => !s)} className="ml-auto text-[11.5px] font-normal underline underline-offset-2" style={{ color: 'var(--text-2)' }}>
                        {showExpl ? 'Hide explanation' : 'Why?'}
                      </button>
                    </div>
                    {!correct[q.id] && (
                      <div className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-2)' }}>
                        Accepted answer: <b style={{ color: 'var(--text)' }}>{q.answer}</b>
                      </div>
                    )}
                    <AnimatePresence>
                      {showExpl && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="text-[12.5px] leading-relaxed mt-2" style={{ color: 'var(--text-2)' }}>
                          <Markdown content={normalizeStepText(q.explanation)} />
                          {onSeeSource && (q as any).source && (
                            <button onClick={() => onSeeSource((q as any).source)} className="block mt-2 text-[11.5px] underline underline-offset-2" style={{ color: 'var(--primary)' }}>
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

      {/* Next — rises out of the card once the answer has landed, so the only
          thing you can do next is the thing you want to do next. */}
      <div className="shrink-0 flex justify-center pb-6 pt-3">
        <AnimatePresence>
          {revealed && (
            <motion.button
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', damping: 22, stiffness: 340 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={next}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-[13.5px] font-semibold"
              style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 14px 40px -16px color-mix(in srgb, var(--primary) 80%, transparent)' }}>
              {idx + 1 >= questions.length ? 'See results' : 'Next'} <ChevronRight size={15} />
              <kbd className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.22)' }}>Space</kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- One answer row: the card in the reference image ---------- */
type OptionState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim'

function QuizOption({ index, label, letter, state, locked, revealDelay, onPick }: {
  index: number
  label: string
  letter: string
  state: OptionState
  locked: boolean
  revealDelay: number
  onPick: (el: HTMLElement) => void
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const [hovered, setHovered] = React.useState(false)
  const [shake, setShake] = React.useState(false)
  const on = state === 'picked' || state === 'correct' || state === 'wrong'
  const tone = state === 'correct' ? 'success' : state === 'wrong' ? 'danger' : 'primary'

  React.useEffect(() => {
    if (state !== 'wrong') return
    setShake(true)
    const t = window.setTimeout(() => setShake(false), 500)
    return () => window.clearTimeout(t)
  }, [state])

  // The pointer-tracked glow: the CSS reads --mx/--my, so the highlight follows
  // the cursor the way the reference card's selected option does.
  const track = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      data-state={state}
      data-locked={locked ? 'true' : 'false'}
      data-hovered={hovered && !locked ? 'true' : 'false'}
      disabled={locked}
      onClick={() => { if (!locked) onPick(ref.current as HTMLElement) }}
      onMouseMove={track}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Arrival: each row rises in just after the one above it.
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: index * 0.055 + 0.12, type: 'spring', damping: 26, stiffness: 320 }}
      className={`re-quiz-option ${shake ? 're-quiz-shake' : ''}`}
    >
      {/* The answer landing: a sweep of colour across the row, then the tick. */}
      {state === 'correct' && (
        <span className="re-quiz-sweep absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--success) 26%, transparent))' }} />
      )}

      <span className="re-quiz-radio" data-on={on ? 'true' : 'false'} data-tone={tone} aria-hidden>
        <AnimatePresence initial={false}>
          {on && (
            <motion.i
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 500 }}
            />
          )}
        </AnimatePresence>
      </span>

      <span className="relative flex-1 text-[14.5px] leading-snug">{label}</span>

      {/* State badge — springs in only for the answer and the mistake. */}
      <AnimatePresence>
        {state === 'correct' && (
          <motion.span
            initial={{ scale: 0, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: revealDelay + 0.1, type: 'spring', damping: 14, stiffness: 460 }}
            className="shrink-0 w-6 h-6 rounded-full grid place-items-center"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            <Check size={14} strokeWidth={3} />
          </motion.span>
        )}
        {state === 'wrong' && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 460 }}
            className="shrink-0 w-6 h-6 rounded-full grid place-items-center"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            <X size={14} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Right edge: the option's letter while you read, swapped for the number
          key that picks it once you point at the row. */}
      {!locked && hovered ? (
        <motion.kbd
          initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }}
          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-[6px] hidden sm:block"
          style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--surface-border)' }}
        >
          {index + 1}
        </motion.kbd>
      ) : (
        <span className="re-quiz-letter shrink-0 hidden sm:block" aria-hidden>{letter}</span>
      )}
    </motion.button>
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
  const rights = React.useMemo(() => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5), [q.id])

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-2.5">
          {pairs.map((p, i) => {
            const chosen = matches[p.left]
            const good = revealed && chosen === p.right
            const bad = revealed && chosen && chosen !== p.right
            const active = selLeft === p.left
            return (
              <motion.button key={p.left} onClick={() => onPickLeft(p.left)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 26, stiffness: 320 }}
                whileTap={{ scale: 0.985 }}
                className="w-full px-3.5 py-3 rounded-[16px] text-[13px] font-medium text-left"
                style={{
                  background: good ? 'color-mix(in srgb, var(--success) 16%, var(--elevated))'
                    : bad ? 'color-mix(in srgb, var(--danger) 14%, var(--elevated))'
                    : active ? 'color-mix(in srgb, var(--primary) 14%, var(--elevated))' : 'var(--elevated)',
                  border: `2px solid ${active ? 'var(--primary)' : good ? 'var(--success)' : bad ? 'var(--danger)' : 'transparent'}`,
                  color: 'var(--text)',
                }}>
                {p.left}
                {chosen && <span className="block text-[10.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>→ {chosen.slice(0, 30)}{chosen.length > 30 ? '…' : ''}</span>}
              </motion.button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {rights.map((r, i) => {
            const taken = Object.values(matches).includes(r)
            const owner = pairs.find((p) => matches[p.left] === r)?.left
            const good = revealed && !!owner && pairs.find((p) => p.left === owner)?.right === r
            const bad = revealed && !!owner && pairs.find((p) => p.left === owner)?.right !== r
            return (
              <motion.button key={r} onClick={() => onPickRight(r)} disabled={revealed}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.06, type: 'spring', damping: 26, stiffness: 320 }}
                whileTap={{ scale: 0.985 }}
                className="w-full px-3.5 py-3 rounded-[16px] text-[12px] text-left leading-snug"
                style={{
                  background: good ? 'color-mix(in srgb, var(--success) 16%, var(--elevated))'
                    : bad ? 'color-mix(in srgb, var(--danger) 14%, var(--elevated))'
                    : taken ? 'var(--surface)' : 'var(--elevated)',
                  border: `2px solid ${good ? 'var(--success)' : bad ? 'var(--danger)' : 'transparent'}`,
                  color: taken && !revealed ? 'var(--text-3)' : 'var(--text)',
                }}>
                {r}
              </motion.button>
            )
          })}
        </div>
      </div>
      {!revealed && (
        <button onClick={onCheck} disabled={!canCheck}
          className="w-full mt-3 py-3 rounded-[16px] text-[13.5px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          Check matches
        </button>
      )}
    </div>
  )
}
