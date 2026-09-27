import React, { useEffect, useState } from 'react'
import {
  Github, ShieldCheck, ExternalLink, Sparkles, RefreshCw, CheckCircle2, Heart, Scale,
  Layers, Component, AlertTriangle, Eraser, ClipboardList, Copy,
} from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Button } from '@/components/ui/heroui/Button'
import { ProfileCard } from '@/components/ui/watermelon/ProfileCard'
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
  { name: 'Skiper UI', href: 'https://skiper-ui.com', used: 'Animated number (the focus timer) and the smooth caret input — reimplemented against this app’s tokens' },
  { name: 'Watermelon UI', href: 'https://ui.watermelon.sh', used: 'Expandable profile card, shuffled pinned list (tasks), and the select used across settings and the quiz' },
  { name: 'Cult UI', href: 'https://www.cult-ui.com', used: 'Timer anatomy (compound icon/display/progress) and the magnified dock behaviour in the collapsed sidebar' },
  { name: 'Number Flow', href: 'https://number-flow.barvian.me', author: 'Max Barvian', used: 'The per-digit roll behind every animated number' },
]

const RUNTIME_LIBRARIES = ['React', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Zustand', 'Lucide', 'KaTeX', 'react-markdown', 'JSZip']

export function AboutTab() {
  const ui = useUI()
  const profile = useStore((s) => s.settings.profile)
  const [checking, setChecking] = useState(false)
  const [latest, setLatest] = useState<string | null>(null)

  const checkUpdates = async () => {
    setChecking(true)
    try {
      // The old check asked GitHub for /releases/latest, which by definition
      // skips prereleases — and every release of this app is a prerelease, so it
      // answered 404 and the button looked broken. The server-side check reads
      // the release list and picks the newest by semver, prereleases included.
      const res = await fetch('/api/update/check')
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error ?? `HTTP ${res.status}`)
      const tag = j.latest ? `v${j.latest}` : null
      if (j.available) {
        ui.toast('Update available', `${tag} is out — you are on v${APP_VERSION}.`, 'success')
        ui.openSettings('updates')
      } else if (tag) {
        ui.toast('Up to date', `You are running the latest release (v${j.current}).`, 'success')
      } else {
        ui.toast('Could not check', 'GitHub did not return a release.', 'danger')
      }
    } catch (e: any) {
      ui.toast('Could not check for updates', String(e?.message ?? e), 'danger')
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
      {/* The maker, as the same expandable card the user's own profile uses —
          expand it for the long version. */}
      <ProfileCard
        tone="maker"
        className="mb-4"
        name="dnishh"
        handle="timetorepo/researchengine"
        bio="One-person project. No company behind it, no funding, no roadmap dictated by an investor."
        longBio="Research Engine is built in the open by dnishh. Ideas, bug reports and pull requests all arrive through the repository and shape what gets built next — and it is released under the MIT licence, so you can take it apart and keep the pieces."
        hobbies={['local-first', 'privacy', 'research tooling', 'open source', 'MIT', 'no telemetry']}
        facts={[
          { label: 'Licence', value: 'MIT' },
          { label: 'Source', value: 'github.com/timetorepo/researchengine' },
          { label: 'Promises', value: 'no accounts, no tracking' },
          { label: 'Built with', value: 'React · Vite · Tauri' },
        ]}
        actions={(
          <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1.5 rounded-[9px] text-[11.5px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            source <ExternalLink size={10} />
          </a>
        )}
      />
      <div className="surface p-4 mb-4">
        <div className="flex items-start gap-3">
          <Heart size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
          <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <p>
              Every release note is written for the person using it, not for a changelog bot: what changed,
              why it changed, and what is still missing.
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
        <p><b>0.31.1-beta.1 &mdash; One stylesheet line that was beating the components:</b> the reset that makes form controls inherit this app's font and colour sat <i>outside</i> a cascade layer, and an unlayered author rule outranks every layered one &mdash; so it silently overrode the Tailwind utilities of every vendored control that sets a colour on a button. That is why an armed send button in Agent Flood could fill itself with the light ink and then draw its arrow in the same colour (the white square you pointed at), and why the dictation pill never showed its listening colour. The reset now lives in <code>@layer base</code>, which is where a reset belongs: utilities win over it again. The build asserts this on the built stylesheet, not just in the source.</p>
        <p><b>0.31.0-beta.1 &mdash; The composer&rsquo;s two popovers, a pill that only offers Cancel when there is something to cancel, and integrations that really connect:</b> five things you pointed at, and all five were real. <b>The mode popover</b> (Flow / Search / Quality / Math / Replicate) is rebuilt as an actual popover: it anchors above the button, clamps itself to the window, and it <b>closes on the row you press</b> &mdash; the pick lands on pointer-down and the menu is gone before any re-render can put it back, which is exactly why it used to sit there until you dismissed it. Escape, the backdrop, a scroll and a resize all close it too, there is no exit animation to wait for, and every row now explains itself in one line (Math keeps its amber, since it changes how the answer is written). <b>The dictation pill</b> no longer shows a Cancel affordance before you have said anything: the pill's own slide/cancel variables were only ever written while a pointer was dragging, so the resting state was reading &quot;0&quot; as &quot;whatever&quot; &mdash; they are pinned at rest, which means Cancel can only appear once there is a recording to cancel, and it disappears again the moment the recording ends. The pill itself is now the composer's own 30px pill: text-coloured icon, elevated body, your accent only while it is listening, push-to-talk or toggle per your Voice settings. <b>Integrations work, and they are not a mock.</b> The plug menu is the real thing now: your accounts as chips with their connection state, an inline <b>Connect</b> form that saves the credential into the same local vault your provider keys use and then <b>tests it against the live service</b> &mdash; it reports the account it is signed in as, or the service's own refusal, verbatim &mdash; and a search box that fans out across everything connected, with each hit attachable to the message as context the agent can read. Behind it is a gateway with genuine adapters: <b>Google Drive</b> (files, and Google Docs exported as text), <b>Gmail</b> (search over messages, and the full MIME body decoded), <b>Google Calendar</b>, <b>GitHub</b> (issues and code search, with the real scopes read back from the token), <b>Notion</b>, <b>Slack</b> and your own <b>local files</b> &mdash; a refresh-token credential is exchanged for an access token on the server for that one request, and nothing is ever written, logged or echoed: the credentials travel in a header per request and the server keeps no copy. A selected account becomes a real reference on the message (<code>int:gmail:…</code>), read through the gateway when it is sent, and the agent can reach the same services itself through two new tools &mdash; <b><code>integration_search</code></b> and <b><code>integration_read</code></b> &mdash; where <b>&quot;not connected&quot; is an answer</b> rather than an empty result, so it tells you which account to connect instead of inventing its contents. <b>Settings &rarr; Integrations</b> stops pretending: the simulated OAuth toggle is gone, the page lists each service with its real state and a <b>Save &amp; test</b> that only calls it connected after the service said yes, Disconnect removes what was stored, and your local workspace sits underneath it. Everything is covered by a new integration test that stubs the network and asserts the exact request each service receives &mdash; URL, auth header, API-version header, method and body &mdash; plus that a refusal is reported as &quot;connect this account&quot; and never as &quot;no results&quot;.</p>
        <p><b>0.30.0-beta.1 — Free routing without a fake provider, search that answers, and updates from a repo nobody can see yet:</b> you asked two things about GitHub and both are now answered inside the app. <b>Settings &rarr; Updates</b> has a <b>Where updates come from</b> section: paste a <b>read-only token</b> (fine-grained, <i>Contents: read</i>) and the private release list becomes readable to the app alone — the token is sent to GitHub and nowhere else, and the backend only attaches it to <code>api.github.com</code>, <code>raw.githubusercontent.com</code>, <code>github.com</code>, <code>objects.githubusercontent.com</code> and <code>codeload.github.com</code>, never to a redirect target. If your network would rather not hand out a token at all, a <b>manifest URL</b> is a first-class source instead: any static JSON listing releases (a gist, a bucket, your own server) is accepted in three shapes, and <code>SHA256SUMS</code> is still fetched and matched <b>before a byte is unpacked</b>. And if you already have the archive — a download, a USB stick, a mirror — <b>install from file</b> takes <code>.tar.gz</code>/<code>.tgz</code>/<code>.zip</code>, optionally with the <code>SHA256SUMS</code> text pasted in, verifies, and swaps the same way a network update does; a checksum that does not match refuses to install. The tab ends by naming the source it is actually reading from, and a certificate failure now tells you about <code>NODE_EXTRA_CA_CERTS</code> instead of looking like a dead network. <b>FreeRoute is no longer a provider</b> — it is gone from the catalog, the picker, the settings tab and the API, and it is now what you described: a <b>feature of the chat</b> that points at a free model on a provider you already configured. Turn on <i>FreeRoute in chats</i> and a message with no model chosen goes to the best free candidate — your local Ollama or LM Studio first, then the free models of your other providers, never a model you did not mark free, never one on a provider without a key — and if that model answers with <code>429</code>, <code>408</code>, <code>409</code>, a <code>5xx</code>, a rate-limit or a capacity error it moves to the next candidate and keeps the failing one out of the rest of the chat. <b>Search works.</b> With no key at all, the backend finds <b>SearXNG</b> for you: your own instance if you run one, then <code>localhost:8080</code>, then seven public instances probed in turn, and whichever answered is remembered for the next few minutes; DuckDuckGo and finally the offline demo answer keep the panel from ever coming back empty, and the response says which backend answered and what it tried. Keys for <b>Brave, Serper and Tavily</b> are typed in the search panel (or Settings) and travel with each request as a header — they are read at the moment of use, so no backend restart and no environment file. <b>Every provider card carries a timeout in seconds</b> (3–600, default 45) and it is <i>your</i> app's patience, enforced by this client before a fetch is aborted — the provider's own server setting is not something we can see or change. <b>Dictation</b> now has three engines to choose from: the browser's own Web Speech API, <b>any OpenAI-compatible transcription provider you already keyed</b> (<code>whisper-1</code>, <code>gpt-4o-transcribe</code>, Groq's <code>whisper-large-v3</code>), or a <b>whisper.cpp / faster-whisper server on your own machine</b> — with push-to-talk, a live mic pill and words that append to what you already typed. The glow around the composer is <b>Voice by Jakub Antalik</b> (<code>voice-glow</code>) wrapped around the real input, not a copy of it, and the mic pill is the React Bits Micro <b>Voice Pill</b>. <b>The dock has an off switch</b>: <i>Dock animation</i> in the picker's settings row (and Settings &rarr; Appearance) turns the growing rows off, and the list stays perfectly still. <b>Pages open faster.</b> The bundle no longer ships two copies of the animation library, the settings sheet, tasks, palette, skills, onboarding, star field and diagnostics are all loaded when they are first opened rather than up front, <b>every route chunk is warmed two frames after the first paint</b> (with a timer fallback) instead of waiting for the browser to go idle, and only the routes you actually visit compile. The server side of that is brotli, gzip, <code>ETag</code> and <code>304</code>s with immutable hashed assets and a <code>no-cache</code> shell. React Bits Micro components are now doing real work in the app rather than sitting in a folder: <b>PromptBar</b> is the Agent Flood objective field, <b>HoldButton</b> is the desktop-safe <i>install</i> action, <b>RubberSegment</b> and <b>GlideSelect</b> are the picker's filters, <b>LatticeLoader</b> is the search spinner and <b>VoicePill</b> is the microphone — vendored from the source (MIT + Commons Clause, notice kept), never reinvented.</p>
        <p><b>0.29.0-beta.1 — The updater, and a picker that behaves:</b> you were tired of installing and uninstalling, so the app now updates itself. <b>Settings &rarr; Updates</b> is a new tab, and the top bar shows a pill when a newer release exists — nothing downloads until you press the button. The check reads GitHub's <i>release list</i> (not <code>/releases/latest</code>, which skips prereleases — every release here is one) and picks the newest with a real semver comparison; the download tries <code>raw.githubusercontent.com</code> first and the contents API second for networks that block it; <code>SHA256SUMS</code> is fetched from the same tag and the archive must be listed in it and match <b>before a single byte is unpacked</b>; and only <code>server/</code>, <code>frontend-dist/</code> and <code>bin/</code> are ever swapped, with the old ones kept in <code>.update/backup/</code>. A version that cannot pass its own health window is <b>rolled back by itself</b> on the next boot, and the tab says so. Your library is never read for update purposes, never written, never swapped — and that is not a comment: the update test hashes every file in a real library before and after check, download, verify, unpack, swap, rollback <i>and a real over-the-network update from the published release</i>. A source checkout is told <code>git pull &amp;&amp; npm run build</code>; the desktop app is handed its installer. <b>The model picker now feels like a dock</b> — rows grow toward your pointer with the neighbours easing up behind them, transforms only, text anchored so nothing slides out from under the cursor — and it sorts and filters <b>free vs paid</b> with live counts, sorts by provider/name/tier, shows the tier on the row (right-click to override it: your answer wins) and lets you <b>unlist</b> a model with the eye button, where it waits in a collapsed section instead of disappearing. <b>Every model row carries a logo</b>: the family's own glyph where this build knows the family, the <b>provider's logo</b> for anything niche, inline SVG so it draws offline. <b>The Providers tab starts empty</b> the way you asked — &quot;No providers yet&quot;, how many this build ships, and one Add button that opens a searchable catalog where already-added providers are marked; removing one asks <b>Keep my saved key</b> or <b>Remove and delete the key</b>, and adding never touches a key you already have. And <b>every response reports its token cost</b> under the message — the provider's own numbers when it reports them (OpenAI's <code>usage</code> frame via <code>stream_options.include_usage</code>, Anthropic's <code>message_start</code>/<code>message_delta</code>, Gemini's <code>usageMetadata</code>, Ollama's eval counts), summed across tool rounds, marked <b>&asymp;</b> and labelled as an estimate when a provider reports nothing at all.</p>
        <p><b>0.28.0-beta.1 — One click, a name you can read, a menu that does things, and a share card that actually draws:</b> the click that needed clicking twice is fixed, and it was mine: the View Transitions layer deferred the actual <code>pushState</code> into the browser's transition callback, but react-router tells its subscribers <i>when <code>pushState</code> returns</i> — so the router reported the <b>old</b> location, React re-rendered the old page, and the URL quietly disagreed with the screen. The second click only worked because by then the address bar already held the path the router would read. The push now happens <b>first, always, in the same tick</b>; the transition wraps it and tells the browser to wait for React to paint, with no <code>flushSync</code> in the path. A route is only animated into once it has <b>rendered</b> once (its first render always suspends, and animating into a skeleton is what froze the frame two rounds ago). It is now covered by a new <b>navigation test</b> that runs the real app in a real DOM with a faithful View Transitions polyfill and asserts the only thing that matters: <b>one click, one page</b> — 20 checks, including every row in the rail. <b>The dock's name plate is bigger</b> (13.5px, more padding, still quiet). <b>Right-click now does something anywhere:</b> shadcn's <b>context menu</b> (Radix, themed to the app) offers <b>Paste</b> — into the field you pointed at, or into the AI composer when you did not — <b>Ask AI</b> about a selection, copy, cut, link actions (open, copy, "ask AI to read it"), a new research chat seeded with the selection, search the web, tasks, settings and the command palette. Right-clicking the <b>scroll indicator no longer collides with it</b>: the indicator owns its own menu, with the <b>shapes you asked for</b> — Bar, <b>Circle progress (with a background)</b>, <b>Circle (bare, no background)</b> and a <b>top bar</b> hairline that clears the rail — plus unlock-to-drag, reset and hide. Rings can be scrubbed by dragging around them. And the <b>Share Studio draws again</b>: every style except "Custom image" set the canvas size and then never called the drawing function, so the preview was blank and Copy put a blank PNG on the clipboard — one paint path now covers all four looks, a picture that fails to decode falls back to the gradient instead of taking the studio with it, and a canvas the browser refuses to encode falls back to a data-URL blob. Long unbroken text (a URL in a caption) is now broken to fit rather than running off the card. All of it is covered: a new <b>share card test</b> (18 checks) draws every style into a recording context and reads back what the card says.</p>
        <p><b>0.27.0-beta.1 — A rail that only navigates, and links that behave:</b> FreeRoute is fixed — the crash you hit (<code>Minified React error #310</code>) was a hook-order violation of my own making: the smooth-caret helper called a hook and was then spread inside a conditional field, so the number of hooks changed between renders and React refused to continue. The helper is now hook-free (it reads the setting without subscribing) and has a proper <code>use…</code> twin that is called <b>once, at the top</b> of any component that wants it; it can be spread anywhere, including inside a branch. <b>The sidebar is navigation only.</b> The Spaces chips and the whole Research/Coding history list are gone, because the Chats page already does that job with more room — search, the kind switch, sections, and now the things only the old list could do: <b>pin</b> a chat to the top, <b>rename</b> it by double-clicking its title, and <b>export</b> it as JSON. Every row in the rail now carries an <b>arrow at its edge</b> — the honest signal that a row is a door — and the Chats row is the one that opens: rest on it and the arrow becomes a <b>rounded cube of your recent conversations</b>, newest first, research and coding together, with the count and a way through to all of them. Two seconds of rest while the rail is minimised, one second when it is expanded, one spring either way, and it disarms the instant your pointer leaves. The doubled/ghosted label on the active row is fixed at the source: the label is now a single non-wrapping line, so it can no longer reflow to a second line while the rail animates its own width. <b>Two more components from Skiper UI,</b> adapted rather than copied: links in answers are now drawn in CSS instead of by the browser (underline wiped in on hover, a marker that slides out only on links that leave the app, citations as real chips with the source and its host, internal links kept inside the app, plain underlines under reduce-motion) — and a <b>scroll-progress indicator</b> sits on the edge of every scrolling surface. It tracks whichever container is actually scrolling rather than assuming one, hides itself when a surface has nothing to scroll, keeps a <b>different position per tab</b> (clear of the chat composer on Chats, the assistant panel in Coding, the dock on Home) and steps aside while the Tasks panel is open. <b>Right-click it to unlock</b>, drag it anywhere, and it remembers where you dropped it for that tab; lock it again, reset it, or hide it — with a switch in Appearance to bring it back. Library credits stand at Skiper UI, Watermelon UI, Cult UI and Number Flow. <b>And a new way to prove a change:</b> alongside the render checks there is now a render <i>probe</i> — it mounts the shell's components into a string with no browser at all, which is the only headless way to catch a crash that only happens while a component renders. It earned its place immediately by catching one of mine (a portal reading <code>document.body</code> during render, which throws anywhere that is not a browser); the floating UI now goes through one guarded portal.</p>
        <p><b>0.26.0-beta.1 — Free routes, smooth text, and a task list that means something:</b> six more model providers land in Settings → Providers — <b>Inception Mercury</b> (their diffusion LLM), <b>xAI Grok</b>, <b>DeepSeek</b>, <b>Moonshot Kimi</b>, <b>Z.ai GLM</b> and <b>MiniMax</b> — each OpenAI-compatible and auto-discovering its own model list. And a new feature, <b>FreeRoute</b>: one endpoint in front of every free tier ResearchEngine knows about — <b>GLM Flash</b> (free on the API), <b>OpenCode Zen</b>'s free coding models, the free developer tiers at <b>Groq</b>, <b>Google AI Studio</b>, <b>Mistral</b> and <b>Cerebras</b>, <b>GitHub Models</b>, only the <code>:free</code> ids on OpenRouter, and the models on <b>your own machine</b> through Ollama or LM Studio. Requests walk your order and <b>fail over</b>, so a rate limit is a detour rather than an error; the console in <b>Settings → FreeRoute</b> probes every route, shows what each one actually offers for free, and lets you reorder them. It is a real OpenAI-compatible endpoint (<code>/api/freeroute/v1</code>), so any tool you own can point at it, and your keys are used per request and never stored on the server. <b>New UI, from the libraries you asked for:</b> the focus timer now counts with <b>animated digits</b> (Number Flow, via Skiper UI's animated number) on a countdown that re-anchors to the wall-clock second — the stutter and the occasional double-second are gone at the source rather than papered over with a longer interval. <b>Text fields have a smooth caret</b> (Skiper UI's smooth caret input): the native caret is hidden and a spring-animated bar tracks the cursor, measured from the field's own font, snapping under reduce-motion — on by default, and toggleable in Appearance. A <b>task list</b> (Watermelon UI's shuffled pinned list) lives in the top bar and works the same in Research and Coding: <b>pin what matters and it takes the top</b>, drag to reorder, shuffle the rest, then <b>Send to AI</b> — pinned tasks go to the model first, in order, and the composer picks them up. <b>Profile cards</b> (Watermelon UI's expandable profile card) now show you — name, bio, <b>hobbies</b>, avatar and facts — and the same card introduces the maker on the About page. Selecting is a real <b>listbox</b> everywhere (Watermelon UI's select): keyboard-navigable, theme-true, and it scrolls itself instead of dragging the page with it. The collapsed sidebar's dock (Cult UI's magnified dock) gained a glass shelf and a short reflection under the icon you are pointing at.</p>
        <p><b>0.25.0-beta.1 — The click you made is the page you get, and Research Engine is now an app you install:</b> you were right that both navigation bugs were one mistake — a click waited for the page file to download <i>before</i> it moved, so tapping a screen you had not opened yet simply did nothing ("it automatically doesnt load"), and if the download finished after you had already picked something else, it pushed you onto the <b>older</b> page instead of the one you asked for last. Navigation no longer waits for anything: the move happens in the same tick as your tap, the page file is fetched <b>beside</b> it instead of in front of it, a page you already visited opens instantly, and hovering a sidebar or dock item warms the next screen before you click. A late download can never win — it only ever warms the cache now, it never navigates. <b>You can also install it:</b> there is a full <b>Tauri desktop app</b> — the OS's own webview (WebView2 on Windows) wrapped around the same local server compiled to a single file, so the app needs <b>no Node, no Electron and no browser</b> on your machine. Windows gets <b>setup.exe</b>: per-user install, no admin prompt, WebView2 fetched automatically when missing, Start-menu entry and an uninstaller; Linux gets <b>.deb</b> and <b>.AppImage</b>, macOS a <b>.dmg</b>. The shell starts its server on loopback, waits until it actually answers, then opens the window at it — and kills it when you close the app, so nothing is left holding the port. Your chats, documents and projects live in one real SQLite file in <code>~/.research-engine</code>, which means the desktop app, the portable build and the web build all read the same library. Build it yourself with <code>npm run desktop:build</code>, or let CI do it — the workflow calls <code>scripts/desktop-check.mjs</code> on Windows before it bundles, so an installer is never built around a server that will not start.</p>
        <p><b>0.24.0-beta.1 — Pages that let you in, and a share card worth posting:</b> a tap on a screen that had not been loaded yet could <b>freeze the frame</b> — the old page was snapshotted over the new one while its chunk downloaded, and for the length of that transition nothing answered, which is the "it glitches and then finally lets me in" you reported. Navigation now fetches the page <b>first</b>, while the page you are on stays live and clickable; the row you picked pulses and a hairline crosses the top of the window, so a cold page is visibly yours. Only one transition can run at a time, and every transition has a deadline that ends it if the browser stalls. <b>Coding chats are their own kind now</b> — the history list switches between <b>Research</b> and <b>Coding</b>, each coding row carries a project chip, and the Chats page sections the two apart. And a research chat can <b>become</b> a coding chat from the AI itself: ask for an app, a script or a fix and it calls <code>start_coding_mode</code> — a client-side tool that only exists in ResearchEngine — which creates the project, moves the conversation into it (nothing you said is lost) and opens the workspace; the transcript shows a card saying what happened. <b>Share results</b> is a studio instead of a gradient: a live preview of the exact PNG with <b>Liquid glass</b>, <b>Gradient</b>, <b>Solid</b> or your own <b>Custom image</b>, accent pairs taken from your theme, per-field toggles, a caption of your own, Save and Copy-to-clipboard — composed at 1080×1350. <b>Fixes:</b> the collapsed rail's names no longer vanish in coding mode (each label is drawn in a portal at its icon's screen position, so no stacking context or overflow can swallow it); <b>Profile</b> and <b>Theme</b> in the sidebar and the dock finally go to the pages they name (they were flipping a flag nothing rendered).</p>
        <p><b>0.23.0-beta.1 — A coding IDE you can watch, and agents that cannot collide:</b> the IDE is now a workspace, not a panel. Three tabs sit beside the editor — <b>AI</b>, <b>Agents</b> and <b>Activity</b> — and the Activity tab is the Cursor habit at last: every file the AI read, every line it added, every command it ran, as it happens, each row clickable through to the file. Type <code>/</code> in the composer for the <b>Claude Code</b> commands (<code>/ultrareview</code> — four passes with <b>file:line</b> evidence and no invented line numbers, <code>/godmode</code>, <code>/plan</code>, <code>/test</code>, <code>/fix</code>, <code>/commit</code>, <code>/security</code>), the <b>Codex</b> parallel moves (<code>/agents</code>, <code>/parallel</code>), <b>Devin</b>'s <code>/handoff</code> and <code>/cloud</code>, and the <b>Cursor</b> inline edits (<code>/inline</code>, <code>/refactor</code>, <code>/explain</code>, <code>/doc</code>) — each labelled with where it came from, each expanding into a real instruction, and the handoff chip in the header flips a session between your local model and a cloud one. <b>Agents run in parallel without bumping into each other</b>: spawning one forks a private working copy of the project, its tools stay scoped to that copy, and when it finishes you get a review — the files it changed with <b>+added/−removed</b>, a tick per file to include or skip, then <b>Merge</b>. Anything you changed after the fork is never overwritten; that agent's version is kept beside yours as <code>*.agent-conflict-*</code> with a plain-language reason. <b>⌘K</b> opens a palette over files, actions and commands. <b>Fix:</b> the app can no longer open scrolled to the bottom — no component is allowed to call the browser's <code>scrollIntoView</code> (every list scrolls itself, through one helper), and a frame pin puts the shell back at the top if anything tries. <b>Design mode:</b> the preview now fits the pane it stands in (zoom 0.5×–2×, "Fit · 68%"), the divider between screen and inspector drags from 300–720px and remembers where you left it, and <b>Focus</b> gives the screen the whole workbench with the assistant docked out as a pill.</p>
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
