import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, Share2, Sparkles, Trophy, Flame, Target, GraduationCap } from 'lucide-react'
import { ShareStudio } from './ShareStudio'
import type { QuizQuestion } from '@/types'
import type { PlayResult } from './QuizPlay'
import { burstConfetti } from '@/lib/quiz/confetti'

function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function QuizResults({ quiz, result, onRetry, onReviewMistakes, onSimilar, onBack }: {
  quiz: { title: string; questions: QuizQuestion[] }
  result: PlayResult
  onRetry: () => void
  onReviewMistakes: () => void
  onSimilar: () => void
  onBack: () => void
}) {
  const total = quiz.questions.length
  const nCorrect = quiz.questions.filter((q) => result.correct[q.id]).length
  const pct = Math.round((nCorrect / Math.max(1, total)) * 100)
  const score = useCountUp(pct)
  const cardRef = useRef<HTMLDivElement>(null)
  // The share card is a studio now: it opens with a live preview of the exact
  // PNG, four looks, your own picture and the app's accent colours.
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (pct >= 80) {
      const t = setTimeout(() => burstConfetti(window.innerWidth / 2, window.innerHeight / 3, ['#34D399', '#FBBF24', '#6C8EEF', '#22D3EE']), 350)
      return () => clearTimeout(t)
    }
  }, [pct])

  const shareData = {
    title: quiz.title,
    source: (quiz as any).source,
    pct,
    correct: nCorrect,
    total,
    streakBest: result.streakBest,
  }

  const byType = ['mc', 'tf', 'short', 'fill', 'ordering', 'matching'].map((t) => {
    const qs = quiz.questions.filter((q) => q.type === t)
    if (!qs.length) return null
    const ok = qs.filter((q) => result.correct[q.id]).length
    return { t, ok, n: qs.length }
  }).filter(Boolean) as { t: string; ok: number; n: number }[]

  const achievements: { label: string; earned: boolean; icon: any }[] = [
    { label: 'First Perfect Score', earned: pct === 100, icon: Trophy },
    { label: `${result.streakBest}-Answer Streak`, earned: result.streakBest >= 3, icon: Flame },
    { label: 'Sharpshooter (90%+)', earned: pct >= 90, icon: Target },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-center mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
            {pct >= 80 ? 'Outstanding session' : pct >= 50 ? 'Solid work' : 'Worth another pass'}
          </div>
          <div className="text-[64px] font-bold leading-none tabular-nums" style={{ letterSpacing: '-0.03em', color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {score}%
          </div>
          <div className="text-[13.5px] mt-2" style={{ color: 'var(--text-2)' }}>
            {nCorrect} of {total} correct · best streak {result.streakBest}
          </div>
        </motion.div>

        {/* Bento breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {byType.map((b, i) => (
            <motion.div key={b.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
              className="surface p-4">
              <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                {b.t === 'mc' ? 'Multiple choice' : b.t === 'tf' ? 'True / false' : b.t === 'fill' ? 'Fill in blank' : b.t === 'ordering' ? 'Reorder' : b.t === 'matching' ? 'Matching' : 'Short answer'}
              </div>
              <div className="text-[22px] font-semibold tabular-nums">{b.ok}<span style={{ color: 'var(--text-3)' }}>/{b.n}</span></div>
              <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--elevated)' }}>
                <motion.div className="h-full rounded-full" style={{ background: 'var(--success)' }}
                  initial={{ width: 0 }} animate={{ width: `${(b.ok / b.n) * 100}%` }} transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }} />
              </div>
            </motion.div>
          ))}
          {achievements.map((a, i) => (
            <motion.div key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
              className="surface p-4 flex items-center gap-3"
              style={{ opacity: a.earned ? 1 : 0.45 }}>
              <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
                style={{ background: a.earned ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : 'var(--elevated)', color: a.earned ? 'var(--warning)' : 'var(--text-3)' }}>
                <a.icon size={17} strokeWidth={1.5} />
              </span>
              <div>
                <div className="text-[12px] font-medium">{a.label}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{a.earned ? 'Unlocked' : 'Locked'}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={onReviewMistakes} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <GraduationCap size={14} /> Review mistakes
          </button>
          <button onClick={onSimilar} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
            <Sparkles size={14} /> Generate similar quiz
          </button>
          <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
            <RotateCcw size={14} /> Retake
          </button>
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
            <Share2 size={14} /> Share results
          </button>
        </div>
        <button onClick={onBack} className="block mx-auto mt-5 text-[12px] hover:underline" style={{ color: 'var(--text-3)' }}>
          Back to Learn
        </button>
      </div>

      <AnimatePresence>
        {shareOpen && <ShareStudio data={shareData} onClose={() => setShareOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
