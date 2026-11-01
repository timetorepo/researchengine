import { motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, FolderLock, Server, Wifi } from 'lucide-react'
import MacTerminal from '@/components/smoothui/mac-terminal'
import { Eyebrow } from '@/components/site/Section'
import { TERMINAL_LINES } from '@/data/terminal'
import { VERSION } from '@/lib/release'

const POINTS = [
  {
    icon: <Server className="h-4 w-4" />,
    title: 'One process, one port',
    body: 'The same engine serves the window, the API and your library. Close the window and the server goes with it.',
  },
  {
    icon: <FolderLock className="h-4 w-4" />,
    title: 'The database is a file',
    body: 'SQLite, inside your library folder. Back it up by copying it. Nothing to export, nothing to lose.',
  },
  {
    icon: <Wifi className="h-4 w-4" />,
    title: 'It keeps working offline',
    body: 'Your documents, saved pages, reading, quizzes and search of your own material never need a connection.',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'Failures say why',
    body: 'A source that cannot be reached reports the reason in a sentence, in the terminal and on screen, instead of a blank panel.',
  },
]

/**
 * The backend, shown rather than described: SmoothUI's mac-terminal typing real
 * output from this build.
 *
 * Three things were fixed here after a visitor sent a screenshot of it. The
 * terminal is short (a proof, not a scrollback) and it loops, so the last line
 * is never a stranded prompt. The eyebrow is a line of type rather than a pill,
 * because a pill above a two-line headline is what overlapped it. And the two
 * columns are top-aligned, so the terminal cannot stretch to the height of the
 * copy beside it.
 */
export function Backend() {
  const reduced = useReducedMotion()
  return (
    <section className="site-section scroll-mt-24" id="backend">
      <div className="site-shell grid items-start gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <motion.div
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1 }}
        >
          <Eyebrow>The engine is real</Eyebrow>
          <h2 className="text-[clamp(1.6rem,3.6vw,2.5rem)] leading-[1.1] font-semibold [text-wrap:balance]">
            Under the window, a research engine you can talk to
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            You never have to open a terminal to use Research Engine. It is here because a local-first app should be able
            to prove itself: the server, the search and the updater all answer on the same port, on your machine.
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {POINTS.map((point) => (
              <li className="flex gap-3" key={point.title}>
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
          className="w-full max-w-[560px] lg:justify-self-end"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 0.08 }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1 }}
        >
          <MacTerminal
            className="w-full"
            lines={TERMINAL_LINES.map((line) => ({ ...line, text: line.text.replace('{{VERSION}}', VERSION) }))}
            loop
            maxHeight={236}
            prompt="you@laptop research ~ %"
            theme="dark"
            title="research-engine: serve"
            typingSpeed={12}
          />
          <p className="mt-3 text-[12px] text-[var(--text-3)]">
            Shortened output from this build. It plays again when it reaches the end.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
