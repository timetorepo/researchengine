/**
 * The first screen.
 *
 * Designed against two references the round named: the dark SaaS heroes on
 * Dribbble (type first, one product shot, no decoration pretending to be
 * content) and the Awwwards habit of letting a single line of type carry the
 * whole screen. What that removed, deliberately:
 *
 *   • the row of pills over the headline, which is the shape every generated
 *     landing page opens with. The same three facts are a line of small type,
 *     separated by dots, at the top left;
 *   • the violet glow behind the screenshot and the gradient wordmark. The
 *     picture is framed the way the app frames itself, on a hairline border,
 *     with a plinth rather than a halo;
 *   • the second gradient. One accent, used once, on one phrase.
 *
 * The cloud shader is still the background, still the Aceternity component the
 * round asked for, tuned down to a slow haze; the headline still animates word
 * by word with the SmoothUI depth-parallax component.
 */
import { ArrowRight, Download, Github } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { CloudShader } from '@/components/aceternity/CloudShader'
import DepthParallaxWords from '@/components/smoothui/depth-parallax-words'
import { ButtonLink } from '@/components/ui/button'
import { GalleryButton } from '@/components/site/ScreenshotGallery'
import { INSTALLER_NAMES, RELEASE_ASSET, SOURCE_URL, VERSION, humanSize, useRelease } from '@/lib/release'
import { scrollToSection } from '@/lib/smooth-scroll'

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const { release } = useRelease()
  const reduced = useReducedMotion()
  const windows = release?.installers.find((i) => i.kind === 'windows')
  const portable = release?.portables.find((p) => p.format === 'tar.gz')
  const fact = (value: string) => <span className="text-[var(--text-2)]">{value}</span>

  return (
    <section className="relative isolate overflow-hidden" id="top">
      <div className="absolute inset-0 -z-10">
        <CloudShader
          className="h-full w-full"
          cloudColor="rgba(180,166,255,0.45)"
          count={4}
          skyBottomColor="#08070d"
          skyTopColor="#1b1436"
          speed={0.55}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(115% 90% at 50% 0%, rgba(6,5,11,0.35) 0%, rgba(6,5,11,0.82) 58%, #07060c 100%)',
          }}
        />
      </div>

      <div className="site-shell grid items-center gap-14 pt-[112px] pb-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pt-[136px] lg:pb-28">
        <div>
          <motion.p
            animate={{ opacity: 1 }}
            className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--text-3)]"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {fact('Free and open source')}
            <span aria-hidden>·</span>
            {fact('MIT licence')}
            <span aria-hidden>·</span>
            {fact('Windows and Linux')}
          </motion.p>

          <h1 className="text-[clamp(2.35rem,5.6vw,4rem)] leading-[1.04] font-semibold tracking-[-0.02em]">
            <DepthParallaxWords className="block" delay={120} stagger={85}>
              The research workspace
            </DepthParallaxWords>
            <span className="block">
              that runs on{' '}
              <span className="gradient-text">your computer.</span>
            </span>
          </h1>

          <motion.p
            animate={{ opacity: 1 }}
            className="mt-7 max-w-[34rem] text-[15.5px] leading-relaxed text-[var(--text-2)] sm:text-[16.5px]"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
          >
            Ask a question and get an answer with real sources. Drop in a paper and get a study guide. Keep every page,
            note, quiz and draft in a folder you own. No account, no subscription, nothing sent to us.
          </motion.p>

          <motion.div
            animate={{ opacity: 1 }}
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
          >
            <ButtonLink href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download') }} size="lg">
              <Download className="h-4.5 w-4.5" />
              Download for free
            </ButtonLink>
            <ButtonLink href={SOURCE_URL} rel="noreferrer" size="lg" target="_blank" variant="outline">
              <Github className="h-4.5 w-4.5" />
              Read the code
            </ButtonLink>
          </motion.div>

          <motion.p
            animate={{ opacity: 1 }}
            className="mt-6 text-[12.5px] leading-relaxed text-[var(--text-3)]"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.42, duration: 0.6 }}
          >
            Version {VERSION}
            {windows?.size ? ` · Windows installer ${windows.size}` : ''}
            {portable ? ` · Linux portable ${humanSize(portable.bytes)}` : ''}
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
            {' · '}
            <a
              className="site-link-underline text-[var(--text-2)]"
              href="#features"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('features')
              }}
            >
              see everything it does <ArrowRight className="inline h-3 w-3" />
            </a>
          </motion.p>
        </div>

        <motion.div
          animate={{ opacity: 1 }}
          className="relative"
          initial={{ opacity: 0, y: reduced ? 0 : 18 }}
          transition={{ delay: 0.12, duration: reduced ? 0.2 : 0.8, ease: EASE }}
        >
          {/* A plinth instead of a glow: the picture sits on something. */}
          <div
            aria-hidden
            className="absolute -inset-x-3 top-6 bottom-[-1.25rem] -z-10 rounded-[26px] border border-white/[0.05] bg-white/[0.02]"
          />
          <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0913]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
              <span className="ml-2 truncate text-[11.5px] text-[var(--text-3)]">Research Engine · chats</span>
            </div>
            <img
              alt="Research Engine showing a list of chats, coding sessions and research conversations"
              className="block w-full"
              height={675}
              src="/shots/shot-1.webp"
              width={900}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <GalleryButton index={0}>See all 4 screenshots</GalleryButton>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
