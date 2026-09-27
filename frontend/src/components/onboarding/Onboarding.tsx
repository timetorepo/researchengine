import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight, ArrowLeft, Check, KeyRound, Rocket, ShieldCheck, BookOpen, Lock, HardDrive, Sparkles,
} from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { THEMES, applyTheme } from '@/lib/themes/meta'
import { Button } from '@/components/ui/heroui/Button'
import { Input } from '@/components/ui/heroui/Input'
import { AuroraBackground } from '@/components/ui/aceternity/AuroraBackground'
import { TextGenerateEffect } from '@/components/ui/aceternity/TextGenerateEffect'
import { MovingBorder } from '@/components/ui/aceternity/MovingBorder'
import { PROVIDERS } from '@/lib/providers/registry'
import { refreshProviderModels } from '@/lib/providers/refresh'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { testConnection } from '@/lib/providers/stream'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { setVaultPassphrase } from '@/lib/crypto/session'
import type { ThemeId } from '@/types'
import { clsx } from 'clsx'

const STEPS = ['Welcome', 'Privacy', 'Provider', 'Try the demo', "You're set"]

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

  const fade = {
    initial: { opacity: 0, scale: 0.99 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.01 },
  }

  const body = [
    /* 0 — Welcome */
    <div key="s0" className="text-center max-w-[520px] mx-auto">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-6"
        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
          <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
          <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
        </svg>
      </motion.div>
      <h1 className="text-[30px] font-bold leading-tight" style={{ letterSpacing: '-0.03em' }}>Research Engine</h1>
      <TextGenerateEffect
        text="Perplexity-level answers. Zero data leaves your device except the calls you aim yourself."
        className="text-[15px] mt-3 leading-relaxed"
        duration={1.2}
      />
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {['Local-first', 'BYOK providers', 'Master Prompts', 'New Tech mode', 'Read & Quiz', 'Agent Flood'].map((t, i) => (
          <motion.span key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="px-3 py-1 rounded-full text-[11.5px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
            {t}
          </motion.span>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <MovingBorder onClick={next} radius={999} className="w-52 h-12">
          <span className="flex items-center justify-center gap-2 font-medium text-[14px] text-white"
            style={{ background: 'var(--primary)', borderRadius: 999, height: '100%' }}>
            Get started <ArrowRight size={15} />
          </span>
        </MovingBorder>
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
      <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>While you're here — pick a theme</div>
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

    /* 2 — Provider (skippable) */
    <div key="s2" className="max-w-[520px] mx-auto">
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
        </div>
      ) : (
        <div className="p-4 rounded-[14px] text-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <ShieldCheck size={15} className="inline mr-1.5" style={{ color: 'var(--success)' }} />
          {provider === 'ollama' ? 'No key needed. Research Engine will find your local models via /api/tags.' : 'No key needed for this endpoint.'}
        </div>
      )}
    </div>,

    /* 3 — Try the demo */
    <div key="s3" className="max-w-[520px] mx-auto text-center">
      <StepHeader icon={BookOpen} title="See it working — no key required" sub="A bundled study demo: a genuine DNA primer, AI study rewrite, three-tier highlights, and a hand-tuned quiz. Fully offline." />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-[18px] p-5 text-left mb-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="text-[13px] font-medium mb-1">“The Structure of DNA” demo</div>
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> Scripted 3-stage processing pipeline — Parsing, Extracting, Analyzing</li>
          <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> 720px serif reader with progress rail and annotation markers</li>
          <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> AI study rewrite with toggle back to the original</li>
          <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> Premium quiz with explanations and source jumps</li>
        </ul>
      </motion.div>
      <div className="flex justify-center gap-2">
        <Button size="md" onClick={tryDemo} startContent={<BookOpen size={15} />}>Open the reading demo</Button>
        <Button variant="ghost" size="md" onClick={next}>Later</Button>
      </div>
    </div>,

    /* 4 — You're set */
    <div key="s4" className="text-center max-w-[480px] mx-auto">
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
      <div className="mt-6">
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
          {STEPS.map((label, i) => (
            <button key={label} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${label}`} title={label}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 28 : 8, background: i <= step ? 'var(--primary)' : 'var(--elevated)' }} />
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 overscroll-contain">
          <div className="min-h-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={fade}
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
          {step > 0 && step < STEPS.length - 1 ? (
            <Button variant="ghost" color="default" size="sm" onClick={back} startContent={<ArrowLeft size={13} />}>Back</Button>
          ) : <span />}
          {step > 0 && step < 3 ? (
            <div className="flex items-center gap-2">
              {step === 2 && <Button variant="ghost" color="default" size="sm" onClick={next}>Skip for now</Button>}
              <Button size="sm" onClick={next}>Continue <ArrowRight size={13} className="inline" /></Button>
            </div>
          ) : <span />}
        </div>
      </div>
    </AuroraBackground>
    </div>
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
