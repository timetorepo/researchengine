import React from 'react'
import { Github, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useStore } from '@/stores/useStore'
import { Button } from '@/components/ui/heroui/Button'

export function AboutTab() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AppLogo size={40} withName={false} />
        <div>
          <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Research Engine</h2>
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Version 0.11.0-beta.1 · the working version · self-hosted · privacy-first</p>
        </div>
      </div>

      <div className="surface p-4 mb-4 flex items-start gap-3">
        <ShieldCheck size={18} style={{ color: 'var(--success)' }} className="shrink-0 mt-0.5" />
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text)' }}>The promise:</b> all your data stays local. Only outbound API calls to
          providers you configure ever leave this device. No telemetry, no analytics, no update pings.
        </div>
      </div>

      <div className="space-y-2 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
        <p>A self-hosted research platform with Perplexity-level answer quality — built for researchers, scientists, students, and privacy-conscious power users.</p>
        <p>Featuring the AIFlowEngine optimization layer, SkillBuilder, Agent Flood orchestration, Read &amp; Quiz, articles, citation management, and a fully themeable interface including ResearchEngineOS.</p>
      </div>      <div className="flex gap-2 mt-5 flex-wrap">
        <a href="https://github.com/timetorepo/researchengine" target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Github size={14} /> GitHub <ExternalLink size={11} />
        </a>
        <Button variant="flat" size="md" startContent={<Sparkles size={14} />}
          onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, onboarded: false } }))}>
          Run setup again
        </Button>
      </div>

      <div className="mt-6 pt-4 text-[11px] leading-relaxed" style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
        <div className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>Changelog</div>
        <p>0.11.0-beta.1 — The working version: Agent Flood now runs real parallel agents on your configured models with real synthesis and live token/budget accounting; web search runs real engines (SearXNG / Brave / Serper / Tavily / keyless DuckDuckGo via the backend, Wikipedia in-browser) and grounds answers in numbered citations; navigation hardening (no more stuck screens or dead clicks); error boundary instead of blank pages.</p>
        <p>0.10.0-beta.1 — Onboarding flow, custom backgrounds (solid / image / blur / veil), UI component libraries, adaptive context pruning.</p>
        <p>0.9.0 — Agent Flood scratchpad, ResearchEngineOS Dynamic Island, citation export formats.</p>
        <p className="mt-3">Open-source licenses: React, Vite, Tailwind CSS, Framer Motion, Zustand, Lucide, KaTeX, react-markdown.</p>
      </div>
    </div>
  )
}
