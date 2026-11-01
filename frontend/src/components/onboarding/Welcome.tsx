// The first screen of first run, laid out as a website rather than a dashboard.
//
// It scrolls: a hero, a short "why" section, the three ways in, and a closing
// section. The only control that moves the wizard forward is the tear ticket at
// the end, so reading the page never starts setup by accident.
import { ParallaxFloating, FloatingItem } from '@/components/ui/kit/community/ParallaxFloating'
import { MarqueeAlongPath } from '@/components/ui/kit/community/MarqueeAlongPath'
import { TextAlongCircle } from '@/components/ui/kit/community/TextAlongCircle'
import { CssBoxHover } from '@/components/ui/kit/community/CssBoxHover'
import { TextHighlighter } from '@/components/ui/kit/community/TextHighlighter'
import { TextRotateCard } from '@/components/ui/kit/community/TextRotateCard'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { BookOpen, ChevronDown, GraduationCap, Hammer, KeyRound, Search, ShieldCheck } from 'lucide-react'
import TearTicket from '@/components/ui/reactbits/micro/TearTicket'
import { ColourfulText } from '@/components/ui/aceternity/ColourfulText'

const DISPLAY = "'Bricolage Grotesque', 'Inter', var(--font-ui), sans-serif"
const GEOMETRIC = "'Plus Jakarta Sans', 'Inter', var(--font-ui), sans-serif"
const INTER = "'Inter', var(--font-ui), sans-serif"

const WHY = [
  { icon: ShieldCheck, title: 'Local-first', text: 'Your chats, notes and keys stay on this device. Nothing is sent until you ask a question.' },
  { icon: KeyRound, title: 'Bring your own key', text: 'Use OpenAI, Anthropic, Gemini or a local model. You pay your provider directly, with no markup.' },
  { icon: BookOpen, title: 'Answers you can check', text: 'Claims link to the sources they came from, and the app says when sources disagree.' },
]

const MODES = [
  { icon: Search, name: 'Research', text: 'Ask a question, search the web or your own files, and get a cited answer.' },
  { icon: GraduationCap, name: 'Learn', text: 'Turn any source into a quiz, a reading path and a spaced review schedule.' },
  { icon: Hammer, name: 'Build', text: 'Start a project, work in coding mode, or hand a task to a bot that keeps going.' },
]

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}

export function Welcome({ onTear }: { onTear: () => void }) {
  const reduce = useReducedMotion()
  // Entrance and scroll reveal are skipped under reduced motion; content is always visible.
  const reveal = (delay = 0): Partial<HTMLMotionProps<'div'>> => (reduce
    ? {}
    : { variants: rise, initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.3 }, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] } })

  return (
    <div className="w-full" style={{ fontFamily: GEOMETRIC }}>
      {/* Hero: fills the first screen. */}
      <section className="min-h-[72vh] flex flex-col items-center justify-center text-center px-4 pb-10">
        <motion.div
          initial={reduce ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 240 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-7"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
        >
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
            <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
          </svg>
        </motion.div>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[52px] sm:text-[64px] leading-[1.02] font-bold max-w-[16ch]"
          style={{ letterSpacing: '-0.035em', fontFamily: DISPLAY }}
        >
          Research Engine
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 text-[20px] sm:text-[22px] font-semibold"
          style={{ letterSpacing: '-0.02em', color: 'var(--text-2)' }}
        >
          The swiss knife of <ColourfulText text="AI Research" />.
        </motion.p>
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 max-w-[52ch] text-[15px] leading-relaxed"
          style={{ color: 'var(--text-3)', fontFamily: INTER }}
        >
          Ask questions, read your own sources, learn from them and build with them. It runs on your machine, and only the calls you choose leave it.
        </motion.p>
        <motion.div
          aria-hidden
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-12 flex flex-col items-center gap-1 text-[11px]"
          style={{ color: 'var(--text-3)' }}
        >
          Scroll
          <ChevronDown size={16} />
        </motion.div>
      </section>

      {/* Parallax floating over a public-domain painting, a marquee, and a few
          quiet cards. The painting is Van Gogh's self-portrait (1887). */}
      <section className="px-4 pb-16 max-w-[980px] mx-auto" aria-label="About this app">
        <ParallaxFloating className="h-[300px] rounded-[18px]" sensitivity={1}>
          <FloatingItem depth={1} className="left-[8%] top-[10%] w-[30%] h-[80%]">
            <img src="/art/van-gogh-self-portrait-1887.jpg" alt="Vincent van Gogh, Self-Portrait (1887), public domain" className="w-full h-full object-cover rounded-[12px]" />
          </FloatingItem>
          <FloatingItem depth={2} className="left-[46%] top-[14%] w-[44%]">
            <CssBoxHover>
              <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>Made to be read slowly</p>
              <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-2)' }}>
                Every choice here is yours to change. <TextHighlighter trigger="scroll">Keep what matters</TextHighlighter>, leave the rest.
              </p>
            </CssBoxHover>
          </FloatingItem>
          <FloatingItem depth={3} className="right-[6%] bottom-[8%]">
            <TextAlongCircle text="Research Engine · local first · your keys · " size={110} />
          </FloatingItem>
        </ParallaxFloating>
        <div className="mt-6">
          <MarqueeAlongPath words={['private', 'local', 'open source', 'your keys', 'your notes']} />
        </div>
        <div className="mt-6 max-w-[560px]">
          <TextRotateCard
            quotes={['Your notes stay on this device.', 'Keys are encrypted and only go to the provider you chose.', 'No telemetry, no analytics, no pings.']}
            author="Research Engine"
          />
        </div>
      </section>

      {/* Why: three short claims, each one a sentence the app keeps. */}
      <section aria-labelledby="welcome-why" className="px-4 py-16 border-t" style={{ borderColor: 'var(--surface-border)' }}>
        <div className="max-w-[1040px] mx-auto">
          <motion.h2 id="welcome-why" {...reveal()} className="text-[30px] sm:text-[36px] font-bold mb-10 max-w-[22ch]"
            style={{ letterSpacing: '-0.03em', fontFamily: DISPLAY }}>
            Private by default. Honest about sources.
          </motion.h2>
          <div className="grid gap-5 md:grid-cols-3">
            {WHY.map((w, i) => (
              <motion.div key={w.title} {...reveal(i * 0.08)} className="rounded-[18px] p-6"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <w.icon size={20} strokeWidth={1.7} style={{ color: 'var(--primary)' }} aria-hidden />
                <h3 className="mt-4 text-[17px] font-semibold" style={{ fontFamily: DISPLAY }}>{w.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-2)', fontFamily: INTER }}>{w.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The three ways in. Plain rows: reading them does nothing. */}
      <section aria-labelledby="welcome-modes" className="px-4 py-16 border-t" style={{ borderColor: 'var(--surface-border)' }}>
        <div className="max-w-[1040px] mx-auto">
          <motion.h2 id="welcome-modes" {...reveal()} className="text-[30px] sm:text-[36px] font-bold mb-8"
            style={{ letterSpacing: '-0.03em', fontFamily: DISPLAY }}>
            Three ways to work
          </motion.h2>
          <ul className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {MODES.map((m, i) => (
              <li key={m.name}>
                <motion.div {...reveal(i * 0.08)} className="grid gap-3 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                  <div className="flex items-center gap-3">
                    <m.icon size={18} strokeWidth={1.7} style={{ color: 'var(--primary)' }} aria-hidden />
                    <span className="text-[22px] sm:text-[26px] font-bold uppercase" style={{ letterSpacing: '-0.02em', fontFamily: DISPLAY }}>{m.name}</span>
                  </div>
                  <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-2)', fontFamily: INTER }}>{m.text}</p>
                </motion.div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The close: the tear ticket is the only way to the next step. */}
      <section aria-labelledby="welcome-start" className="px-4 py-20 border-t flex flex-col items-center text-center" style={{ borderColor: 'var(--surface-border)' }}>
        <motion.h2 id="welcome-start" {...reveal()} className="text-[28px] sm:text-[32px] font-bold"
          style={{ letterSpacing: '-0.03em', fontFamily: DISPLAY }}>
          Ready when you are
        </motion.h2>
        <motion.p {...reveal(0.08)} className="mt-2 max-w-[44ch] text-[14px]" style={{ color: 'var(--text-3)', fontFamily: INTER }}>
          Tear the ticket to set your name, pick a theme and add a key if you have one. You can change any of it later in Settings.
        </motion.p>
        <motion.div {...reveal(0.16)} className="mt-8">
          <TearTicket
            width={320}
            height={120}
            stub={<span className="text-[12px] font-semibold">Tear to start</span>}
            onTear={onTear}
            background="var(--surface)"
            color="var(--text-1)"
            stubBackground="var(--elevated)"
            borderColor="var(--surface-border)"
            ariaLabel="Tear to start setup"
          >
            <div className="p-4 text-left">
              <div className="text-[13px] font-semibold" style={{ fontFamily: DISPLAY }}>Research Engine</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Your local-first AI workspace.</div>
            </div>
          </TearTicket>
        </motion.div>
      </section>
    </div>
  )
}
