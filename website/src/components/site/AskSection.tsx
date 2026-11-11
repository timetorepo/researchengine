/**
 * "Ask it something", the section that holds the animation.
 *
 * It sits directly under the hero because it is the product's whole argument in
 * four seconds: a question is typed, the app reads, the answer arrives word by
 * word with the sources it used underneath. This is the part of the page a
 * visitor is most likely to actually watch, so it says the things a screenshot
 * cannot: where the answer came from, what happens when a source fails, what a
 * reply contains, and what it costs to ask.
 */
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookMarked,
  CircleDollarSign,
  FileSearch,
  Languages,
  ListChecks,
  NotebookPen,
  Quote,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { AskStream, EXCHANGES } from '@/components/site/AskStream'
import { Eyebrow } from '@/components/site/Section'
import { cn } from '@/lib/utils'

/** The three lanes a search actually runs through, and what each one returns. */
const LANES = [
  {
    name: 'Your documents',
    detail: 'searched first, on the machine',
    timing: 'about 12 ms',
    className: 'text-[#86efac]',
  },
  {
    name: 'Wikipedia',
    detail: 'read live, with its licence',
    timing: 'about 40 ms',
    className: 'text-[#93c5fd]',
  },
  {
    name: 'Trusted sources',
    detail: 'the sites you added yourself',
    timing: 'reported per source',
    className: 'text-[#c4b5fd]',
  },
]

/** What comes back with an answer, so nothing about it is a surprise. */
const IN_A_REPLY = [
  { icon: <Quote className="h-3.5 w-3.5" />, label: 'numbered citations' },
  { icon: <BookMarked className="h-3.5 w-3.5" />, label: 'the sources you chose' },
  { icon: <CircleDollarSign className="h-3.5 w-3.5" />, label: 'the tokens it used' },
  { icon: <NotebookPen className="h-3.5 w-3.5" />, label: 'save, or turn into a quiz' },
  { icon: <Languages className="h-3.5 w-3.5" />, label: 'a plain-language rewrite' },
  { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'offline demo, no key needed' },
]

const POINTS = [
  {
    icon: <FileSearch className="h-4 w-4" />,
    title: 'It says where the answer came from',
    body: 'Every reply is built from numbered sources: your documents first, then Wikipedia and the trusted sources you chose. Open one and the page appears beside the answer.',
  },
  {
    icon: <WifiOff className="h-4 w-4" />,
    title: 'It works with the network off',
    body: 'Your library, the reader, the quizzes and searching your own material never need a connection. A source that cannot be reached says so, in a sentence, instead of leaving a blank panel.',
  },
  {
    icon: <ListChecks className="h-4 w-4" />,
    title: 'You keep the working',
    body: 'Answers, summaries and quizzes are saved where you put them. Nothing is filed into an account you cannot see or an export you cannot run.',
  },
]

export function AskSection() {
  const reduced = useReducedMotion()
  const [example, setExample] = useState(0)

  return (
    <section className="scroll-mt-24 pt-0 pb-[clamp(4rem,9vw,7.5rem)]" id="ask">
      <div className="site-shell">
        <div className="hairline" />
        <div className="grid items-start gap-12 pt-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <motion.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, margin: '-60px' }}
            whileInView={{ opacity: 1 }}
          >
            <Eyebrow>Ask it something</Eyebrow>
            <h2 className="text-[clamp(1.6rem,3.4vw,2.35rem)] leading-[1.12] font-semibold [text-wrap:balance]">
              A question in, an answer with its receipts out
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--text-2)]">
              Three real exchanges from the shipped app are playing beside this. Pick one to watch it again.
            </p>

            {/* The example questions drive the animation. */}
            <div className="mt-5 flex flex-col gap-2">
              {EXCHANGES.map((exchange, i) => (
                <button
                  className={cn(
                    'rounded-xl border px-3.5 py-3 text-left text-[13.5px] leading-snug transition-colors',
                    i === example
                      ? 'border-[rgba(124,92,255,0.5)] bg-[rgba(124,92,255,0.14)] text-foreground'
                      : 'border-[var(--surface-border)] text-[var(--text-2)] hover:border-[rgba(124,92,255,0.3)] hover:text-foreground',
                  )}
                  key={exchange.id}
                  onClick={() => setExample(i)}
                  type="button"
                >
                  {exchange.question}
                </button>
              ))}
            </div>

            <ul className="mt-8 space-y-5">
              {POINTS.map((point) => (
                <li className="flex gap-3.5" key={point.title}>
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-white/[0.03] text-[#c4b5fd]">
                    {point.icon}
                  </span>
                  <div>
                    <div className="text-[14px] font-medium">{point.title}</div>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-3)]">{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            animate={{ opacity: 1 }}
            className="lg:pt-10"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : 0.1 }}
            viewport={{ once: true, margin: '-60px' }}
            whileInView={{ opacity: 1 }}
          >
            <AskStream index={example} onIndexChange={setExample} />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="panel p-4">
                <div className="text-[12px] font-medium tracking-[0.14em] text-[var(--text-3)] uppercase">
                  One query, three lanes
                </div>
                <ul className="mt-3 space-y-2.5">
                  {LANES.map((lane) => (
                    <li className="flex items-baseline justify-between gap-3" key={lane.name}>
                      <span>
                        <span className="text-[13px] font-medium">{lane.name}</span>
                        <span className="block text-[11.5px] text-[var(--text-3)]">{lane.detail}</span>
                      </span>
                      <span className={cn('shrink-0 text-[11.5px] tabular-nums', lane.className)}>{lane.timing}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-3)]">
                  A lane that fails reports why it failed, on screen and in the terminal.
                </p>
              </div>

              <div className="panel p-4">
                <div className="text-[12px] font-medium tracking-[0.14em] text-[var(--text-3)] uppercase">
                  What a reply carries
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {IN_A_REPLY.map((item) => (
                    <li
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-[var(--text-2)]"
                      key={item.label}
                    >
                      <span className="text-[#c4b5fd]">{item.icon}</span>
                      {item.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-3)]">
                  Nothing runs on a server of ours, so an answer costs only what your own provider charges for it. With a
                  local model, nothing.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
