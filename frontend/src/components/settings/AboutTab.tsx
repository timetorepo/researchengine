import React, { useState } from 'react'
import { Github, ShieldCheck, ExternalLink, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Button } from '@/components/ui/heroui/Button'

export const APP_VERSION = '0.14.0-beta.1'

export function AboutTab() {
  const ui = useUI()
  const [checking, setChecking] = useState(false)
  const [latest, setLatest] = useState<string | null>(null)

  const checkUpdates = async () => {
    setChecking(true)
    setLatest(null)
    try {
      const res = await fetch('https://api.github.com/repos/timetorepo/researchengine/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setLatest(data.tag_name ?? null)
      if (data.tag_name && data.tag_name !== `v${APP_VERSION}`) {
        ui.toast('Update available', `${data.tag_name} is out — you are on v${APP_VERSION}.`, 'success')
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
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AppLogo size={40} withName={false} />
        <div>
          <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Research Engine</h2>
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Version {APP_VERSION} · refined · self-hosted · privacy-first</p>
        </div>
      </div>

      <div className="surface p-4 mb-4 flex items-start gap-3">
        <ShieldCheck size={18} style={{ color: 'var(--success)' }} className="shrink-0 mt-0.5" />
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text)' }}>The promise:</b> all your data stays local. Only outbound API calls to
          providers you configure ever leave this device. No telemetry, no analytics, no update pings —
          update checks only run when you press the button.
        </div>
      </div>

      <div className="space-y-2 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
        <p>A self-hosted research platform with Perplexity-level answer quality — built for researchers, scientists, students, and privacy-conscious power users.</p>
        <p>Featuring versioned Master Prompts, the AIFlowEngine optimization layer, New Tech (Replication) mode, SkillBuilder, Agent Flood orchestration, the Read &amp; Quiz studio, articles with AI images, citation management, and a fully themeable interface including the Perplexity-inspired theme.</p>
      </div>

      <div className="flex gap-2 mt-5 flex-wrap">
        <a href="https://github.com/timetorepo/researchengine" target="_blank" rel="noreferrer"
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

      <div className="mt-6 pt-4 text-[11px] leading-relaxed" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
        <div className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>Changelog</div>
        <p><b>0.14.0-beta.1 — Continuity &amp; automation:</b> AIFlowEngine becomes a true streaming engine — raw bursts are buffered and re-timed into composed word-by-word prose (Off / Subtle / Standard / Cinematic), with punctuation pauses, whole-line code reveals, stall detection, and a breathing-orb thinking indicator that names the actual pipeline stage. Route-level code splitting cuts the initial bundle by 47%. A new Workflows surface chains triggers, AI steps, logic, transforms and outputs into automations that execute for real — infinite canvas, cmdk node picker, slide-over config with live node testing, run history, log and data inspector, 8 templates, and secret-scrubbed <code>.workflow.json</code> sharing. A filesystem integration writes real files into the Research Engine data directory. Plus a full product README and app-wide motion standardization.</p>
        <p className="mt-1.5"><b>0.13.0-beta.1 — Lightweight runtimes:</b> Docker is now optional. A single-process server (<code>npm start</code>) serves the API, streams and the built frontend on :3847 with automatic port picking; a portable-binary packager (<code>npm run package:binary</code>, Bun compile supported); a Tauri 2 desktop scaffold; PWA install with an offline app shell; startup profiles (eco / balanced / performance) with a live resource panel in Settings → Performance; a standard data directory at <code>~/.research-engine</code>; and an optional slim single-image Docker path with resource limits.</p>
        <p className="mt-1.5">0.12.0-beta.1 — The Refinement: versioned Master Prompts; New Tech (Replication) mode; rebuilt Read &amp; Quiz studio; premium quizzes; AI article images; Perplexity-inspired theme; command palette; ZIP export and merge-import.</p>
        <p className="mt-1.5">0.11.0-beta.1 — The working version: Agent Flood runs real parallel agents on configured models with real synthesis and live token/budget accounting; web search runs real engines and grounds answers in numbered citations; navigation hardening; error boundary.</p>
        <p className="mt-1.5">0.10.0-beta.1 — Onboarding flow, custom backgrounds (solid / image / blur / veil), UI component libraries, adaptive context pruning.</p>
        <p className="mt-1.5">0.9.0 — Agent Flood scratchpad, ResearchEngineOS Dynamic Island, citation export formats.</p>
        <p className="mt-3">Open-source licenses: React, Vite, Tailwind CSS, Framer Motion, Zustand, Lucide, KaTeX, react-markdown, JSZip.</p>
      </div>
    </div>
  )
}
