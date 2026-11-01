import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  UploadCloud, FileText, Trash2, Play, ChevronRight, RotateCcw, BookOpen, Sparkles,
  GraduationCap, FileSearch, ScanText, Brain, AlertTriangle, Eye, X,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import type { DocumentRecord, QuizQuestion, QuizRecord } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { extractText } from '@/lib/documents/extract'
import { generateQuiz } from '@/lib/quiz/generate'
import TechText from '@/components/ui/reactbits/micro/TechText'
import {
  TECHNIQUES, LEVELS, DEFAULT_TECHNIQUE, DEFAULT_LEVEL,
  techniqueById, levelById, typesFor,
  type TechniqueId, type LevelId,
} from '@/lib/learn/techniques'
import { timeAgo, fmt } from '@/lib/utils'
import { DEMO_DOC_ID, DEMO_DOC_TEXT, DEMO_HIGHLIGHTS, DEMO_REWRITE, DEMO_QUIZ } from '@/lib/documents/demoDoc'
import { ReaderView, type ReaderDoc } from '@/components/reader/ReaderView'
import { QuizPlay, type PlayResult } from './QuizPlay'
import { QuizResults } from './QuizResults'
import { Select } from '@/components/ui/watermelon/Select'
import { FileDropzone } from '@/components/ui/uiarc/file-dropzone/file-dropzone'
import JellyRadio from '@/components/ui/reactbits/micro/JellyRadio'
import { TechniquesPanel } from '@/components/learn/TechniquesPanel'
import { PathPanel } from '@/components/learn/PathPanel'
import { ExamTab } from '@/components/exam/Exam'
import { VideosPanel } from '@/components/learn/VideosPanel'
// shadcn-space @shadcn-space/animated-list-02 — the setup-steps animation, used
// for the two loading paths that read like a pipeline: parsing and analysing a
// document for the reader, and building the questions for a quiz. The step
// labels are the pipeline's own stages, so the animation cannot invent a step
// that is not happening; the true percentage stays underneath it.
import { SetupSteps } from '@/components/shadcn-space/animated-list/animated-list-02'

type Stage = { id: string; label: string; icon: any; pct: number; done: boolean }

type LearnTab = 'study' | 'techniques' | 'path' | 'videos' | 'exam'
const LEARN_TABS: { value: LearnTab; label: string }[] = [
  { value: 'study', label: 'Study' },
  { value: 'techniques', label: 'Techniques' },
  { value: 'path', label: 'Path' },
  { value: 'videos', label: 'Videos' },
  { value: 'exam', label: 'Exam' },
]

export function QuizHub() {
  const documents = useStore((s) => s.documents)
  const quizzes = useStore((s) => s.quizzes)
  const ui = useUI()

  const [view, setView] = useState<'hub' | 'processing' | 'reader' | 'quiz' | 'results' | 'review'>('hub')
  const [readerDoc, setReaderDoc] = useState<ReaderDoc | null>(null)
  const [pendingNeedle, setPendingNeedle] = useState<string | null>(null)
  const seenFiles = useRef(new Set<string>())
  const fileRef = useRef<HTMLInputElement>(null)

  // processing
  const [stages, setStages] = useState<Stage[]>([])
  const [procError, setProcError] = useState<string | null>(null)
  const [procFile, setProcFile] = useState<File | null>(null)
  // run token: bumping it cancels any in-flight pipeline (Cancel button,
  // component unmount) so late async results never overwrite the UI.
  const runId = useRef(0)
  useEffect(() => () => { runId.current++ }, [])

  // quiz config
  const [selected, setSelected] = useState<string | null>(null)
  const [count, setCount] = useState(12)
  const [techniques, setTechniques] = useState<TechniqueId[]>([DEFAULT_TECHNIQUE])
  const [level, setLevel] = useState<LevelId>(DEFAULT_LEVEL)
  // The level decides which sentences are in scope; the technique decides what
  // is asked about them. Both are needed before a question exists.
  const levelSpec = levelById(level)
  const typeList = typesFor(techniques, count)
  const [timed, setTimed] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questions: QuizQuestion[]; docId?: string } | null>(null)
  const [lastResult, setLastResult] = useState<PlayResult | null>(null)
  const [quizIsDemo, setQuizIsDemo] = useState(false)
  const [tab, setTab] = useState<LearnTab>('study')

  const doc = documents.find((d) => d.id === selected) ?? null

  // Onboarding "try the demo" hand-off
  useEffect(() => {
    if (localStorage.getItem('re.quiz.autodemo') === '1') {
      localStorage.removeItem('re.quiz.autodemo')
      startDemo(false)
    }
    // File dropped on another surface (home screen) — pick it up once.
    const pending = useUI.getState().pendingQuizFile
    if (pending) {
      useUI.setState({ pendingQuizFile: null })
      handleFiles([pending])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initialStages = (): Stage[] => [
    { id: 'parse', label: 'Parsing', icon: FileSearch, pct: 0, done: false },
    { id: 'extract', label: 'Extracting', icon: ScanText, pct: 0, done: false },
    { id: 'analyze', label: 'Analyzing', icon: Brain, pct: 0, done: false },
  ]
  const patchStage = (id: string, patch: Partial<Stage>) =>
    setStages((st) => st.map((s) => s.id === id ? { ...s, ...patch } : s))
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /* ---------- real upload pipeline ---------- */
  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return
    const run = ++runId.current
    const alive = () => run === runId.current
    let iv: ReturnType<typeof setInterval> | null = null
    setProcFile(file)
    setProcError(null)
    setStages(initialStages())
    setView('processing')
    try {
      patchStage('parse', { pct: 100, done: true })
      patchStage('extract', { pct: 8 })
      const extraction = extractText(file)
      // animate extraction while the worker runs
      let p = 8
      iv = setInterval(() => { p = Math.min(92, p + 7); if (alive()) patchStage('extract', { pct: p }) }, 160)
      const text = await extraction
      if (iv) clearInterval(iv)
      if (!alive()) return
      patchStage('extract', { pct: 100, done: true })
      patchStage('analyze', { pct: 30 })
      await sleep(300)
      if (!alive()) return
      const rec: DocumentRecord = {
        id: nanoid(8), name: file.name, kind: file.name.split('.').pop() ?? 'file',
        text: text.slice(0, 400000), addedAt: Date.now(),
      }
      useStore.setState((s) => ({ documents: [rec, ...s.documents] }))
      patchStage('analyze', { pct: 100, done: true })
      await sleep(350)
      if (!alive()) return
      ui.toast('Document ready', `${file.name} · ${fmt(Math.round(text.length / 4))} tokens · ~${Math.max(1, Math.round(text.split(/\s+/).length / 220))} min read.`, 'success')
      openReaderFor(rec)
    } catch (e: any) {
      if (iv) clearInterval(iv)
      if (!alive()) return
      setProcError(e?.message ?? 'Unknown error while reading the file.')
    }
  }

  const cancelProcessing = () => {
    runId.current++
    setView('hub')
    setProcError(null)
  }

  /* ---------- demo pipeline (scripted, fully offline) ---------- */
  const startDemo = async (thenQuiz: boolean) => {
    const run = ++runId.current
    const alive = () => run === runId.current
    setProcFile(null)
    setProcError(null)
    setStages(initialStages())
    setView('processing')
    for (const [id, delay] of [['parse', 300], ['extract', 550], ['analyze', 450]] as const) {
      patchStage(id, { pct: 25 })
      await sleep(delay * 0.4); if (!alive()) return; patchStage(id, { pct: 70 })
      await sleep(delay * 0.6); if (!alive()) return; patchStage(id, { pct: 100, done: true })
    }
    await sleep(250)
    if (!alive()) return
    if (thenQuiz) {
      setActiveQuiz({ title: 'Demo — The Structure of DNA', questions: DEMO_QUIZ as unknown as QuizQuestion[] })
      setQuizIsDemo(true)
      setLastResult(null)
      setView('quiz')
    } else {
      setReaderDoc({ id: DEMO_DOC_ID, name: 'The Structure of DNA — Demo', text: DEMO_DOC_TEXT, rewrite: DEMO_REWRITE, highlights: DEMO_HIGHLIGHTS, isDemo: true })
      setPendingNeedle(null)
      setView('reader')
    }
  }

  const openReaderFor = (rec: DocumentRecord) => {
    const rewrite = localStorage.getItem(`re.reader.rewrite.${rec.id}`) ?? undefined
    setReaderDoc({ id: rec.id, name: rec.name, text: rec.text, rewrite })
    setPendingNeedle(null)
    setView('reader')
  }

  /* ---------- quiz launching ---------- */
  const startQuizFromText = (text: string, title: string, docId?: string) => {
    const questions = generateQuiz(text, {
      count, types: typeList, difficulty: levelSpec.difficulty,
      maxSentenceWords: levelSpec.maxSentenceWords,
    })
    if (!questions.length) { ui.toast('Not enough text', 'Add a longer document to generate questions.', 'warning'); return }
    const rec: QuizRecord = { id: nanoid(8), docId, title, questions, createdAt: Date.now() }
    useStore.setState((s) => ({ quizzes: [rec, ...s.quizzes] }))
    setActiveQuiz({ title, questions, docId })
    setQuizIsDemo(false)
    setLastResult(null)
    setView('quiz')
  }

  const seeSource = (needle: string) => {
    if (!activeQuiz?.docId && !quizIsDemo) return
    const rec = quizIsDemo
      ? { id: DEMO_DOC_ID, name: 'The Structure of DNA — Demo', text: DEMO_DOC_TEXT, rewrite: DEMO_REWRITE, highlights: DEMO_HIGHLIGHTS, isDemo: true }
      : (() => { const d = documents.find((x) => x.id === activeQuiz?.docId); return d ? { id: d.id, name: d.name, text: d.text, rewrite: localStorage.getItem(`re.reader.rewrite.${d.id}`) ?? undefined } : null })()
    if (!rec) return
    setReaderDoc(rec)
    setPendingNeedle(needle)
    setView('reader')
  }

  /* ---------- views ---------- */
  const active = stages.find((s) => !s.done) ?? stages[stages.length - 1]

  if (view === 'processing') {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-10 rounded-[12px] flex items-center justify-center grad-quiz"><FileText size={18} className="text-white" /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold truncate" style={{ letterSpacing: '-0.01em' }}>{procFile?.name ?? 'Demo document'}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Processed entirely on this device</div>
            </div>
            <button onClick={cancelProcessing} aria-label="Cancel processing"
              className="ml-auto p-2 rounded-full shrink-0 hover:bg-[var(--elevated)] transition-colors" style={{ color: 'var(--text-3)' }}>
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>
          {!procError ? (
            <div>
              <SetupSteps
                duration={1400}
                steps={stages.map((s) => ({ id: s.id, title: s.label }))}
              />
              {active && (
                <div className="surface p-3.5 flex items-center gap-3 mt-1">
                  <motion.span animate={active.done ? { scale: 1 } : { rotate: 360 }} transition={active.done ? {} : { duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: active.done ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--elevated)', color: active.done ? 'var(--success)' : 'var(--text-2)' }}>
                    <active.icon size={15} strokeWidth={1.5} />
                  </motion.span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-medium">{active.label}</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>{Math.round(active.pct)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${active.pct}%`, background: active.done ? 'var(--success)' : 'var(--primary)' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="surface p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium mb-1" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={15} /> Processing failed
              </div>
              <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{procError}</p>
              <div className="flex gap-2">
                {procFile && (
                  <button onClick={() => handleFiles([procFile])} className="px-3.5 py-2 rounded-full text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Try again</button>
                )}
                <button onClick={cancelProcessing}
                  className="px-3.5 py-2 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>Back to library</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (view === 'reader' && readerDoc) {
    return (
      <div className="h-full relative">
        <ReaderView
          doc={readerDoc}
          initialNeedle={pendingNeedle ?? undefined}
          onBack={() => { setView('hub'); setSelected(readerDoc.isDemo ? null : readerDoc.id) }}
          onQuizSection={(text) => startQuizFromText(text.length > 400 ? text : readerDoc.text, readerDoc.name, readerDoc.isDemo ? undefined : readerDoc.id)}
        />
      </div>
    )
  }

  if (view === 'quiz' && activeQuiz) {
    return (
      <QuizPlay
        questions={activeQuiz.questions}
        timed={timed}
        title={activeQuiz.title}
        source={documents.find((d) => d.id === activeQuiz.docId)?.name ?? (quizIsDemo ? 'Sample document' : undefined)}
        onQuit={() => setView('hub')}
        onSeeSource={seeSource}
        onFinish={(r) => { setLastResult(r); setView('results') }}
      />
    )
  }

  if (view === 'results' && activeQuiz && lastResult) {
    return (
      <QuizResults
        quiz={activeQuiz}
        result={lastResult}
        onRetry={() => setView('quiz')}
        onReviewMistakes={() => {
          const wrong = activeQuiz.questions.filter((q) => !lastResult.correct[q.id])
          if (!wrong.length) { ui.toast('Nothing to review', 'Every answer was correct.', 'success'); return }
          setActiveQuiz({ ...activeQuiz, title: `${activeQuiz.title} — review`, questions: wrong })
          setLastResult(null)
          setView('review')
        }}
        onSimilar={() => {
          const d = documents.find((x) => x.id === activeQuiz.docId)
          const text = quizIsDemo ? DEMO_DOC_TEXT : d?.text ?? ''
          if (!text) { ui.toast('Need the source document', 'Similar quizzes are generated from the original text.', 'warning'); return }
          // A similar quiz is the same technique on a fresh draw of sentences,
          // which is what spaced repetition actually asks for.
          const qs = generateQuiz(text, {
            count: Math.min(count, 10), types: typesFor(techniques, Math.min(count, 10)),
            difficulty: levelSpec.difficulty, maxSentenceWords: levelSpec.maxSentenceWords,
          })
          setActiveQuiz({ title: `${activeQuiz.title} (similar)`, questions: qs, docId: activeQuiz.docId })
          setLastResult(null)
          setView('quiz')
        }}
        onBack={() => setView('hub')}
      />
    )
  }

  if (view === 'review' && activeQuiz) {
    return (
      <QuizPlay
        questions={activeQuiz.questions}
        timed={false}
        title={activeQuiz.title}
        onQuit={() => setView('hub')}
        onSeeSource={seeSource}
        onFinish={() => setView('hub')}
      />
    )
  }

  /* ---------- hub ---------- */
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
          <GraduationCap size={19} style={{ color: 'var(--primary)' }} /> Learn
        </h1>
        <p className="text-[13px] mt-0.5 mb-6" style={{ color: 'var(--text-2)' }}>
          Read a document, then study it with a named technique: active recall, spaced repetition,
          interleaving, the Feynman method. Everything runs on this machine.
        </p>

        {/* Four ways in: the document study flow, the named techniques you do,
            the step-by-step path built from a document, and videos for what you
            are on now. */}
        <div className="mb-6">
          <JellyRadio items={LEARN_TABS} value={tab} onChange={(v: string) => setTab(v as LearnTab)} ariaLabel="Learn sections" size="sm" />
        </div>

        {tab === 'techniques' && <TechniquesPanel documents={documents} />}
        {tab === 'path' && <PathPanel documents={documents} />}
        {tab === 'videos' && <VideosPanel documents={documents} />}
        {tab === 'exam' && <ExamTab />}

        {tab === 'study' && (<>
        {/* The empty state is the one place a heading that assembles itself is a
            welcome rather than a delay: nothing else is moving yet. */}
        {documents.length === 0 && (
          <div className="mb-6">
            <TechText text="Nothing here yet. Drop a document to begin."
              className="text-[13px] font-medium m-0" speed={26} />
          </div>
        )}

        {/* Drop zone: reactbits-style file dropzone (uiarc). It lists each file as it
            is picked; the handler ingests a file once, the first time it appears. */}
        <div className="mb-3">
          <FileDropzone
            accept=".pdf,.docx,.txt,.md,.markdown"
            multiple
            maxFiles={5}
            maxSize={50 * 1024 * 1024}
            label="Add a document"
            description="Drop a PDF, DOCX, TXT or Markdown file, or choose one from your device"
            note="Extraction happens on-device. Nothing is uploaded."
            onFilesChange={(files) => {
              const fresh = files.filter((f) => {
                const key = `${f.name}:${f.size}:${f.lastModified}`
                if (seenFiles.current.has(key)) return false
                seenFiles.current.add(key)
                return true
              })
              if (fresh.length) handleFiles(fresh)
            }}
          />
        </div>

        {/* Demo entries */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => startDemo(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-[12.5px] font-medium grad-quiz text-white transition-transform hover:scale-[1.02]">
            <BookOpen size={14} /> Try the reading demo <ChevronRight size={13} />
          </button>
          <button onClick={() => startDemo(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-[12.5px] transition-colors"
            style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--surface-border)' }}>
            <Sparkles size={14} style={{ color: 'var(--warning)' }} /> Try the demo quiz
          </button>
        </div>

        {/* Documents + quiz config */}
        {documents.length > 0 && (
          <>
            <h3 className="text-[13px] font-semibold mb-2">Your documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {documents.map((d) => (
                <button key={d.id}
                  onClick={() => { setSelected(d.id); openReaderFor(d) }}
                  className="surface p-3.5 text-left transition-all hover:border-[var(--primary)]"
                  style={{ borderColor: selected === d.id ? 'var(--primary)' : undefined }}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={15} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                    <span className="text-[13px] font-medium truncate flex-1">{d.name}</span>
                    <span onClick={(e) => { e.stopPropagation(); useStore.setState((s) => ({ documents: s.documents.filter((x) => x.id !== d.id) })) }}
                      className="p-1 rounded hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                      <Trash2 size={12.5} />
                    </span>
                  </div>
                  <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>
                    {fmt(Math.round(d.text.length / 4))} tokens · {timeAgo(d.addedAt)} · <Eye size={9} className="inline" /> reader
                  </div>
                </button>
              ))}
            </div>

            <div className="surface p-4 mb-6">
              <div className="text-[13px] font-semibold mb-3 flex items-center gap-2"><Play size={14} style={{ color: 'var(--primary)' }} /> Study {doc ? `“${doc.name}”` : 'this document'}</div>
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <label className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                  Questions
                  <Select
                    size="sm"
                    value={String(count)}
                    onChange={(v) => setCount(Number(v))}
                    options={[5, 8, 10, 15].map((n) => ({ value: String(n), label: `${n} questions` }))}
                    className="w-[118px]"
                  />
                </label>
                <label className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                  Level
                  <Select
                    size="sm"
                    value={level}
                    onChange={(v) => {
                      const next = levelById(v)
                      setLevel(v as LevelId)
                      // The level carries its own question count, so picking
                      // one moves you off a count that no longer suits it.
                      setCount(next.suggestedCount)
                    }}
                    options={LEVELS.map((l) => ({ value: l.id, label: l.name, hint: l.why }))}
                    className="w-[136px]"
                  />
                </label>
                <button onClick={() => setTimed((t) => !t)}
                  className="px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: timed ? 'color-mix(in srgb, var(--warning) 16%, transparent)' : 'var(--elevated)', color: timed ? 'var(--warning)' : 'var(--text-3)' }}>
                  30s timer {timed ? 'on' : 'off'}
                </button>
              </div>
              {/* Techniques, not question types. What you are choosing between is
                  how you want to be made to think, and each of these is a named
                  method with its own evidence. The question shapes follow from
                  the technique, so they are not a second thing to configure. */}
              <div className="mt-3 mb-4">
                <div className="text-[11.5px] font-medium mb-2" style={{ color: 'var(--text-2)' }}>
                  How do you want to study this?
                </div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {TECHNIQUES.map((t) => {
                    const on = techniques.includes(t.id)
                    return (
                      <button key={t.id}
                        onClick={() => setTechniques((prev) => {
                          const next = prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                          // Never leave nothing on: an empty set has no shape,
                          // so falling back to the default is the honest move.
                          return next.length ? next : [DEFAULT_TECHNIQUE]
                        })}
                        className="text-left px-2.5 py-2 rounded-xl transition-colors"
                        style={{
                          background: on ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--elevated)',
                          border: `1px solid ${on ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'transparent'}`,
                        }}>
                        <div className="text-[12px] font-medium" style={{ color: on ? 'var(--primary)' : 'var(--text-1)' }}>{t.name}</div>
                        <div className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-3)' }}>{t.why}</div>
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
                  {techniques.length === 1
                    ? techniqueById(techniques[0]).name
                    : `${techniques.length} techniques combined`}
                  {' · '}
                  {typeList.length} questions, mixed as the technique asks.
                </div>
              </div>
              <button
                onClick={() => doc ? startQuizFromText(doc.text, doc.name, doc.id) : ui.toast('Pick a document first', 'Select one of your documents above.', 'info')}
                disabled={!doc}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <GraduationCap size={14} /> Generate quiz
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
        {documents.length === 0 && (
          <div className="text-center py-8">
            <svg width="120" height="90" viewBox="0 0 120 90" fill="none" className="mx-auto mb-4 opacity-80">
              <rect x="22" y="12" width="76" height="66" rx="8" stroke="var(--primary)" strokeWidth="1.5" opacity="0.6" />
              <path d="M36 30h48M36 42h48M36 54h30" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
              <circle cx="92" cy="66" r="14" stroke="var(--warning)" strokeWidth="1.5" />
              <path d="M86 66l4 4 8-8" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-[14px] font-medium mb-1">Upload a document to read and quiz on it</div>
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Or jump straight into the bundled DNA demo — no setup needed.</div>
          </div>
        )}

        {/* Past quizzes */}
        {quizzes.length > 0 && (
          <>
            <h3 className="text-[13px] font-semibold mb-2">Recent quizzes</h3>
            <div className="space-y-1.5">
              {quizzes.slice(0, 6).map((qz) => (
                <button key={qz.id}
                  onClick={() => { setActiveQuiz({ title: qz.title, questions: qz.questions, docId: qz.docId }); setQuizIsDemo(false); setLastResult(null); setView('quiz') }}
                  className="w-full surface px-4 py-3 flex items-center gap-3 text-left transition-colors hover:border-[var(--primary)]">
                  <RotateCcw size={14} style={{ color: 'var(--text-3)' }} />
                  <span className="flex-1 text-[12.5px] truncate">{qz.title}</span>
                  <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{qz.questions.length} questions · {timeAgo(qz.createdAt)}</span>
                  <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />
                </button>
              ))}
            </div>
          </>
        )}
        </>)}
      </div>
    </div>
  )
}
