/**
 * The Path tab: a step-by-step course built from one uploaded document.
 *
 * Nothing is generated until the learner presses the button. Lessons unlock
 * one after another, each finished lesson earns stars and XP, and the path is
 * a map you can walk, not a list you scroll.
 */
import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, Check, Star, Sparkles, Flame, Trophy, Loader2, X, ChevronRight, RotateCcw } from 'lucide-react'
import type { DocumentRecord, LearnPath, PathLesson, QuizQuestion } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Select } from '@/components/ui/watermelon/Select'
import CometDial from '@/components/ui/reactbits/micro/CometDial'
import HoldButton from '@/components/ui/reactbits/micro/HoldButton'
import { buildLearnPath, lessonOrder, recordLesson, awardXp, XP_PER_CORRECT, XP_FOR_FINISHING } from '@/lib/learn/path'
import { useActivity, streakOf } from '@/lib/activity/tracker'
import { demoPath } from '@/lib/learn/demo'

export function PathPanel({ documents }: { documents: DocumentRecord[] }) {
  const paths = useStore((s) => s.learnPaths)
  const progress = useStore((s) => s.learnProgress)
  const activityDays = useActivity((s) => s.days)
  const ui = useUI()
  const [docId, setDocId] = useState<string>(documents[0]?.id ?? '')
  const [building, setBuilding] = useState(false)
  const [openLesson, setOpenLesson] = useState<{ lesson: PathLesson; path: LearnPath } | null>(null)

  const doc = documents.find((d) => d.id === docId) ?? documents[0]
  // The demo is built on this device from a sample text. It is not saved to
  // the library, and it is shown the same way a real path is.
  const [demo, setDemo] = useState(documents.length === 0)
  const demoBuilt = useMemo(() => demoPath(), [])
  const realPath = paths.find((p) => p.docId === doc?.id) ?? null
  const path = demo ? demoBuilt : realPath

  const build = async () => {
    if (!doc) return
    setBuilding(true)
    try {
      const next = await buildLearnPath({ id: doc.id, name: doc.name, text: doc.text })
      useStore.setState((s) => ({ learnPaths: [next, ...s.learnPaths.filter((p) => p.docId !== doc.id)] }))
      ui.toast('Path ready', `${next.units.length} units · ${next.units.reduce((n, u) => n + u.lessons.length, 0)} lessons`, 'success')
    } catch (e: any) {
      ui.toast('Could not build the path', e?.message ?? 'Try again.', 'warning')
    } finally {
      setBuilding(false)
    }
  }

  if (documents.length === 0 && !demo) {
    return (
      <div className="surface p-5 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
        Upload a PDF or document in the Study tab, then build its path here.
      </div>
    )
  }

  const flat = path ? lessonOrder(path, progress) : []
  const finished = flat.filter((x) => x.stars > 0).length
  const pct = flat.length ? Math.round((finished / flat.length) * 100) : 0
  const nextUp = flat.find((x) => !x.locked && x.stars === 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!demo && documents.length > 0 && (
          <Select size="sm" value={doc?.id ?? ''} onChange={(v) => setDocId(v)}
            options={documents.map((d) => ({ value: d.id, label: d.name }))} className="w-[260px]" />
        )}
        <button type="button" onClick={() => setDemo((v) => !v)} aria-pressed={demo}
          className="px-3 py-1.5 rounded-full text-[11.5px] font-medium"
          style={{ background: demo ? 'var(--primary)' : 'var(--elevated)', color: demo ? '#fff' : 'var(--text-2)' }}>
          {demo ? (documents.length ? 'Back to my documents' : 'Demo path') : 'See the demo'}
        </button>
        <Stat icon={<Flame size={13} />} label={`${streakOf(activityDays)} day streak`} tone="var(--warning)" />
        <Stat icon={<Trophy size={13} />} label={`${progress.xp} XP`} tone="var(--primary)" />
      </div>

      {demo && (
        <div className="surface p-3 text-[12px] flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
          <Sparkles size={13} style={{ color: 'var(--primary)' }} />
          Demo: a sample text about photosynthesis, built on this device. It is not saved to your library, and the
          lessons count toward your XP like any other.
        </div>
      )}

      {!path && !demo && (
        <div className="surface p-5 text-center">
          <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--primary)' }} />
          <div className="text-[14px] font-semibold">Build a step-by-step path from “{doc?.name}”</div>
          <p className="text-[12px] leading-relaxed mt-1 mb-4 max-w-[420px] mx-auto" style={{ color: 'var(--text-3)' }}>
            Units and lessons are written from spaced passages of the document, and each lesson is three or four questions.
            A configured model writes them. Without one, the on-device engine does, and the path says so.
          </p>
          <button onClick={build} disabled={building} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium disabled:opacity-60"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {building ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {building ? 'Writing lessons…' : 'Generate learning path'}
          </button>
        </div>
      )}

      {path && (
        <>
          <div className="surface p-4 flex items-center gap-4">
            <CometDial size={76} value={pct} min={0} max={100} unit="%" label="Path complete" disabled />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold truncate">{path.title}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {finished} of {flat.length} lessons · built with {path.builtWith}
              </div>
              {nextUp && (
                <button onClick={() => setOpenLesson({ lesson: nextUp.lesson, path })}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  Continue · {nextUp.lesson.title} <ChevronRight size={13} />
                </button>
              )}
              {!nextUp && flat.length > 0 && (
                <div className="mt-2 text-[12px] font-medium" style={{ color: 'var(--success)' }}>Path complete. Build it again for a fresh set of questions.</div>
              )}
            </div>
            {!demo && (
              <HoldButton holdTime={1200} size="sm" onHold={() => useStore.setState((s) => ({ learnPaths: s.learnPaths.filter((p) => p.id !== path.id) }))}>
                Hold to delete
              </HoldButton>
            )}
          </div>

          <PathMap path={path} progress={progress} onOpen={(lesson) => setOpenLesson({ lesson, path })} />
        </>
      )}

      <AnimatePresence>
        {openLesson && (
          <LessonPlayer key={openLesson.lesson.id} lesson={openLesson.lesson} onClose={() => setOpenLesson(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium tabular-nums"
      style={{ background: 'var(--elevated)', color: tone }}>
      {icon} {label}
    </span>
  )
}

/* The map: a zig-zag of lesson nodes, one unit banner above each group. */
function PathMap({ path, progress, onOpen }: { path: LearnPath; progress: ReturnType<typeof useStore.getState>['learnProgress']; onOpen: (l: PathLesson) => void }) {
  const flat = useMemo(() => lessonOrder(path, progress), [path, progress])
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {path.units.map((unit, ui) => {
        const items = flat.filter((f) => f.unit.id === unit.id)
        const done = items.filter((f) => f.stars > 0).length
        return (
          <div key={unit.id} className="w-full">
            <div className="rounded-[14px] px-4 py-2.5 mb-5 flex items-center gap-3"
              style={{ background: 'color-mix(in srgb, var(--primary) 14%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--primary)' }}>Unit {ui + 1}</div>
                <div className="text-[13px] font-semibold truncate">{unit.title}</div>
              </div>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-2)' }}>{done}/{items.length}</span>
            </div>
            <div className="flex flex-col items-center gap-5">
              {items.map((f, i) => {
                const offset = [0, 46, 0, -46][i % 4]
                return (
                  <div key={f.lesson.id} className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
                    <button
                      disabled={f.locked}
                      onClick={() => onOpen(f.lesson)}
                      aria-label={`${f.lesson.title}${f.locked ? ', locked' : f.stars ? `, ${f.stars} of 3 stars` : ''}`}
                      className="w-[68px] h-[68px] rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
                      style={{
                        background: f.stars > 0 ? 'var(--success)' : f.locked ? 'var(--elevated)' : 'var(--primary)',
                        color: f.locked ? 'var(--text-3)' : '#fff',
                        boxShadow: f.locked ? 'none' : '0 10px 30px -12px var(--primary)',
                        border: '3px solid var(--bg)',
                      }}>
                      {f.locked ? <Lock size={18} /> : f.stars > 0 ? <Check size={22} strokeWidth={2.4} /> : <Star size={20} />}
                    </button>
                    <div className="mt-2 text-[11.5px] font-medium text-center max-w-[220px] leading-snug">{f.lesson.title}</div>
                    {f.stars > 0 && (
                      <div className="flex gap-0.5 mt-1" aria-hidden>
                        {[1, 2, 3].map((n) => (
                          <Star key={n} size={10} fill={n <= f.stars ? 'var(--warning)' : 'none'} style={{ color: n <= f.stars ? 'var(--warning)' : 'var(--text-3)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {ui < path.units.length - 1 && <div className="mx-auto mt-6 h-6 w-px" style={{ background: 'var(--surface-border)' }} />}
          </div>
        )
      })}
    </div>
  )
}

/* One lesson: questions one at a time, with feedback and the passage on a miss. */
function LessonPlayer({ lesson, onClose }: { lesson: PathLesson; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [stars, setStars] = useState<number | null>(null)
  const questions: QuizQuestion[] = lesson.questions
  const q = questions[i]

  const pick = (opt: string) => {
    if (picked !== null) return
    setPicked(opt)
    if (opt === q.answer) setCorrect((c) => c + 1)
  }

  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1)
      setPicked(null)
      return
    }
    const total = questions.length
    // `correct` already counts every answer picked so far in this lesson.
    const earned = recordLesson(lesson.id, correct, total)
    awardXp(correct * XP_PER_CORRECT + XP_FOR_FINISHING)
    setStars(earned)
  }

  return (
    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={onClose} />
      <motion.div initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, opacity: 0 }}
        className="relative w-full max-w-[520px] rounded-[20px] p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 30px 90px -30px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--primary)' }}>Lesson</div>
            <div className="text-[14px] font-semibold truncate">{lesson.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close lesson" className="p-1.5 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}><X size={15} /></button>
        </div>

        {stars === null ? (
          <>
            <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'var(--elevated)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(i / questions.length) * 100}%`, background: 'var(--primary)' }} />
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>{lesson.goal}</p>
            <div className="text-[14.5px] font-medium leading-relaxed mb-4">{q.prompt}</div>
            <div className="space-y-2">
              {(q.options ?? []).map((opt) => {
                const isAnswer = opt === q.answer
                const isPicked = opt === picked
                const tone = picked === null ? null : isAnswer ? 'var(--success)' : isPicked ? 'var(--danger)' : null
                return (
                  <button key={opt} onClick={() => pick(opt)} disabled={picked !== null}
                    className="w-full text-left px-3.5 py-2.5 rounded-[12px] text-[13px] transition-colors"
                    style={{
                      background: tone ? `color-mix(in srgb, ${tone} 14%, transparent)` : 'var(--elevated)',
                      border: `1px solid ${tone ?? 'var(--surface-border)'}`,
                    }}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <div className="mt-4">
                <div className="text-[12.5px] font-medium mb-1" style={{ color: picked === q.answer ? 'var(--success)' : 'var(--danger)' }}>
                  {picked === q.answer ? 'Correct.' : `Not quite. It was “${q.answer}”.`}
                </div>
                {q.explanation && <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{q.explanation}</p>}
                {picked !== q.answer && lesson.excerpt && (
                  <blockquote className="mt-2 text-[11.5px] leading-relaxed p-2.5 rounded-[10px]" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                    From the passage: {lesson.excerpt}
                  </blockquote>
                )}
                <button onClick={next} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-medium"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  {i + 1 < questions.length ? 'Continue' : 'Finish lesson'} <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <div className="flex justify-center gap-1.5 mb-2">
              {[1, 2, 3].map((n) => (
                <Star key={n} size={28} fill={n <= stars ? 'var(--warning)' : 'none'} style={{ color: n <= stars ? 'var(--warning)' : 'var(--text-3)' }} />
              ))}
            </div>
            <div className="text-[15px] font-semibold">{stars === 0 ? 'Not this time' : stars === 3 ? 'Perfect' : 'Lesson passed'}</div>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              {stars === 0 ? 'Read the passage, then try the lesson again. It stays open.' : 'The next lesson is open now.'}
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => { setI(0); setPicked(null); setCorrect(0); setStars(null) }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                <RotateCcw size={12} /> Retry
              </button>
              <button onClick={onClose} className="px-4 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Back to path</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
