/**
 * Ask something, watch it answer.
 *
 * The animation the round asked for: a question types itself into the app's own
 * composer, the app thinks for a beat, and the answer streams back with the
 * sources it used. It loops through three real exchanges from the shipped build,
 * so a visitor who does nothing still sees what using the thing is like.
 *
 * The answer itself is drawn by Aceternity's typewriter effect (vendored as
 * `@/components/aceternity/TypewriterEffect`), which is the one place on this
 * page where a character-by-character reveal is the point rather than
 * ornamentation. Because that component only starts when it scrolls into view,
 * the current exchange is also written into an `sr-only` block: a screen reader
 * (and the site test) reads the words even when the animation has not played.
 *
 * A visitor who asked for reduced motion gets the first exchange in full and no
 * timers at all.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CornerDownLeft, Paperclip, Search, Sparkles } from 'lucide-react'
import { TypewriterEffect } from '@/components/aceternity/TypewriterEffect'
import { cn } from '@/lib/utils'

interface Exchange {
  id: string
  question: string
  answer: string
  sources: { label: string; note: string }[]
}

export const EXCHANGES: Exchange[] = [
  {
    id: 'sleep',
    question: 'Does sleep debt actually reverse on the weekend, and what does the evidence say?',
    answer:
      'Partly, and not in the way the phrase suggests. Recovery sleep restores alertness and reaction time within a night or two, but studies of habitually short sleepers show metabolic and inflammatory markers that stay elevated after a weekend of long sleep. The reading is not well described as a debt being repaid.',
    sources: [
      { label: 'Your library', note: 'van Dongen 2003, pdf' },
      { label: 'Wikipedia', note: 'Sleep debt, 42 ms' },
      { label: 'Saved page', note: 'saved 3 days ago' },
    ],
  },
  {
    id: 'method',
    question: 'Turn this paper into a study guide for tomorrow morning.',
    answer:
      'Done. Six questions came out of the text itself: two on the method, two on the results, one on the limitation the authors name, and one ordering the analysis steps. The reading view is open beside them, and the whole thing exports as a PDF if you want it on paper.',
    sources: [
      { label: 'Reading view', note: 'the paper, in place' },
      { label: 'Quiz', note: '6 questions, 2 min' },
      { label: 'No upload', note: 'never left the device' },
    ],
  },
  {
    id: 'update',
    question: 'What changed in the last update, and is my library safe?',
    answer:
      'The search now reports why a source failed instead of showing an empty panel, and the exit animation hides the text it was typing. Your library was not part of the swap: updates replace the code, verify the download against its published fingerprint first, and put the old version back if the new one cannot start.',
    sources: [
      { label: 'Release notes', note: 'v0.40.0-beta.1' },
      { label: 'Checksum', note: 'verified before unpacking' },
      { label: 'Rollback', note: 'automatic' },
    ],
  },
]

/** How long a typed question takes, and how long to wait once an answer lands. */
const TYPE_MS = 26
const THINK_MS = 700
const HOLD_MS = 4200

export function AskStream({
  className,
  index: indexProp,
  onIndexChange,
}: {
  className?: string
  /** Controlled from outside (`AskSection`'s example questions). */
  index?: number
  onIndexChange?: (index: number) => void
}) {
  const reduced = useReducedMotion()
  const [ownIndex, setOwnIndex] = useState(0)
  const index = indexProp ?? ownIndex
  const setIndex = (next: number | ((i: number) => number)) => {
    const value = typeof next === 'function' ? next(index) : next
    if (indexProp === undefined) setOwnIndex(value)
    onIndexChange?.(value)
  }
  const [typed, setTyped] = useState(reduced ? EXCHANGES[0].question.length : 0)
  const [phase, setPhase] = useState<'asking' | 'thinking' | 'answering'>(reduced ? 'answering' : 'asking')
  const timers = useRef<number[]>([])

  const exchange = EXCHANGES[index]

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  // One timer chain per exchange: type the question, think, answer, wait, next.
  useEffect(() => {
    if (reduced) return
    clear()
    setTyped(0)
    setPhase('asking')

    const chars = exchange.question.length
    let step = 0
    const type = () => {
      step += 1
      setTyped(step)
      if (step < chars) {
        timers.current.push(window.setTimeout(type, TYPE_MS))
        return
      }
      timers.current.push(
        window.setTimeout(() => {
          setPhase('thinking')
          timers.current.push(
            window.setTimeout(() => {
              setPhase('answering')
              timers.current.push(
                window.setTimeout(() => setIndex((i) => (i + 1) % EXCHANGES.length), HOLD_MS),
              )
            }, THINK_MS),
          )
        }, 320),
      )
    }
    timers.current.push(window.setTimeout(type, 260))

    return clear
  }, [exchange.question, index, reduced])

  const answerWords = useMemo(() => exchange.answer.split(' ').map((text) => ({ text })), [exchange.answer])

  return (
    <div className={cn('panel relative overflow-hidden p-4 sm:p-5', className)}>
      {/* The composer, exactly as the app draws it: attachments, a prompt, a send key. */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[rgba(8,7,14,0.72)] px-3 py-2.5">
        <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
        <p className="min-h-[22px] flex-1 text-[13.5px] leading-relaxed text-[var(--text-2)]">
          {exchange.question.slice(0, typed)}
          {phase === 'asking' && !reduced ? (
            <motion.span
              animate={{ opacity: [1, 0.15, 1] }}
              className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-[#c4b5fd]"
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          ) : null}
        </p>
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(124,92,255,0.35)] bg-[rgba(124,92,255,0.14)] text-[#c4b5fd]">
          <CornerDownLeft className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* The answer. */}
      <div className="mt-4 min-h-[132px]">
        {phase === 'asking' ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--text-3)]">
            <Search className="h-3.5 w-3.5" />
            Searching your documents, Wikipedia and the sources you trust
          </p>
        ) : null}

        {phase === 'thinking' ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--text-3)]">
            <Sparkles className="h-3.5 w-3.5 text-[#c4b5fd]" />
            <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.3, repeat: Infinity }}>
              Reading three sources
            </motion.span>
          </p>
        ) : null}

        {phase === 'answering' ? (
          <div key={exchange.id}>
            <TypewriterEffect
              className="max-w-none text-left text-[13.5px] leading-relaxed font-normal sm:text-[14px] md:text-[14.5px] lg:text-[14.5px]"
              cursorClassName="h-4 w-[2px] bg-[#c4b5fd]"
              words={answerWords}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {exchange.sources.map((source, i) => (
                <motion.span
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-white/5 px-2.5 py-1 text-[11.5px] text-[var(--text-2)]"
                  initial={{ opacity: 0 }}
                  key={source.label}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                >
                  <span className="text-[#c4b5fd]">{i + 1}</span>
                  {source.label}
                  <span className="text-[var(--text-3)]">{source.note}</span>
                </motion.span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* What the animation is showing, in words, for anyone not watching it. */}
      <p className="sr-only">
        For example: {exchange.question} {phase === 'answering' ? exchange.answer : ''}
      </p>

      <div className="mt-3 flex items-center justify-between text-[11.5px] text-[var(--text-3)]">
        <span>{exchange.sources.length} sources, cited</span>
        <span className="flex items-center gap-1.5">
          {EXCHANGES.map((item, i) => (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i === index ? 'bg-[#c4b5fd]' : 'bg-white/15',
              )}
              key={item.id}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
