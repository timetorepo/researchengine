import React, { useEffect, useState } from 'react'
import {
  Github, ShieldCheck, ExternalLink, Sparkles, RefreshCw, CheckCircle2, Heart, Scale,
  Layers, Component, AlertTriangle, Eraser, ClipboardList, Copy,
} from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Button } from '@/components/ui/heroui/Button'
import { UserAvatar } from '@/components/shared/UserAvatar'

/** Injected by Vite from package.json — never drifts from the shipped build. */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'
/** Version + build stamp of the bundle you are looking at right now. */
export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
const REPO = 'https://github.com/timetorepo/researchengine'

interface ServerWeb {
  served: { version: string; buildId: string; builtAt: string } | null
  source: string
  mode?: 'checkout' | 'portable'
}

/**
 * "Why is my self-hosted copy still showing the old thing?"
 *
 * The server knows two versions: the one baked into the built frontend it is
 * serving, and the one declared by the code in the checkout. When those differ
 * — or when the bundle in this tab is older than the one on disk — the app says
 * so with the exact command that fixes it, instead of leaving you to guess.
 */
function StaleBuildCard() {
  const ui = useUI()
  const [web, setWeb] = useState<ServerWeb | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.web) setWeb(d.web as ServerWeb) })
      .catch(() => { /* a self-host without the API still renders the page */ })
    return () => { live = false }
  }, [])

  const serverHandled = web?.served && web.served.version !== web.source
  const browserStale = !!web?.served && web.served.version !== APP_VERSION
  if (dismissed || (!serverHandled && !browserStale)) return null

  const hardRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch { /* best effort */ }
    ui.toast('Caches cleared', 'Reloading the newest build…', 'success')
    setTimeout(() => window.location.reload(), 400)
  }

  return (
    <div className="surface p-4 mb-4" style={{ borderColor: 'color-mix(in srgb, var(--warning) 45%, var(--surface-border))' }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
        <div className="text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text)' }}>This self-hosted copy is running an older build.</b>
          {web?.served && browserStale && (
            <p className="mt-1">The server offers <span className="font-mono">{web.served.version}</span> but this page is running <span className="font-mono">{APP_VERSION}</span> — your browser (or a cached service worker) is still holding the old bundle.</p>
          )}
          {serverHandled && (
            <p className="mt-1">The built frontend on disk is <span className="font-mono">{web?.served?.version}</span>, while the code in this checkout is <span className="font-mono">{web?.source}</span>.</p>
          )}
          {web?.mode === 'portable' ? (
            <>
              <p className="mt-1.5">This is a portable build, so updating means replacing the folder: download the current archive from the repository’s <a href={`${REPO}/tree/main/downloads`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>downloads folder</a>, unpack it over this one, and restart the launcher.</p>
            </>
          ) : (
            <>
              <p className="mt-1.5">In the folder you cloned, run:</p>
              <pre className="mt-1 px-2.5 py-2 rounded-[8px] text-[11.5px] overflow-x-auto" style={{ background: 'var(--elevated)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>git pull && npm install && npm run build</pre>
              <p className="mt-1.5">…then restart the server.</p>
            </>
          )}
          <p className="mt-1.5">If it still looks old, clear the cached app shell:</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button onClick={hardRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px]" style={{ background: 'var(--primary)', color: '#fff' }}>
              <Eraser size={13} /> Clear cache &amp; reload
            </button>
            <button onClick={() => setDismissed(true)} className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Hide this</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The UI component libraries the interface is assembled from. */
const UI_LIBRARIES: { name: string; href: string; author?: string; used: string }[] = [
  { name: 'ReactBits', href: 'https://reactbits.dev', used: 'Animated counters and the magnetic buttons' },
  { name: 'HeroUI', href: 'https://www.heroui.com', used: 'Button, Input and Switch primitives' },
  { name: 'Aceternity UI', href: 'https://ui.aceternity.com', used: 'Aurora background, moving borders, spotlight cards, text-generate effect' },
  { name: 'Border Beam', href: 'https://beam.jakubantalik.com', author: 'Jakub Antalik', used: 'The travelling light around the home-screen chatbox' },
  { name: 'Orbs', href: 'https://orbs.jakubantalik.com', author: 'Jakub Antalik', used: 'The thinking indicator and streaming marker' },
  { name: 'Blobatar', href: 'https://blobatar.dev', author: 'Alain', used: 'Your profile avatar, drawn from your handle' },
]

const RUNTIME_LIBRARIES = ['React', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Zustand', 'Lucide', 'KaTeX', 'react-markdown', 'JSZip']

export function AboutTab() {
  const ui = useUI()
  const profile = useStore((s) => s.settings.profile)
  const [checking, setChecking] = useState(false)
  const [latest, setLatest] = useState<string | null>(null)

  const checkUpdates = async () => {
    setChecking(true)
    setLatest(null)
    try {
      const res = await fetch(`${REPO.replace('github.com', 'api.github.com/repos')}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const tag = (data.tag_name as string | undefined) ?? null
      setLatest(tag)
      if (tag && tag !== `v${APP_VERSION}`) {
        ui.toast('Update available', `${tag} is out — you are on v${APP_VERSION}.`, 'success')
      } else {
        ui.toast('Up to date', `You are running the latest release (v${APP_VERSION}).`, 'success')
      }
    } catch {
      ui.toast('Check failed', 'Could not reach the release server. Your offline copy keeps working.', 'warning')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="max-w-[680px]">
      {/* Header ------------------------------------------------------- */}
      <div className="flex items-center gap-3 mb-6">
        <AppLogo size={40} withName={false} />
        <div>
          <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Research Engine</h2>
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
            Version {APP_VERSION} · build {BUILD_ID.includes('+') ? BUILD_ID.split('+')[1].replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4h') : 'local'} · self-hosted · privacy-first
          </p>
        </div>
      </div>

      {/* Stale self-hosted build? ------------------------------------ */}
      <StaleBuildCard />

      {/* Who made it -------------------------------------------------- */}
      <div className="surface p-4 mb-4">
        <div className="flex items-start gap-3">
          <Heart size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
          <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <b style={{ color: 'var(--text)' }}>Made by dnishh</b>
              <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--primary)' }}>
                source <ExternalLink size={10} />
              </a>
            </div>
            <p>
              Research Engine is built in the open by <b style={{ color: 'var(--text)' }}>dnishh</b> — a
              one-person project with no company behind it, no funding, and no roadmap dictated by an
              investor. Ideas, bug reports and pull requests all arrive through the repository and shape
              what gets built next.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-3 pl-7">
          {typeof profile?.name === 'string' && <UserAvatar size={30} />}
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            You are running this copy yourself. Settings → Profile is where your own face and handle live.
          </div>
        </div>
      </div>

      {/* Privacy promise --------------------------------------------- */}
      <div className="surface p-4 mb-4 flex items-start gap-3">
        <ShieldCheck size={18} style={{ color: 'var(--success)' }} className="shrink-0 mt-0.5" />
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text)' }}>The promise:</b> all your data stays local. Only outbound API calls to
          providers you configure ever leave this device. No telemetry, no analytics, no update pings —
          update checks only run when you press the button.
        </div>
      </div>

      {/* What it is --------------------------------------------------- */}
      <div className="surface p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Component size={15} style={{ color: 'var(--primary)' }} />
          <div className="text-[13px] font-medium">What this is</div>
        </div>
        <div className="space-y-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <p>A self-hosted research platform with Perplexity-level answer quality — built for researchers, scientists, students, and privacy-conscious power users.</p>
          <p>Versioned Master Prompts, the AIFlowEngine optimization layer, New Tech (Replication) mode, SkillBuilder, Agent Flood orchestration, the Read &amp; Quiz studio with automatic step formatting, articles with AI images, citation management, and a fully themeable interface including the Perplexity-inspired theme.</p>
        </div>
      </div>

      {/* UI components ------------------------------------------------- */}
      <div className="surface p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={15} style={{ color: 'var(--primary)' }} />
          <div className="text-[13px] font-medium">UI components used</div>
        </div>
        <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
          The interface is assembled from these libraries. Each one is credited to the people who built it.
        </p>
        <div className="space-y-2.5">
          {UI_LIBRARIES.map((lib) => (
            <div key={lib.name} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--primary)' }} />
              <div className="text-[12.5px] leading-relaxed">
                <a href={lib.href} target="_blank" rel="noreferrer" className="font-medium inline-flex items-center gap-1" style={{ color: 'var(--text)' }}>
                  {lib.name} <ExternalLink size={10} style={{ color: 'var(--text-3)' }} />
                </a>
                {lib.author && <span style={{ color: 'var(--text-3)' }}> by {lib.author}</span>}
                <div style={{ color: 'var(--text-2)' }}>{lib.used}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 text-[11.5px] leading-relaxed" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
          Runtime: {RUNTIME_LIBRARIES.join(', ')}.
        </div>
      </div>

      {/* License ------------------------------------------------------- */}
      <div className="surface p-4 mb-4 flex items-start gap-3">
        <Scale size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <b style={{ color: 'var(--text)' }}>MIT License</b>
            <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--primary)' }}>
              read it <ExternalLink size={10} />
            </a>
          </div>
          <p>
            Research Engine is free and open source under the MIT License. Use it, fork it, ship it inside
            your own product, sell it — the only requirement is that the copyright notice and permission
            notice travel with the copy. The bundled libraries above keep their own MIT / Apache-2.0
            licenses.
          </p>
        </div>
      </div>

      {/* Diagnostics ---------------------------------------------------- */}
      <DiagnosticsCard />

      {/* Actions ------------------------------------------------------- */}
      <div className="flex gap-2 flex-wrap mb-6">
        <a href={REPO} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Github size={14} /> GitHub <ExternalLink size={11} />
        </a>
        <button onClick={checkUpdates} disabled={checking}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-[13px] disabled:opacity-50"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking…' : latest ? `Latest: ${latest}` : 'Check for updates'}
        </button>
        {latest && <span className="flex items-center gap-1 text-[12px] self-center" style={{ color: 'var(--success)' }}><CheckCircle2 size={13} /> checked</span>}
        <Button variant="flat" size="md" startContent={<Sparkles size={14} />}
          onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, onboarded: false } }))}>
          Run setup again
        </Button>
      </div>

      {/* Changelog ----------------------------------------------------- */}
      <div className="pt-4 text-[11px] leading-relaxed" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
        <div className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>Changelog</div>
        <p><b>0.22.0-beta.1 — Everything answers your pointer:</b> the quiz is now a card worth looking at — source and length pills over a big centred title, a hairline rule, the question, "Choose only 1 answer:", then full-width option rows with a radio ring that glows where your cursor is. Options are dealt in one after another, the right answer sweeps green and springs its tick on, a wrong one shakes, and <b>1–6</b> answers with <b>Space</b> moving on. Navigating any page is wrapped in a <b>view transition</b>: the rail and top bar hold still, the page cross-fades in, the active marker slides between rows, and every icon arrives on a 260ms curve — 45ms apart in a stack. Hovering an expanded rail row now lifts it, and the "New research" button has a slow sheen. Workflows move too: cards are dealt in, nodes lift and breathe while a run is live, a finished node pops its tick, and the connector you point at lights up and offers its "+". <b>Fix:</b> a duplicate focus timer rendered below the app frame could make the document taller than the window and leave the workflow page unable to scroll back, with the timer stranded at the very bottom (it survived a refresh). The timer now exists once, in the top bar, the app frame clips anything left in its flow, and if you pan the canvas away from your nodes a <b>"Back to the workflow"</b> chip brings them back.</p>
        <p><b>0.21.1-beta.1 — Coding mode works on Windows:</b> every project path was checked with a POSIX <code>/</code> separator, which never matches a Windows path (<code>C:\…\projects\demo</code> vs <code>C:\…\projects/</code>). On Windows that made the IDE treat every project folder as invalid — creating one answered <code>500 Cannot read properties of null (reading 'name')</code>, and the sample button failed with it. Path containment now uses <code>relative()</code> (plus a separator- and case-aware fallback), the create route can no longer depend on a path helper returning a value, and the same fix covers files, the file explorer's root and the preview's static server. Python projects also preview on Windows now: <code>python3</code> is <code>python</code> or <code>py</code> there, and if no interpreter exists the preview falls back to serving the files instead of failing. The diagnostics report now names your OS, browser, and the server's platform.</p>
        <p className="mt-1.5"><b>0.21.0-beta.1 — A dock, alive toasts, and a timer that knows what you are doing:</b> the collapsed sidebar is now a <b>dock</b> — point at an icon and it swells while its neighbours lean away and its name flies out beside it. Toasts are drawn by <b>Sonner</b> (Emil Kowalski): hover to pause the countdown, stack and collapse, swipe to dismiss — with the same blurred glass card the app already used (it follows Appearance → Glass mode), one tone-coloured icon and a quiet X. The <b>privacy shield</b> and the <b>focus timer</b> moved from the sidebar footer to the top bar, and the timer's pill now <b>morphs into a rounded block</b> showing the time left with pause/play — and it says what it is timing: <b>Quiz</b> while a quiz is open, <b>Coding</b> while a project is, <b>Reading</b> in read mode. New <b>Settings → Developer</b>: a Developer Mode switch (build fingerprint in the top bar, raw error detail) and a <b>test bench</b> that creates a project and the sample app with the real code path, prints the request/status/response and deletes what it made — so "it still doesn't work" becomes a report you can copy.</p>
        <p className="mt-1.5"><b>0.20.0-beta.1 — Reading that responds, and an assistant that verifies:</b> selecting text in Read mode now paints the highlight immediately — the mark animates on like a marker being drawn — with a chip for the things you actually want next (quiz this passage, undo). Paragraphs settle in as pages rather than popping, paragraphs you jump to pulse once, annotation dots spring in, and the progress rail glides; every bit of it stands down under reduce-motion. Creating a project can no longer be refused for its name: an empty or unusable name is named for you, a taken name is freed up, and the sample button retries instead of erroring. Coding mode now ships <b>house rules</b> — no invented APIs, paths or test results, no filler or placeholder code, a numeric design bar (contrast ≥ 4.5:1, 4px spacing rhythm, 44px targets, 150–300ms motion), and proof via real commands. Plus three new skills: <b>UI/UX design pass</b>, <b>Zero-hallucination pass</b> and <b>No-filler implementation</b>.</p>
        <p className="mt-1.5"><b>0.19.0-beta.1 — Clean steps, faces and beams:</b> step-by-step and <code>:dot:</code> text is formatted by the app at display time — <code>:dot:</code> lines, “Step 2 —” runs and repeated <code>1.</code> numbering become real numbered steps and nested bullets across Read &amp; Quiz and the reading chatbox, with no extra model call. A local Humanize pass rewrites answers on-device (code left untouched, clipped rewrites flagged), the sample app and project names work first try, IDE file tabs stop duplicating, and theme gradients animate into place when you switch palettes. New: a profile editor whose avatar is a blobatar drawn from your handle, Border Beam around the home composer, Orbs for the thinking state, this About page, and an MIT license. Settings → About now fingerprints the build and names any stale self-hosted copy, with a one-click cache clear.</p>
        <p className="mt-1.5"><b>0.14.0-beta.1 — Continuity &amp; automation:</b> AIFlowEngine becomes a true streaming engine — raw bursts buffered and re-timed into composed word-by-word prose (Off / Subtle / Standard / Cinematic), with punctuation pauses, whole-line code reveals, stall detection, and a breathing-orb thinking indicator that names the actual pipeline stage. Route-level code splitting cuts the initial bundle by 47%. A new Workflows surface chains triggers, AI steps, logic, transforms and outputs into automations that execute for real — infinite canvas, cmdk node picker, slide-over config with live node testing, run history, log and data inspector, 8 templates, and secret-scrubbed <code>.workflow.json</code> sharing. A filesystem integration writes real files into the Research Engine data directory. Plus a full product README and app-wide motion standardization.</p>
        <p className="mt-1.5"><b>0.13.0-beta.1 — Lightweight runtimes:</b> Docker is now optional. A single-process server (<code>npm start</code>) serves the API, streams and the built frontend on :3847 with automatic port picking; a portable-binary packager (<code>npm run package:binary</code>, Bun compile supported); a Tauri 2 desktop scaffold; PWA install with an offline app shell; startup profiles (eco / balanced / performance) with a live resource panel in Settings → Performance; a standard data directory at <code>~/.research-engine</code>; and an optional slim single-image Docker path with resource limits.</p>
        <p className="mt-1.5">0.12.0-beta.1 — The Refinement: versioned Master Prompts; New Tech (Replication) mode; rebuilt Read &amp; Quiz studio; premium quizzes; AI article images; Perplexity-inspired theme; command palette; ZIP export and merge-import.</p>
        <p className="mt-1.5">0.11.0-beta.1 — The working version: Agent Flood runs real parallel agents on configured models with real synthesis and live token/budget accounting; web search runs real engines and grounds answers in numbered citations; navigation hardening; error boundary.</p>
        <p className="mt-1.5">0.10.0-beta.1 — Onboarding flow, custom backgrounds (solid / image / blur / veil), UI component libraries, adaptive context pruning.</p>
        <p className="mt-1.5">0.9.0 — Agent Flood scratchpad, ResearchEngineOS Dynamic Island, citation export formats.</p>
      </div>
    </div>
  )
}

/**
 * Everything we would otherwise have to ask you for.
 *
 * When a message appears that we cannot find anywhere in the code (say, a
 * notification about character limits that no release ever shipped), this is how
 * we find out what actually said it: the build fingerprint, whether a service
 * worker is holding an old bundle, and every notification this session raised,
 * in order, with the exact wording.
 */
function DiagnosticsCard() {
  const ui = useUI()
  const notices = useUI((s) => s.notices)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const sw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? (navigator.serviceWorker.controller ? 'a service worker is controlling this page' : 'no service worker control')
    : 'service workers unavailable'
  const cacheLine = typeof caches !== 'undefined' ? 'caches API present' : 'no caches API'

  const report = () => [
    `Research Engine ${APP_VERSION}`,
    `build      : ${BUILD_ID}`,
    `theme      : ${useStore.getState().settings.theme}`,
    `model      : ${useStore.getState().settings.defaultModel || '(none)'}`,
    `page       : ${typeof location !== 'undefined' ? location.href : ''}`,
    `service    : ${sw}`,
    `cache      : ${cacheLine}`,
    `notices    : ${notices.length}`,
    ...notices.slice(-20).map((n) => `  ${new Date(n.t).toISOString()}  [${n.tone}] ${n.title}${n.body ? ` — ${n.body}` : ''}`),
  ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      ui.toast('Copy failed', 'Select the text above and copy it by hand.', 'warning')
    }
  }

  return (
    <div className="surface p-4 mb-4">
      <div className="flex items-start gap-3">
        <ClipboardList size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[12.5px]" style={{ color: 'var(--text)' }}>Diagnostics</b>
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen((o) => !o)} className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                {open ? 'Hide' : `Show notices (${notices.length})`}
              </button>
              <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[11.5px]"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="text-[11.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {sw.startsWith('a service worker') ? 'A cached app shell is active on this copy. ' : ''}
            Report any message this app shows that <b>looks like it came from somewhere else</b> — the notice trail keeps the
            exact wording, including notifications that have already faded.
          </div>
          {open && (
            <>
              <pre className="mt-2 px-2.5 py-2 rounded-[8px] text-[11px] max-h-56 overflow-auto whitespace-pre-wrap"
                style={{ background: 'var(--elevated)', fontFamily: 'Geist Mono, ui-monospace, monospace', color: 'var(--text-2)' }}>
                {report()}
              </pre>
              {notices.length > 0 && (
                <button onClick={() => ui.clearNotices()} className="text-[11px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                  Clear the trail
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
