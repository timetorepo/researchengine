import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight, ArrowLeft, Check, KeyRound, Rocket, ShieldCheck, BookOpen, Lock, HardDrive, Sparkles,
  Layers, LayoutGrid, Gift, Send,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, applyTheme } from '@/lib/themes/meta'
import { Button } from '@/components/ui/heroui/Button'
import { Input } from '@/components/ui/heroui/Input'
import { AuroraBackground } from '@/components/ui/aceternity/AuroraBackground'
// SmoothUI (shadcn registry, github.com/educlopez/smoothui) — installed under
// src/components/smoothui and used for real here: the promises build in the
// centre, the repo stars count up, the connection test prints into a terminal,
// the demo contents open out of a folder.
import KineticCenterBuild from '@/components/smoothui/kinetic-center-build'
import TypewriterText from '@/components/smoothui/typewriter-text'
import StaggerFromEdges from '@/components/smoothui/stagger-from-edges'
import MacTerminal, { type TerminalLine } from '@/components/smoothui/mac-terminal'
import FolderReveal from '@/components/smoothui/folder-reveal'
import GitHubStarsAnimation from '@/components/smoothui/github-stars-animation'
// React Bits, vendored from the published source (see the provenance line in
// each file under components/ui/reactbits/micro), each on the step it was asked for.
import TearTicket from '@/components/ui/reactbits/micro/TearTicket'
import StarBorder from '@/components/ui/reactbits/micro/StarBorder'
import CrystalizedBall from '@/components/ui/reactbits/micro/CrystalizedBall'
import InfiniteSpiral from '@/components/ui/reactbits/micro/InfiniteSpiral'
import MaskedHeading from '@/components/ui/reactbits/micro/MaskedHeading'
import FlowingMenu from '@/components/ui/reactbits/micro/FlowingMenu'
// R16 — the rest of the Aceternity set, each on the step it was picked for.
// Provenance and digests: frontend/scripts/aceternity-sources.json.
import { ColourfulText } from '@/components/ui/aceternity/ColourfulText'
import { ContainerTextFlip } from '@/components/ui/aceternity/ContainerTextFlip'
// The canvas reveal brings three.js with it (~880 kB, its own chunk). The
// modes step is the second screen of a first run, so it is loaded when that
// step is reached rather than when the wizard opens — and if it never arrives
// (a slow disk, a machine with no WebGL) the step still looks finished, because
// the fallback below is the same dot field drawn with plain CSS.
const LazyCanvasReveal = React.lazy(() =>
  import('@/components/ui/aceternity/CanvasRevealEffect').then((m) => ({ default: m.CanvasRevealEffect })))
import { DottedGlowBackground } from '@/components/ui/aceternity/DottedGlowBackground'
import { Carousel as AppleCarousel, Card as AppleCardView } from '@/components/ui/aceternity/AppleCardsCarousel'
import { ONBOARDING_FEATURES } from '@/components/onboarding/onboarding-features'
import { PAID_APPS, Favicon } from '@/components/onboarding/paid-apps'
import { MultiStepLoader } from '@/components/ui/aceternity/MultiStepLoader'
import { beginHandoff } from '@/lib/ui/handoff'
import { runChat } from '@/lib/chat/runChat'
import { PROVIDERS } from '@/lib/providers/registry'
import { refreshProviderModels } from '@/lib/providers/refresh'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { testConnection } from '@/lib/providers/stream'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { setVaultPassphrase } from '@/lib/crypto/session'
import type { ThemeId } from '@/types'
import { clsx } from 'clsx'

/** The wallpapers the first-run spiral travels through (served from /public). */
const SPIRAL_ITEMS = [
  '/wallpapers/glaze-1.webp', '/wallpapers/chromatic-dark-1.webp', '/wallpapers/glass-rainbow.webp',
  '/wallpapers/mono-dark-1.webp', '/wallpapers/red-distortion-1.webp', '/wallpapers/loupe-mono-dark.webp',
  '/wallpapers/chromatic-dark-2.webp', '/wallpapers/mono-dark-2.webp', '/wallpapers/red-distortion-4.webp',
  '/wallpapers/chromatic-light-2.webp',
]

/**
 * The rounds of first run.
 *
 * Five steps used to carry a user to a finished install and stop there. That
 * is a tour of the settings, not of the app: the user still had to find out
 * what Research Engine is for. So the middle of the wizard now shows the thing
 * itself — the modes, the features, and what it costs compared with the apps
 * it replaces — and the last step asks a real question and runs it. `cta`
 * marks the steps that advance with the footer button (the welcome, the demo
 * and the final step carry their own), `skip` adds the second, quieter button
 * for the one step that is genuinely optional.
 */
interface StepMeta {
  label: string
  cta: boolean
  skip?: string
}

const STEPS: StepMeta[] = [
  { label: 'Welcome', cta: false },
  { label: 'Privacy', cta: true },
  { label: 'Modes', cta: true },
  { label: 'Features', cta: true },
  { label: 'Free', cta: true },
  { label: 'Provider', cta: true, skip: 'Skip for now' },
  { label: 'Try the demo', cta: false },
  { label: 'Setting up', cta: false },
  { label: "You're set", cta: false },
]

const LAST = STEPS.length - 1

/** Suggestions for the first run, written the way a person asks, not prompts. */
const FIRST_QUESTIONS = [
  'Explain CRISPR like I have an exam tomorrow',
  'Compare Rust and Go for a CLI tool',
  'What changed in fusion energy this year?',
]

export function Onboarding() {
  const settings = useStore((s) => s.settings)
  const ui = useUI()
  const [step, setStep] = useState(0)

  const [theme, setTheme] = useState<ThemeId>(settings.theme)
  const [provider, setProvider] = useState<string>('openai')
  const [apiKey, setApiKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [testState, setTestState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const lowRam = typeof navigator !== 'undefined' && (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory <= 8
  const [eco, setEco] = useState(lowRam)
  const [firstPrompt, setFirstPrompt] = useState('')
  /**
   * The "setting up" step.
   *
   * The animation is the visible half; the work underneath is real. Each state
   * below is backed by something that actually runs when the step opens: the
   * theme is applied, the settings are written and read back, the local server
   * is asked for its health, the key (if one was given) is tested against the
   * provider, and the model list is fetched. The step finishes when both halves
   * are done, so the animation can never claim more than happened.
   */
  const [setupAnimDone, setSetupAnimDone] = useState(false)
  const [setupWorkDone, setSetupWorkDone] = useState(false)
  const [setupNotes, setSetupNotes] = useState<string[]>([])
  const setupStarted = React.useRef(false)
  const SETUP_STATES = [
    { text: 'Applying your theme and motion settings' },
    { text: 'Writing your settings to this device' },
    { text: 'Reading them back to be sure' },
    { text: apiKey.trim() ? `Verifying your key with ${PROVIDERS.find((p) => p.id === provider)?.name ?? provider}` : 'Waking the local demo model' },
    { text: apiKey.trim() ? 'Fetching the models your key can reach' : 'Preparing the offline demo library' },
    { text: 'Ready' },
  ]

  const runSetup = async () => {
    const note = (t: string) => setSetupNotes((n) => [...n, t])
    try {
      applyTheme(theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion })
      note('theme applied')
      const probe = { re: 'setup-probe', at: Date.now() }
      localStorage.setItem(probe.re, String(probe.at))
      const readBack = Number(localStorage.getItem(probe.re)) === probe.at
      localStorage.removeItem(probe.re)
      note(readBack ? 'settings stored' : 'settings could not be stored — the app may not remember this session')
      await new Promise((r) => setTimeout(r, 260))
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3500) })
        note(res.ok ? 'local server is up' : `local server answered ${res.status}`)
      } catch { note('local server not reachable right now — the app runs offline anyway') }
      if (apiKey.trim()) {
        try {
          const ms = await testConnection(provider, apiKey)
          note(`key verified (${ms}ms)`)
          // The models themselves are fetched at the end of onboarding, when
          // the key has been written to the store (finish() below) — asking a
          // provider for its catalogue before we have saved anything would
          // read a key that is not there yet.
        } catch (e: any) {
          note(`key check failed: ${String(e?.message ?? e).slice(0, 60)}`)
        }
      } else {
        note('local demo model ready')
      }
      note('done')
    } finally {
      setSetupWorkDone(true)
    }
  }

  useEffect(() => {
    if (step !== 7 || setupStarted.current) return
    setupStarted.current = true
    void runSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Both halves must finish before the step offers to move on, and the pointer
  // does not jump: the button appears where the eye already is.
  const setupReady = setupAnimDone && setupWorkDone

  useEffect(() => { applyTheme(theme, {}) }, [theme])

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const runTest = async () => {
    setTestState('busy'); setTestMsg('')
    try {
      const ms = await testConnection(provider, apiKey)
      setTestState('ok'); setTestMsg(`Connected — ${ms}ms`)
    } catch (e: any) {
      setTestState('err'); setTestMsg(e?.message ?? 'Connection failed')
    }
  }

  const finish = async () => {
    const patch: any = { theme, performanceProfile: eco ? 'eco' : 'balanced' }
    if (apiKey.trim()) {
      let stored = apiKey.trim()
      if (passphrase.length >= 4) {
        setVaultPassphrase(passphrase)
        stored = await encryptWithPassphrase(apiKey.trim(), passphrase)
        patch.passphraseSet = true
      }
      patch.providers = { ...settings.providers, [provider]: { apiKey: stored, baseUrl: '', enabled: true } }
    }
    if (apiKey.trim()) {
      // Fetch the provider's live model list and adopt the first model —
      // names are never hardcoded.
      refreshProviderModels(provider)
        .then((models) => {
          if (models[0]) useStore.setState((s) => ({ settings: { ...s.settings, defaultModel: `${provider}:${models[0]}` } }))
        })
        .catch(() => { /* user can pick a model from the picker later */ })
    }
    patch.onboarded = true
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
    applyTheme(theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion })
    ui.toast('Welcome to Research Engine', apiKey ? 'Your key is encrypted and stored locally.' : 'Running on the local demo model — add a key anytime.', 'success')
  }

  const tryDemo = () => {
    // persist theme now, mark onboarded, then hand off to the reader demo.
    // NOTE: Onboarding renders OUTSIDE the HashRouter — set the hash directly;
    // the router mounts after this component unmounts and picks it up.
    localStorage.setItem('re.quiz.autodemo', '1')
    window.location.hash = '#/quiz'
    useStore.setState((s) => ({ settings: { ...s.settings, theme, performanceProfile: eco ? 'eco' : 'balanced', onboarded: true } }))
    applyTheme(theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion })
  }

  /**
   * The last step runs a real question.
   *
   * "Just go and run it" is the whole point of the extra steps, so the end of
   * onboarding is not a summary screen with a button on it — it is the app,
   * already working. The prompt is handed to the chat pages exactly the way
   * the home screen hands one over (lib/ui/handoff), so the very first answer
   * arrives through the same blur-in transition every later answer will use.
   */
  const runFirst = (prompt: string) => {
    const text = prompt.trim()
    if (!text) return
    const id = useStore.getState().newChat()
    beginHandoff(id, text)
    // Onboarding renders outside the HashRouter (see tryDemo) — set the hash
    // first, then mark it done; the router mounts once this unmounts.
    window.location.hash = `#/chat/${id}`
    void finish()
    void runChat({ chatId: id, prompt: text, mode: {} })
  }

  /**
   * What the connection test is actually doing, printed line by line. The
   * terminal replays from scratch whenever the provider, the key or the result
   * changes (`key` below), so the lines on screen are never stale.
   */
  const terminalLines: TerminalLine[] = [
    { id: 'cmd', type: 'command', text: `research-engine connect --provider ${provider}`, delay: 260 },
    { id: 'url', type: 'comment', text: `# ${PROVIDERS.find((p) => p.id === provider)?.baseUrl ?? ''}` },
    {
      id: 'key',
      type: 'output',
      text: apiKey
        ? `key ${apiKey.slice(0, 4)}…${apiKey.slice(-4)} → kept on this device`
        : 'no key yet — the local demo model answers until you add one',
    },
    ...(testState === 'busy'
      ? [{ id: 'busy', type: 'output' as const, text: 'dialling the endpoint…' }]
      : []),
    ...(testState === 'ok'
      ? [{ id: 'ok', type: 'success' as const, text: testMsg }]
      : []),
    ...(testState === 'err'
      ? [{ id: 'err', type: 'error' as const, text: testMsg || 'connection failed' }]
      : []),
  ]

  const fade = {
    initial: { opacity: 0, scale: 0.99 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.01 },
  }

  /**
   * A transform-free fade, for the carousel step only.
   *
   * An opened Apple Card is `position: fixed`. Any transform on an ancestor —
   * including the scale in `fade` — makes that ancestor the containing block,
   * so the card would open inside the scrolling step instead of over the app.
   * Fading with opacity alone leaves the stack free of transforms.
   */
  const still = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  }

  const isCarousel = STEPS[step].label === 'Features'

  const body = [
    /* 0 — Welcome */
    <div key="s0" className="text-center max-w-[520px] mx-auto">
      <div className="relative inline-flex items-center justify-center mb-6">
        {/* A faceted crystal behind the mark — decorative, and it holds still
            under reduced motion. */}
        <div className="absolute -inset-6 opacity-60">
          <CrystalizedBall size={104} />
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="relative inline-flex items-center justify-center w-16 h-16 rounded-[20px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
            <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
            <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
          </svg>
        </motion.div>
      </div>
      <h1 className="text-[30px] font-bold leading-tight" style={{ letterSpacing: '-0.03em' }}>Research Engine</h1>
      {/* Aceternity's Colourful Text, on the one line that should be colourful:
          the letters of "AI Research" step through the ramp on a beat, and
          reduce-motion gets the sentence once, in colour, holding still. */}
      <h2 className="mt-2.5 text-[17px] font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--text-2)' }}>
        The swiss knife of <ColourfulText text="AI Research" />.
      </h2>
      {/* the three promises build word-by-word in the centre, hold, then hand over */}
      <KineticCenterBuild
        phrases={[
          'Perplexity-level answers.',
          'Zero data leaves your device.',
          'Only the calls you aim leave.',
        ]}
        interval={2400}
        className="text-[15.5px] mt-3.5 min-h-[48px] max-w-[460px] mx-auto leading-relaxed"
      />
      <div className="flex flex-wrap justify-center gap-2 mt-5">
        {['Local-first', 'BYOK providers', 'Master Prompts', 'New Tech mode', 'Learn', 'Agent Flood'].map((t, i) => (
          <motion.span key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="px-3 py-1 rounded-full text-[11.5px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
            {t}
          </motion.span>
        ))}
      </div>
      {/* real star count from the GitHub API; renders nothing at all when the
          machine is offline, so no invented numbers on an offline-first app */}
      <div className="mt-6 flex justify-center">
        <GitHubStarsAnimation owner="timetorepo" repo="researchengine" maxAvatars={5} />
      </div>
      <div className="mt-2 h-[16px] text-[11.5px] font-mono" style={{ color: 'var(--text-3)' }}>
        <TypewriterText speed={34}>local-first · bring your own key · works offline</TypewriterText>
      </div>
      {/* The first-run heading wipes on with a travelling mask. */}
      <div className="mt-5 text-[13px]" style={{ color: 'var(--text-2)' }}>
        <MaskedHeading text="Pick where to start" mediaType="image" src="/wallpapers/glaze-1.webp" />
      </div>
      {/* Flowing Menu: each row is a way in. Its items are links, so one click
          handler on the wrapper turns any of them into "continue". */}
      <div className="mt-2 flex justify-center h-[200px] w-full max-w-[560px] mx-auto"
        onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) { e.preventDefault(); next() } }}>
        <FlowingMenu items={[
          { link: '#research', text: 'Research', image: '/wallpapers/glaze-1.webp' },
          { link: '#learn', text: 'Learn', image: '/wallpapers/chromatic-dark-1.webp' },
          { link: '#build', text: 'Build', image: '/wallpapers/mono-dark-1.webp' },
        ]} />
      </div>
      <div className="mt-6 flex justify-center">
        {/* StarBorder is the requested frame for the get-started button: a border
            traced by travelling stars rather than a static outline. */}
        <StarBorder onClick={next} className="w-52 h-12">
          Get started <ArrowRight size={15} />
        </StarBorder>
      </div>
      {/* A tear-off ticket as a second, more playful way into the app: drag the
          stub down to open Research Engine. The same action as the button, but
          it earns a moment of attention on a first run. */}
      <div className="mt-5 flex justify-center">
        <TearTicket
          width={320}
          height={120}
          stub={<span className="text-[12px] font-semibold">Tear to open</span>}
          onTear={next}
          background="var(--surface)"
          color="var(--text-1)"
          stubBackground="var(--elevated)"
          borderColor="var(--surface-border)"
          ariaLabel="Tear to open Research Engine"
        >
          <div className="p-4 text-left">
            <div className="text-[13px] font-semibold">Research Engine</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Your local-first AI workspace.</div>
          </div>
        </TearTicket>
      </div>
      {/* Infinite Spiral: the app's own wallpapers travel round a helix. It is
          the visual for the first run, and it holds still under reduce-motion. */}
      <div className="mt-6 h-[300px] w-full max-w-[560px] mx-auto">
        <InfiniteSpiral
          items={SPIRAL_ITEMS}
          radius={150}
          cardWidth={96}
          cardHeight={96}
          verticalSpacing={54}
          cardsPerTurn={7}
          cardRadius={14}
          edgeFade={0.35}
          grayscale={0.2}
        />
      </div>
    </div>,

    /* 1 — Privacy */
    <div key="s1" className="max-w-[560px] mx-auto">
      <StepHeader icon={ShieldCheck} title="Your privacy, enforced by architecture" sub="Not a promise — a design constraint. There is no server to leak from." />
      <div className="space-y-2 mb-6">
        {[
          { icon: HardDrive, t: 'Everything is stored in your browser', d: 'Chats, documents, quizzes and settings live in local storage. Export or wipe them anytime from Settings → Data.' },
          { icon: Lock, t: 'API keys never touch our code paths', d: 'Keys are encrypted with AES-GCM when you set a passphrase, and are only ever sent to the provider you chose.' },
          { icon: ShieldCheck, t: 'No telemetry, no analytics, no pings', d: 'Even update checks only run when you press the button yourself.' },
        ].map((r, i) => (
          <motion.div key={r.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.09 }}
            className="flex items-start gap-3 p-3.5 rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
              <r.icon size={15} strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[13px] font-medium">{r.t}</div>
              <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>{r.d}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <StaggerFromEdges className="block text-[11px] uppercase tracking-wider mb-2" triggerOnView={false} stagger={0.012}>
        {`While you're here — pick a theme`}
      </StaggerFromEdges>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={clsx('p-2.5 rounded-[12px] text-left transition-all hover:scale-[1.02]')}
            style={{ border: `1.5px solid ${theme === t.id ? 'var(--primary)' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
            <div className="flex gap-1 mb-1.5">
              {t.swatches.map((c, i) => <span key={i} className="w-4 h-4 rounded-[5px]" style={{ background: c }} />)}
            </div>
            <div className="text-[11px] font-medium flex items-center gap-1">{t.name} {theme === t.id && <Check size={10} style={{ color: 'var(--primary)' }} />}</div>
          </button>
        ))}
      </div>
    </div>,

    /* 2 — Modes: what you ask for, in plain words */
    <div key="s2" className="max-w-[640px] mx-auto">
      <StepHeader icon={Layers} title="One app, every mode" sub="Say what you want in a sentence — a mode is a click, not a configuration." />
      <div className="relative overflow-hidden rounded-[20px] mb-3" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }}>
        {/* Aceternity's Canvas Reveal Effect: the dot matrix the words flip on.
            Local patches: it pauses itself the moment the step scrolls away,
            settles into a still grid when the machine asks for less motion or
            when the frame budget says this machine is struggling, and it
            streams in (with the CSS dot field as its fallback) so the step's
            text never waits for a WebGL context. */}
        <React.Suspense fallback={<StaticDotField />}>
          <LazyCanvasReveal
            animationSpeed={3.4}
            colors={[[99, 102, 241], [45, 212, 191]]}
            containerClassName="bg-transparent"
            dotSize={2.6}
          />
        </React.Suspense>
        <div className="relative px-6 py-12 text-center">
          <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-2)' }}>Ask it to</p>
          {/* Aceternity's Container Text Flip — one slot, one mode at a time,
              sized to the widest word so the line never jumps. */}
          <ContainerTextFlip
            interval={2600}
            className="mx-auto"
            textClassName="text-[21px] font-semibold"
            words={['read a 60-page paper', 'build a quiz from it', 'search with citations', 'write and run code', 'flood a topic with agents']}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { t: 'Learn', d: 'Drop in a PDF, get a reader and a quiz' },
          { t: 'Search', d: 'SearXNG by itself, citations attached' },
          { t: 'New Tech', d: 'Cheap, fast models answer first' },
          { t: 'Coding', d: 'Parallel agents, inline multi-file edits' },
          { t: 'Agent Flood', d: 'A checklist of agents on one question' },
          { t: 'Master Prompts', d: 'Your own rules, applied everywhere' },
        ].map((m, i) => (
          <motion.div key={m.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }}
            className="p-3 rounded-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="text-[12.5px] font-medium">{m.t}</div>
            <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{m.d}</div>
          </motion.div>
        ))}
      </div>
    </div>,

    /* 3 — Features: the drawn-card carousel */
    <div key="s3" className="max-w-[760px] mx-auto">
      <StepHeader icon={LayoutGrid} title="What's inside" sub="Six things this app does, that usually take six subscriptions. Tap a card to open it." />
      {/* Aceternity's Apple Cards Carousel. Local patch: no stock photography —
          every card face is a small diagram drawn from this app's variables. */}
      <div className="-mx-6">
        <AppleCarousel items={ONBOARDING_FEATURES.map((card, i) => (
          <AppleCardView key={card.title} card={card} index={i} />
        ))} />
      </div>
      <p className="text-[11.5px] mt-3 text-center" style={{ color: 'var(--text-3)' }}>Drag it sideways — every card opens on a tap.</p>
    </div>,

    /* 4 — Free, unlike these apps */
    <div key="s4" className="max-w-[660px] mx-auto">
      <StepHeader icon={Gift} title="The same job, without the bill" sub="Each of these apps does what Research Engine does. Every one of them charges by the month." />
      <div className="relative overflow-hidden rounded-[20px] p-4 sm:p-5" style={{ border: '1px solid var(--surface-border)', background: 'var(--elevated)' }}>
        {/* Aceternity's Dotted Glow Background, themed by variable rather than
            by a `.dark` class — this app has thirteen themes, not two. */}
        <DottedGlowBackground
          className="absolute inset-0"
          colorLightVar="--text-3"
          colorDarkVar="--text-3"
          glowColorLightVar="--primary"
          glowColorDarkVar="--primary"
          opacity={0.45}
          backgroundOpacity={0}
          speedScale={0.8}
        />
        <div className="relative grid grid-cols-2 gap-2">
          {PAID_APPS.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              className="flex items-start gap-2.5 p-2.5 rounded-[13px]"
              style={{ background: 'color-mix(in srgb, var(--surface) 86%, transparent)', border: '1px solid var(--surface-border)' }}>
              <Favicon app={a} />
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate">{a.name}</div>
                <div className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>{a.does}</div>
                <div className="text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded-full inline-block"
                  style={{ background: 'color-mix(in srgb, var(--warning) 16%, transparent)', color: 'var(--text-2)' }}>{a.price}</div>
              </div>
            </motion.div>
          ))}
          {/* the eighth tile, so the grid has no hole in it: this app */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="flex items-start gap-2.5 p-2.5 rounded-[13px]"
            style={{ background: 'color-mix(in srgb, var(--success) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--success) 34%, transparent)' }}>
            <span className="inline-flex items-center justify-center shrink-0 rounded-[11px]" style={{ width: 38, height: 38, background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden>
                <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
                <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-medium truncate">Research Engine</div>
              <div className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>Everything above, on your own machine</div>
              <div className="text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded-full inline-block"
                style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--text)' }}>free</div>
            </div>
          </motion.div>
        </div>
        <div className="relative mt-4 flex items-center justify-center gap-2.5 rounded-[14px] px-4 py-3.5"
          style={{ background: 'color-mix(in srgb, var(--success) 12%, var(--surface))', border: '1px solid color-mix(in srgb, var(--success) 32%, transparent)' }}>
          <Sparkles size={15} style={{ color: 'var(--success)' }} />
          <span className="text-[14.5px] font-semibold">ResearchEngine is free, unlike these apps.</span>
        </div>
      </div>
      <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        Free means the app is free. If you connect a provider you pay that provider, never us — and a local model costs nothing at all.
        Their icons are bundled as drawings: nothing on this screen pings those companies.
      </p>
    </div>,

    /* 5 — Provider (skippable) */
    <div key="s5" className="max-w-[520px] mx-auto">
      <StepHeader icon={KeyRound} title="Bring your own key" sub="Optional — everything works on the local demo model until you're ready." />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PROVIDERS.filter((p) => p.id !== 'custom').map((p) => (
          <button key={p.id} onClick={() => { setProvider(p.id); setTestState('idle'); setTestMsg('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all"
            style={{
              border: `1px solid ${provider === p.id ? 'var(--primary)' : 'var(--surface-border)'}`,
              background: provider === p.id ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--surface)',
              color: provider === p.id ? 'var(--primary)' : 'var(--text-2)',
            }}>
            <ProviderLogo id={p.id} size={13} /> {p.name}
          </button>
        ))}
      </div>

      {PROVIDERS.find((p) => p.id === provider)?.needsKey ? (
        <div className="space-y-3">
          <Input label="API key" type="password" value={apiKey} onChange={(v) => { setApiKey(v); setTestState('idle') }}
            placeholder={`${provider} key — stays on this device`} />
          <Input label="Vault passphrase (recommended)" type="password" value={passphrase} onChange={setPassphrase}
            description="Encrypts your key with AES-GCM. Min 4 characters; skip to store unencrypted." />
          <div className="flex items-center gap-3">
            <Button variant="flat" size="sm" onClick={runTest} isLoading={testState === 'busy'} disabled={!apiKey}>
              Test connection
            </Button>
            {testState === 'ok' && <span className="text-[12px] flex items-center gap-1" style={{ color: 'var(--success)' }}><Check size={12} /> {testMsg}</span>}
            {testState === 'err' && <span className="text-[12px] truncate" style={{ color: 'var(--danger)' }}>{testMsg}</span>}
          </div>
          {/* the real request/response, typed out — not a mock */}
          <MacTerminal
            key={`${provider}-${testState}-${apiKey.length}`}
            autoPlay
            lines={terminalLines}
            maxHeight={190}
            theme="auto"
            title="connection test"
            typingSpeed={12}
          />
        </div>
      ) : (
        <div className="p-4 rounded-[14px] text-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <ShieldCheck size={15} className="inline mr-1.5" style={{ color: 'var(--success)' }} />
          {provider === 'ollama' ? 'No key needed. Research Engine will find your local models via /api/tags.' : 'No key needed for this endpoint.'}
        </div>
      )}
    </div>,

    /* 6 — Try the demo */
    <div key="s6" className="max-w-[520px] mx-auto text-center">
      <StepHeader icon={BookOpen} title="See it working — no key required" sub="A bundled study demo: a genuine DNA primer, AI study rewrite, three-tier highlights, and a hand-tuned quiz. Fully offline." />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-[18px] p-5 text-left mb-5 flex flex-col sm:flex-row items-center gap-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {/* the four things in the demo, literally in a folder — hover to open it */}
        <FolderReveal
          className="shrink-0"
          color="brand"
          items={[
            { id: 'pipeline', content: <CardText t="3-stage pipeline" />, color: 'color-mix(in srgb, var(--primary) 14%, var(--surface))' },
            { id: 'reader', content: <CardText t="720px reader" />, color: 'color-mix(in srgb, var(--success) 14%, var(--surface))' },
            { id: 'rewrite', content: <CardText t="AI study rewrite" />, color: 'color-mix(in srgb, var(--secondary) 14%, var(--surface))' },
            { id: 'quiz', content: <CardText t="Hand-tuned quiz" />, color: 'color-mix(in srgb, var(--warning) 16%, var(--surface))' },
          ]}
          label="DNA demo"
          rotation={9}
          size={232}
          trigger="hover"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-medium mb-1.5">“The Structure of DNA” demo</div>
          <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> Scripted Parsing → Extracting → Analyzing run</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> Serif reader with progress rail and annotations</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> AI study rewrite, toggle back to the original</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> Premium quiz with explanations and source jumps</li>
          </ul>
        </div>
      </motion.div>
      <div className="flex justify-center gap-2">
        <Button size="md" onClick={tryDemo} startContent={<BookOpen size={15} />}>Open the reading demo</Button>
        <Button variant="ghost" size="md" onClick={next}>Later</Button>
      </div>
    </div>,

    /* 7 — Setting up */
    <div key="s7" className="max-w-[560px] mx-auto text-center">
      {!setupAnimDone || !setupWorkDone ? (
        <MultiStepLoader loadingStates={SETUP_STATES} loading duration={640} onDone={() => setSetupAnimDone(true)} />
      ) : null}
      <StepHeader icon={Rocket} title="Setting things up" sub="A few real checks before the app hands over. Nothing here leaves the device." />
      <div className="mt-4 flex flex-col gap-1.5 text-left max-w-[420px] mx-auto">
        {setupNotes.map((n, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 text-[12px]">
            <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--text-2)' }}>{n}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 h-9">
        {setupReady && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Button size="md" onClick={next}>Continue <ArrowRight size={13} className="inline" /></Button>
          </motion.div>
        )}
      </div>
    </div>,

    /* 8 — You're set */
    <div key="s8" className="text-center max-w-[480px] mx-auto">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 240 }}
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
        style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)' }}>
        <Check size={26} style={{ color: 'var(--success)' }} />
      </motion.div>
      <h2 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>You're set</h2>
      <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Theme: <b>{THEMES.find((t) => t.id === theme)?.name}</b> ·
        Model: <b>{apiKey ? PROVIDERS.find((p) => p.id === provider)?.name : 'Local demo'}</b>
      </p>
      <StaggerFromEdges className="block text-[12.5px] mt-3.5" stagger={0.016} triggerOnView={false}>
        {'Everything is ready. Nothing you typed left this device.'}
      </StaggerFromEdges>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
        <Sparkles size={12} /> Try typing <code className="px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--elevated)' }}>-404</code> sometime.
      </div>
      <button onClick={() => setEco(!eco)}
        className="mt-5 mx-auto flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] text-left max-w-[380px]"
        style={{ border: `1.5px solid ${eco ? 'var(--success)' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
        <span className="relative w-9 h-5 rounded-full transition-colors shrink-0"
          style={{ background: eco ? 'var(--success)' : 'var(--elevated)' }}>
          <span className="absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all" style={{ left: eco ? 18 : 2 }} />
        </span>
        <span>
          <span className="block text-[12.5px] font-medium">Eco mode{lowRam ? ' (recommended here)' : ''}</span>
          <span className="block text-[10.5px]" style={{ color: 'var(--text-3)' }}>1 stream at a time, lighter background work{lowRam ? ' — this machine reports 8 GB RAM or less' : ''}</span>
        </span>
      </button>
      {/* "Just go and run it": the wizard ends by running something. Type a
          question here and it opens as a real chat, on the demo model if no
          key was given, through the same handover the home screen uses. */}
      <div className="mt-6 text-left rounded-[16px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="text-[12.5px] font-medium mb-2">Ask your first question</div>
        <div className="flex items-center gap-2">
          <input
            value={firstPrompt}
            onChange={(e) => setFirstPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runFirst(firstPrompt) }}
            placeholder="What should I look into first?"
            aria-label="Your first question"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] px-3 py-2.5 rounded-[11px]"
            style={{ background: 'var(--elevated)' }}
          />
          <Button size="md" onClick={() => runFirst(firstPrompt)} disabled={!firstPrompt.trim()} startContent={<Send size={14} />}>
            Run it
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {FIRST_QUESTIONS.map((q) => (
            <button key={q} onClick={() => setFirstPrompt(q)}
              className="px-2.5 py-1 rounded-full text-[11.5px] text-left transition-colors hover:opacity-80"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              {q}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          Runs on {apiKey.trim() ? `your ${PROVIDERS.find((p) => p.id === provider)?.name} key` : 'the local demo model'} — no key needed to try.
        </p>
      </div>
      <div className="mt-4">
        <Button size="lg" fullWidth onClick={finish} startContent={<Rocket size={16} />}>
          Enter Research Engine
        </Button>
      </div>
    </div>,
  ]

  return (
    // First-run only, and it must sit above the shell: a fixed overlay, never
    // something that can grow the page underneath it.
    <div className="fixed inset-0 z-[70]">
    <AuroraBackground className="h-full w-full">
      <div className="h-full flex flex-col">
        {/* progress */}
        <div className="flex items-center justify-center gap-1.5 pt-8">
          {STEPS.map((s, i) => (
            <button key={s.label} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.label}`} title={s.label}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 28 : 8, background: i <= step ? 'var(--primary)' : 'var(--elevated)' }} />
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 overscroll-contain">
          <div className="min-h-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={isCarousel ? still : fade}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="w-full py-8"
              >
                {body[step]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* footer nav */}
        <div className="flex items-center justify-between px-8 pb-8 max-w-[720px] mx-auto w-full">
          {step > 0 && step < LAST ? (
            <Button variant="ghost" color="default" size="sm" onClick={back} startContent={<ArrowLeft size={13} />}>Back</Button>
          ) : <span />}
          {STEPS[step].cta ? (
            <div className="flex items-center gap-2">
              {STEPS[step].skip && <Button variant="ghost" color="default" size="sm" onClick={next}>{STEPS[step].skip}</Button>}
              <Button size="sm" onClick={next}>Continue <ArrowRight size={13} className="inline" /></Button>
            </div>
          ) : <span />}
        </div>
      </div>
    </AuroraBackground>
    </div>
  )
}

/** The canvas reveal's stand-in: the same dot field, drawn with CSS only. */
function StaticDotField() {
  return (
    <div
      aria-hidden
      className="h-full w-full"
      style={{
        backgroundImage: 'radial-gradient(var(--primary) 1.4px, transparent 1.4px)',
        backgroundSize: '14px 14px',
        opacity: 0.22,
      }}
    />
  )
}

function CardText({ t }: { t: string }) {
  return (
    <span className="flex h-full w-full items-center justify-center p-3 text-center text-[11.5px] font-medium leading-snug"
      style={{ color: 'var(--text)' }}>
      {t}
    </span>
  )
}

function StepHeader({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="mb-5 text-left">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <h2 className="text-[20px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
      </div>
      <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{sub}</p>
    </div>
  )
}
