/**
 * "Ask it something", the section that holds the animation.
 *
 * It sits directly under the hero because it is the product's whole argument in
 * four seconds: a question is typed, the app reads, the answer arrives word by
 * word with the sources it used underneath. The copy beside it says the things
 * the animation cannot show — where the answer came from, and what happens when
 * a source fails.
 */
import { motion, useReducedMotion } from 'motion/react'
import { FileSearch, ListChecks, WifiOff } from 'lucide-react'
import { AskStream } from '@/components/site/AskStream'
import { Eyebrow } from '@/components/site/Section'

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
  return (
    <section className="site-section scroll-mt-24 pt-0" id="ask">
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
            className="lg:pt-14"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : 0.1 }}
            viewport={{ once: true, margin: '-60px' }}
            whileInView={{ opacity: 1 }}
          >
            <AskStream />
            <p className="mt-3 text-center text-[12px] text-[var(--text-3)]">
              Three real exchanges, replaying. The app itself runs offline.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
