/**
 * The Techniques tab. Each named method is a thing you do, not a thing you
 * read about:
 *
 *   Active recall  you type the missing term before it is shown
 *   Spaced         the same cards come back on an SM-2 schedule
 *   Feynman        you explain the idea in your own words and it is graded
 *   Dual coding    every term gets a picture you choose and a line you write
 */
import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Brain, Repeat, MessageSquareText, Shapes, Check, X, RotateCcw, Sparkles, Atom, Zap, Waves, Flame,
  Box, Sprout, Magnet, Ruler, Compass, Radar, Dna, Telescope, Lightbulb,
} from 'lucide-react'
import type { DocumentRecord, SpacedCard } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { sentences } from '@/lib/documents/extract'
import {
  clozeCards, matchesAnswer, scheduleCard, dueCards, keyTerms, gradeFeynman, dualCodeItems,
  type FeynmanGrade, type Recall, type DualItem,
} from '@/lib/learn/cards'
import { awardXp, XP_PER_CORRECT, XP_FOR_FINISHING } from '@/lib/learn/path'
import { Select } from '@/components/ui/watermelon/Select'
import JellyRadio from '@/components/ui/reactbits/micro/JellyRadio'
import BorderGlow from '@/components/ui/reactbits/micro/BorderGlow'
import WakeSlider from '@/components/ui/reactbits/micro/WakeSlider'
import PeekRating from '@/components/ui/reactbits/micro/PeekRating'
import SwipeToast from '@/components/ui/reactbits/micro/SwipeToast'
import HoldButton from '@/components/ui/reactbits/micro/HoldButton'

type Technique = 'recall' | 'feynman' | 'dual'

const TECHNIQUE_ITEMS = [
  { value: 'recall', label: 'Active recall' },
  { value: 'feynman', label: 'Feynman' },
  { value: 'dual', label: 'Dual coding' },
]

export function TechniquesPanel({ documents }: { documents: DocumentRecord[] }) {
  const [technique, setTechnique] = useState<Technique>('recall')
  const [docId, setDocId] = useState<string>(documents[0]?.id ?? '')
  const doc = documents.find((d) => d.id === docId) ?? documents[0]

  if (documents.length === 0) {
    return <EmptyNote text="Add a document first. Every technique is built from its text." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          size="sm"
          value={doc?.id ?? ''}
          onChange={(v) => setDocId(v)}
          options={documents.map((d) => ({ value: d.id, label: d.name }))}
          className="w-[260px]"
        />
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Practice runs on this device. XP is awarded for every step you finish.
        </span>
      </div>

      <JellyRadio
        items={TECHNIQUE_ITEMS}
        value={technique}
        onChange={(v: string) => setTechnique(v as Technique)}
        ariaLabel="Learning technique"
        size="sm"
      />

      {doc && technique === 'recall' && <RecallSession key={`r-${doc.id}`} doc={doc} />}
      {doc && technique === 'feynman' && <FeynmanSession key={`f-${doc.id}`} doc={doc} />}
      {doc && technique === 'dual' && <DualCodeSession key={`d-${doc.id}`} doc={doc} />}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="surface p-5 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>{text}</div>
  )
}

/* ------------------------------------------------------------------ */
/* Active recall + spaced repetition                                   */
/* ------------------------------------------------------------------ */

const RATINGS: { id: Recall; label: string; hint: string; tone: string }[] = [
  { id: 'missed', label: 'Missed', hint: 'back in 10 min', tone: 'var(--danger)' },
  { id: 'hard', label: 'Hard', hint: 'sooner', tone: 'var(--warning)' },
  { id: 'good', label: 'Good', hint: 'as scheduled', tone: 'var(--primary)' },
  { id: 'easy', label: 'Easy', hint: 'stretched', tone: 'var(--success)' },
]

function RecallSession({ doc }: { doc: DocumentRecord }) {
  const allCards = useStore((s) => s.spacedCards)
  const cards = useMemo(() => allCards.filter((c) => c.docId === doc.id), [allCards, doc.id])
  const [size, setSize] = useState(8)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const [done, setDone] = useState(0)
  const [undo, setUndo] = useState<{ before: SpacedCard; label: string } | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const ui = useUI()

  const build = () => {
    const fresh = clozeCards(doc.text, doc.id, 12)
    if (!fresh.length) { ui.toast('Not enough text', 'This document has no sentences long enough to blank out.', 'warning'); return }
    useStore.setState((s) => ({ spacedCards: [...s.spacedCards.filter((c) => c.docId !== doc.id), ...fresh] }))
  }

  const start = (practice: boolean) => {
    const due = dueCards(cards)
    const pool = practice || due.length === 0 ? [...cards].sort((a, b) => a.due - b.due) : due
    setQueue(pool.slice(0, size).map((c) => c.id))
    setIndex(0)
    setDone(0)
    setTyped('')
    setChecked(null)
  }

  const activeId = queue?.[index]
  const card = cards.find((c) => c.id === activeId)

  const check = () => {
    if (!card || checked !== null) return
    setChecked(matchesAnswer(typed, card.answer))
  }

  const rate = (r: Recall) => {
    if (!card) return
    const before = card
    const after = scheduleCard(card, r)
    useStore.setState((s) => ({ spacedCards: s.spacedCards.map((c) => (c.id === card.id ? after : c)) }))
    awardXp(checked ? XP_PER_CORRECT : XP_FOR_FINISHING)
    setUndo({ before, label: `${RATINGS.find((x) => x.id === r)?.label}: ${card.answer}` })
    setToastOpen(true)
    setDone((d) => d + 1)
    setTyped('')
    setChecked(null)
    setIndex((i) => i + 1)
  }

  const revert = () => {
    if (!undo) return
    useStore.setState((s) => ({ spacedCards: s.spacedCards.map((c) => (c.id === undo.before.id ? undo.before : c)) }))
    setIndex((i) => Math.max(0, i - 1))
    setDone((d) => Math.max(0, d - 1))
    setUndo(null)
    setToastOpen(false)
  }

  const finished = queue !== null && index >= queue.length

  return (
    <div className="surface p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Active recall</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {cards.length} cards · {dueCards(cards).length} due now. Type the missing term from memory, then rate how it went.
          </div>
        </div>
        {cards.length > 0 && (
          <HoldButton
            holdTime={1200}
            size="sm"
            onHold={() => useStore.setState((s) => ({ spacedCards: s.spacedCards.filter((c) => c.docId !== doc.id) }))}
          >
            Hold to clear deck
          </HoldButton>
        )}
      </div>

      {cards.length === 0 && (
        <div className="text-center py-4">
          <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-2)' }}>
            Cards are built from sentences in the document, with one key term blanked out in each.
          </p>
          <button onClick={build} className="px-4 py-2 rounded-full text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
            Build recall cards
          </button>
        </div>
      )}

      {cards.length > 0 && queue === null && (
        <div className="space-y-3">
          <WakeSlider
            ariaLabel="Cards per session"
            min={3} max={12} step={1} value={size} onChange={(v: number) => setSize(Math.round(v))}
            formatValue={(v: number) => `${Math.round(v)} cards`}
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => start(false)} className="px-4 py-2 rounded-full text-[12.5px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
              {dueCards(cards).length ? `Review ${Math.min(size, dueCards(cards).length)} due` : 'Practice anyway'}
            </button>
            <button onClick={() => start(true)} className="px-4 py-2 rounded-full text-[12.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              Practice the oldest first
            </button>
          </div>
        </div>
      )}

      {queue !== null && !finished && card && (
        <BorderGlow
          borderRadius={16}
          glowColor={checked === null ? '270 80 75' : checked ? '140 70 60' : '0 80 62'}
          backgroundColor="var(--bg)"
          className="p-4"
        >
          <div className="flex items-center justify-between text-[10.5px] mb-2" style={{ color: 'var(--text-3)' }}>
            <span>Card {index + 1} of {queue.length}</span>
            <span>{card.reps} reviews · ease {card.ease.toFixed(2)}</span>
          </div>
          <p className="text-[14.5px] leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
            {card.front.split('_____').map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="inline-block min-w-[70px] border-b-2 px-1 text-center font-semibold"
                    style={{ borderColor: checked === null ? 'var(--primary)' : checked ? 'var(--success)' : 'var(--danger)' }}>
                    {checked === null ? '' : card.answer}
                  </span>
                )}
              </React.Fragment>
            ))}
          </p>
          {checked === null && (
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); check() }}>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type the missing term"
                aria-label="Your answer"
                className="flex-1 px-3 py-2 rounded-[11px] outline-none text-[13px]"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
              />
              <button type="submit" disabled={!typed.trim()} className="px-3.5 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#fff' }}>Check</button>
            </form>
          )}
          {checked !== null && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-[12.5px] font-medium mb-1"
                style={{ color: checked ? 'var(--success)' : 'var(--danger)' }}>
                {checked ? <Check size={14} /> : <X size={14} />}
                {checked ? 'Got it.' : `It was “${card.answer}”. You typed “${typed || '—'}”.`}
              </div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{card.context}</p>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {RATINGS.map((r) => (
                  <button key={r.id} onClick={() => rate(r.id)}
                    className="py-2 rounded-[11px] text-left px-2.5 transition-colors hover:bg-[var(--elevated)]"
                    style={{ border: '1px solid var(--surface-border)' }}>
                    <div className="text-[12px] font-medium" style={{ color: r.tone }}>{r.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{r.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </BorderGlow>
      )}

      {finished && (
        <div className="text-center py-3">
          <div className="text-[14px] font-semibold">Session done · {done} cards</div>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            The cards you missed are back in ten minutes. The others return on their own schedule.
          </p>
          <button onClick={() => setQueue(null)} className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <RotateCcw size={12} /> Back to the deck
          </button>
        </div>
      )}

      <AnimatePresence>
        {toastOpen && undo && (
          <motion.div key="undo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[85]">
            <SwipeToast
              open
              title="Card rated"
              description={undo.label}
              actionLabel="Undo"
              onAction={revert}
              onClose={() => setToastOpen(false)}
              duration={6000}
              fuse="bottom"
              width={320}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Feynman                                                             */
/* ------------------------------------------------------------------ */

function FeynmanSession({ doc }: { doc: DocumentRecord }) {
  const terms = useMemo(() => keyTerms(doc.text).filter((t) => t.length >= 4).slice(0, 8), [doc.text])
  const [term, setTerm] = useState(terms[0] ?? '')
  const [confidence, setConfidence] = useState(0)
  const [text, setText] = useState('')
  const [grading, setGrading] = useState(false)
  const [grade, setGrade] = useState<FeynmanGrade | null>(null)

  const excerpt = useMemo(() => {
    const sents = sentences(doc.text)
    const i = sents.findIndex((s) => s.toLowerCase().includes(term.toLowerCase()))
    if (i < 0) return sents.slice(0, 3).join(' ')
    return sents.slice(Math.max(0, i - 1), i + 2).join(' ')
  }, [doc.text, term])

  const words = text.trim().split(/\s+/).filter(Boolean).length
  const ready = words >= 20 && !grading

  const submit = async () => {
    setGrading(true)
    const g = await gradeFeynman(term, excerpt, text)
    setGrade(g)
    setGrading(false)
    awardXp(XP_FOR_FINISHING + Math.round(g.score / 10))
  }

  return (
    <div className="surface p-4 space-y-4">
      <div>
        <div className="text-[13px] font-semibold">Feynman</div>
        <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Pick an idea, read the passage, then explain it as if to someone who has never heard of it.
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {terms.map((t) => (
          <button key={t} onClick={() => { setTerm(t); setGrade(null); setText('') }}
            className="px-2.5 py-1 rounded-full text-[11.5px] transition-colors"
            style={{ background: t === term ? 'var(--primary)' : 'var(--elevated)', color: t === term ? '#fff' : 'var(--text-2)' }}>
            {t}
          </button>
        ))}
      </div>

      <blockquote className="text-[12.5px] leading-relaxed p-3 rounded-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
        {excerpt || 'No passage found for this idea.'}
      </blockquote>

      <div>
        <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--text-2)' }}>How well do you think you know “{term}”?</div>
        <PeekRating value={confidence} onChange={setConfidence} count={5} ariaLabel="Confidence before explaining" showTip labels={['Not at all', 'Vaguely', 'Okay', 'Well', 'Very well']} activeColor="var(--text-1)" idleColor="var(--surface-border)" size={22} />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={`Explain “${term}” in your own words. Aim for at least 20 words.`}
        className="w-full p-3 rounded-[12px] outline-none text-[13px] leading-relaxed resize-y"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}
      />
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={!ready} className="px-4 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {grading ? 'Grading…' : 'Grade my explanation'}
        </button>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>{words} words</span>
      </div>

      {grade && (
        <div className="rounded-[14px] p-4" style={{ background: 'var(--elevated)' }}>
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-semibold tabular-nums" style={{ letterSpacing: '-0.03em' }}>{grade.score}</span>
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>/ 100 · you rated yourself {confidence || '–'}/5</span>
          </div>
          <p className="text-[12.5px] leading-relaxed mt-2">{grade.feedback}</p>
          {grade.covered.length > 0 && (
            <div className="mt-2 text-[11.5px]"><span style={{ color: 'var(--success)' }}>Explained well:</span> {grade.covered.join(', ')}</div>
          )}
          {grade.missing.length > 0 && (
            <div className="mt-1 text-[11.5px]"><span style={{ color: 'var(--warning)' }}>Still missing:</span> {grade.missing.join(', ')}</div>
          )}
          <div className="mt-2 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
            {grade.byModel ? 'Graded by your configured model against the passage.' : 'Graded on this device by checking which key ideas you used. Add a provider for a fuller read.'}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dual coding                                                         */
/* ------------------------------------------------------------------ */

const SYMBOLS: { id: string; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'atom', label: 'Atom', Icon: Atom },
  { id: 'zap', label: 'Energy', Icon: Zap },
  { id: 'waves', label: 'Wave', Icon: Waves },
  { id: 'flame', label: 'Heat', Icon: Flame },
  { id: 'box', label: 'Structure', Icon: Box },
  { id: 'sprout', label: 'Growth', Icon: Sprout },
  { id: 'magnet', label: 'Force', Icon: Magnet },
  { id: 'ruler', label: 'Measure', Icon: Ruler },
  { id: 'compass', label: 'Direction', Icon: Compass },
  { id: 'radar', label: 'Signal', Icon: Radar },
  { id: 'dna', label: 'Code', Icon: Dna },
  { id: 'telescope', label: 'Observe', Icon: Telescope },
  { id: 'brain', label: 'Thought', Icon: Brain },
  { id: 'bulb', label: 'Idea', Icon: Lightbulb },
]

function DualCodeSession({ doc }: { doc: DocumentRecord }) {
  const items: DualItem[] = useMemo(() => dualCodeItems(doc.text, 5), [doc.text])
  const [i, setI] = useState(0)
  const [symbol, setSymbol] = useState<string | null>(null)
  const [picture, setPicture] = useState('')
  const [pairs, setPairs] = useState<{ term: string; symbol: string; picture: string }[]>([])

  if (items.length === 0) return <EmptyNote text="No terms long enough to pair in this document yet." />
  const finished = i >= items.length
  const item = items[i]

  const next = () => {
    if (!symbol || !picture.trim()) return
    setPairs((p) => [...p, { term: item.term, symbol, picture: picture.trim() }])
    awardXp(XP_PER_CORRECT)
    setI((n) => n + 1)
    setSymbol(null)
    setPicture('')
  }

  if (finished) {
    return (
      <div className="surface p-5 space-y-3">
        <div className="text-[14px] font-semibold">{pairs.length} terms paired with pictures</div>
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
          Seeing a word and an image together is what dual coding asks for. Read these back once, covering the words.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {pairs.map((p) => {
            const S = SYMBOLS.find((s) => s.id === p.symbol)?.Icon ?? Shapes
            return (
              <div key={p.term} className="flex items-center gap-3 p-3 rounded-[12px]" style={{ background: 'var(--elevated)' }}>
                <S size={20} strokeWidth={1.6} style={{ color: 'var(--primary)' }} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">{p.term}</div>
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{p.picture}</div>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={() => { setI(0); setPairs([]) }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <RotateCcw size={12} /> Again
        </button>
      </div>
    )
  }

  return (
    <div className="surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} style={{ color: 'var(--primary)' }} />
        <div className="text-[13px] font-semibold">Dual coding · {i + 1} of {items.length}</div>
        <div className="ml-auto h-1 w-28 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(i / items.length) * 100}%`, background: 'var(--primary)' }} />
        </div>
      </div>
      <div>
        <div className="text-[22px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{item.term}</div>
        <p className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--text-3)' }}>{item.definition}</p>
      </div>

      <div>
        <div className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>Pick the picture that stands for it</div>
        <div className="grid grid-cols-7 gap-1.5">
          {SYMBOLS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSymbol(id)} aria-label={label} title={label}
              className="aspect-square rounded-[11px] flex items-center justify-center transition-colors"
              style={{
                background: symbol === id ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--elevated)',
                border: `1px solid ${symbol === id ? 'var(--primary)' : 'transparent'}`,
                color: symbol === id ? 'var(--primary)' : 'var(--text-2)',
              }}>
              <Icon size={16} strokeWidth={1.6} />
            </button>
          ))}
        </div>
      </div>

      <input
        value={picture}
        onChange={(e) => setPicture(e.target.value)}
        placeholder="Describe the picture in one line, e.g. “a coil of wire with current through it”"
        aria-label="Describe the picture"
        className="w-full px-3 py-2 rounded-[11px] outline-none text-[13px]"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
      />
      <button onClick={next} disabled={!symbol || !picture.trim()} className="px-4 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-40"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        {i + 1 === items.length ? 'Finish' : 'Pair it'}
      </button>
    </div>
  )
}
