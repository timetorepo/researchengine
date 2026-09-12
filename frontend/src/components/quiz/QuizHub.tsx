import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { timeAgo, fmt } from '@/lib/utils'
import { DEMO_DOC_ID, DEMO_DOC_TEXT, DEMO_HIGHLIGHTS, DEMO_REWRITE, DEMO_QUIZ } from '@/lib/documents/demoDoc'
import { ReaderView, type ReaderDoc } from '@/components/reader/ReaderView'
import { QuizPlay, type PlayResult } from './QuizPlay'
import { QuizResults } from './QuizResults'

type Stage = { id: string; label: string; icon: any; pct: number; done: boolean }

const TYPES = [
  { id: 'mc', label: 'Multiple choice' },
  { id: 'tf', label: 'True / false' },
  { id: 'short', label: 'Short answer' },
  { id: 'fill', label: 'Fill in blank' },
  { id: 'ordering', label: 'Reorder' },
  { id: 'matching', label: 'Matching' },
]

export function QuizHub() {
  const documents = useStore((s) => s.documents)
  const quizzes = useStore((s) => s.quizzes)
  const ui = useUI()

  const [view, setView] = useState<'hub' | 'processing' | 'reader' | 'quiz' | 'results' | 'review'>('hub')
  const [readerDoc, setReaderDoc] = useState<ReaderDoc | null>(null)
  const [pendingNeedle, setPendingNeedle] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
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
  const [count, setCount] = useState(8)
  const [types, setTypes] = useState<string[]>(['mc', 'tf'])
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [timed, setTimed] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questions: QuizQuestion[]; docId?: string } | null>(null)
  const [lastResult, setLastResult] = useState<PlayResult | null>(null)
  const [quizIsDemo, setQuizIsDemo] = useState(false)

  const doc = documents.find((d) => d.id === selected) ?? null

  // Onboarding "try the demo" hand-off
  useEffect(() => {
    if (localStorage.getItem('re.quiz.autodemo') === '1') {
      localStorage.removeItem('re.quiz.autodemo')
      startDemo(false)
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
    const questions = generateQuiz(text, { count, types: types as any, difficulty })
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
            <div className="space-y-3">
              {stages.map((s) => (
                <div key={s.id} className="surface p-3.5 flex items-center gap-3">
                  <motion.span animate={s.done ? { scale: 1 } : { rotate: 360 }} transition={s.done ? {} : { duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: s.done ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--elevated)', color: s.done ? 'var(--success)' : 'var(--text-2)' }}>
                    <s.icon size={15} strokeWidth={1.5} />
                  </motion.span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-medium">{s.label}</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-3)' }}>{Math.round(s.pct)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${s.pct}%`, background: s.done ? 'var(--success)' : 'var(--primary)' }} />
                    </div>
                  </div>
                </div>
              ))}
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
          const shuffled = [...types].sort(() => Math.random() - 0.5)
          const qs = generateQuiz(text, { count: Math.min(count, 10), types: (shuffled.length ? shuffled : ['mc']) as any, difficulty })
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
          <GraduationCap size={19} style={{ color: 'var(--primary)' }} /> Read &amp; Quiz
        </h1>
        <p className="text-[13px] mt-0.5 mb-6" style={{ color: 'var(--text-2)' }}>
          Upload a document — get a beautiful study reader, an AI reading partner, and premium quizzes. All processed locally.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className="rounded-[18px] p-8 text-center cursor-pointer transition-all mb-3"
          style={{ border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--surface-border)'}`, background: dragOver ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--surface)' }}
        >
          <UploadCloud size={26} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--primary)' }} />
          <div className="text-[14px] font-medium">Drop a PDF, DOCX, TXT or Markdown file</div>
          <div className="text-[11.5px] mt-1" style={{ color: 'var(--text-3)' }}>or click to browse — extraction happens on-device</div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.markdown" className="hidden" onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = '' // allow re-selecting the same file
            if (files.length) handleFiles(files)
          }} />
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
              <div className="text-[13px] font-semibold mb-3 flex items-center gap-2"><Play size={14} style={{ color: 'var(--primary)' }} /> Generate a quiz{doc ? ` from “${doc.name}”` : ''}</div>
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <label className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                  Questions
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                    className="px-2 py-1 rounded-[8px] outline-none" style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                  {[5, 8, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                </label>
                <label className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                  Difficulty
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}
                    className="px-2 py-1 rounded-[8px] outline-none capitalize" style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                  {['easy', 'medium', 'hard'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                </label>
                <button onClick={() => setTimed((t) => !t)}
                  className="px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: timed ? 'color-mix(in srgb, var(--warning) 16%, transparent)' : 'var(--elevated)', color: timed ? 'var(--warning)' : 'var(--text-3)' }}>
                  30s timer {timed ? 'on' : 'off'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                {TYPES.map((t) => (
                  <button key={t.id}
                    onClick={() => setTypes((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                    className="px-2.5 py-1 rounded-full text-[11.5px] transition-colors"
                    style={{
                      background: types.includes(t.id) ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
                      color: types.includes(t.id) ? 'var(--primary)' : 'var(--text-3)',
                      border: `1px solid ${types.includes(t.id) ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'transparent'}`,
                    }}>
                    {t.label}
                  </button>
                ))}
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
      </div>
    </div>
  )
}
