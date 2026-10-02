import { motion } from 'motion/react'
import { CheckCircle2, FolderLock, Server, Wifi } from 'lucide-react'
import MacTerminal from '@/components/smoothui/mac-terminal'
import { Badge } from '@/components/ui/badge'
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
 * The backend, shown rather than described: SmoothUI's mac-terminal, typing real
 * output from this build (see src/data/terminal.ts).
 */
export function Backend() {
  return (
    <section className="site-section scroll-mt-24" id="backend">
      <div className="site-shell grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Badge className="mb-5" tone="green">
            The engine is real
          </Badge>
          <h2 className="text-[clamp(1.75rem,4vw,2.6rem)] leading-[1.1] font-semibold">
            Under the window, a research engine you can talk to
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            You never have to open a terminal to use Research Engine. It is here because a local-first app should be able
            to prove itself: the server, the search and the updater all answer on the same port, on your machine.
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {POINTS.map((point) => (
              <li className="flex gap-3" key={point.title}>
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-white/5 text-[#c4b5fd]">
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
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <MacTerminal
            className="w-full"
            lines={TERMINAL_LINES.map((line) => ({ ...line, text: line.text.replace('{{VERSION}}', VERSION) }))}
            maxHeight={420}
            prompt="you@laptop research ~ %"
            theme="dark"
            title="research-engine — serve — 80×24"
            typingSpeed={14}
          />
          <div
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] blur-3xl"
            style={{ background: 'radial-gradient(50% 60% at 50% 50%, rgba(124,92,255,0.22), transparent)' }}
          />
        </motion.div>
      </div>
    </section>
  )
}
