import { ArrowRight, Download, Github, MonitorPlay, ShieldCheck, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { CloudShader } from '@/components/aceternity/CloudShader'
import DepthParallaxWords from '@/components/smoothui/depth-parallax-words'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { INSTALLER_NAMES, RELEASE_ASSET, SOURCE_URL, VERSION, humanSize, useRelease } from '@/lib/release'
import { scrollToSection } from '@/lib/smooth-scroll'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The first screen. The clouds are the Aceternity cloud-shader, tuned to the
 * same violet the app's own screenshots use; the headline animates word by word
 * with the SmoothUI depth-parallax component, which is what it was picked for.
 */
export function Hero() {
  const { release } = useRelease()
  const windows = release?.installers.find((i) => i.kind === 'windows')
  const portable = release?.portables.find((p) => p.format === 'tar.gz')

  return (
    <section className="relative isolate overflow-hidden pt-[68px]" id="top">
      <div className="absolute inset-0 -z-10">
        <CloudShader
          className="h-full w-full"
          cloudColor="rgba(196,181,253,0.55)"
          count={5}
          skyBottomColor="#0b0913"
          skyTopColor="#241a4d"
          speed={0.75}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, rgba(7,6,12,0.15) 0%, rgba(7,6,12,0.72) 55%, #07060c 100%)',
          }}
        />
      </div>

      <div className="site-shell grid items-center gap-14 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
        <div>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center gap-2"
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <Badge tone="brand">
              <Sparkles className="h-3.5 w-3.5" />
              Free and open source
            </Badge>
            <Badge>MIT licence</Badge>
            <Badge>Windows &amp; Linux</Badge>
          </motion.div>

          <h1 className="text-[clamp(2.4rem,6vw,4.1rem)] leading-[1.02] font-semibold">
            <DepthParallaxWords className="block" delay={120} stagger={85}>
              The research workspace
            </DepthParallaxWords>
            <span className="gradient-text">that runs on your computer.</span>
          </h1>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-[var(--text-2)] sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.25, duration: 0.6, ease: EASE }}
          >
            Ask a question and get an answer with real sources. Drop in a paper and get a study guide. Keep every page,
            note, quiz and draft in a folder you own. No account, no subscription, nothing sent to us.
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.35, duration: 0.6, ease: EASE }}
          >
            <ButtonLink href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download') }} size="lg">
              <Download className="h-4.5 w-4.5" />
              Download for free
            </ButtonLink>
            <ButtonLink
              href={SOURCE_URL}
              rel="noreferrer"
              size="lg"
              target="_blank"
              variant="outline"
            >
              <Github className="h-4.5 w-4.5" />
              Read the code
            </ButtonLink>
          </motion.div>

          <motion.div
            animate={{ opacity: 1 }}
            className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--text-3)]"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> No account, no tracking
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MonitorPlay className="h-3.5 w-3.5" /> Works offline to look around
            </span>
            <a
              className="site-link-underline inline-flex items-center gap-1.5 text-[var(--text-2)]"
              href="#features"
              onClick={(e) => { e.preventDefault(); scrollToSection('features') }}
            >
              See everything it does <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </motion.div>

          <p className="mt-6 text-[12.5px] text-[var(--text-3)]">
            Version {VERSION}
            {windows?.size ? ` · Windows installer ${windows.size}` : ''}
            {portable ? ` · portable ${humanSize(portable.bytes)}` : ''}
            {windows ? (
              <>
                {' · '}
                <a
                  className="site-link-underline text-[var(--text-2)]"
                  href={windows.href || RELEASE_ASSET(INSTALLER_NAMES.windows)}
                >
                  direct download
                </a>
              </>
            ) : null}
          </p>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          className="relative"
          initial={{ opacity: 0, y: 30, rotate: 1.4 }}
          transition={{ delay: 0.15, duration: 0.9, ease: EASE }}
        >
          <div className="glow-ring overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0913]">
            <img
              alt="Research Engine showing a list of chats, coding sessions and research conversations"
              className="block w-full"
              height={675}
              src="/shots/shot-1.webp"
              width={900}
            />
          </div>
          <div className="pointer-events-none absolute -inset-x-10 -bottom-10 h-24 blur-2xl" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(124,92,255,0.35), transparent)' }} />
        </motion.div>
      </div>
    </section>
  )
}
