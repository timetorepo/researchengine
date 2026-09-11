import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Check, Wind, Palette, KeyRound, Image, Rocket, Loader2, ShieldCheck, Sparkles,
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
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { testConnection } from '@/lib/providers/stream'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { setVaultPassphrase } from '@/lib/crypto/session'
import { fileToBackgroundUrl } from '@/lib/backgrounds'
import type { FlowMode, ThemeId } from '@/types'
import { clsx } from 'clsx'

const FLOW_MODES: { id: FlowMode; name: string; desc: string; pct: string }[] = [
  { id: 'efficient', name: 'Efficient', desc: 'Maximum token savings. Aggressive pruning.', pct: '~70% saved' },
  { id: 'balanced', name: 'Balanced', desc: 'The default. Capsules for old turns.', pct: '~50% saved' },
  { id: 'fidelity', name: 'Fidelity', desc: 'Full context on every call.', pct: '0% pruned' },
]

export function Onboarding() {
  const settings = useStore((s) => s.settings)
  const ui = useUI()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  // step state
  const [theme, setTheme] = useState<ThemeId>(settings.theme)
  const [flowMode, setFlowMode] = useState<FlowMode>('balanced')
  const [provider, setProvider] = useState<string>('openai')
  const [apiKey, setApiKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [testState, setTestState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [bgChoice, setBgChoice] = useState<'default' | 'solid' | 'image' | 'blur' | 'veil'>('default')
  const [bgDataUrl, setBgDataUrl] = useState('')

  useEffect(() => {
    applyTheme(theme, {})
  }, [theme])

  const next = () => { setDir(1); setStep((s) => s + 1) }
  const back = () => { setDir(-1); setStep((s) => Math.max(0, s - 1)) }

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
    const patch: any = { flowEnabled: true, flowMode, theme }

    // background choice
    if (bgChoice === 'solid') patch.background = { kind: 'solid', color: '#101828' }
    else if ((bgChoice === 'image' || bgChoice === 'blur') && bgDataUrl) {
      patch.background = { kind: bgChoice, dataUrl: bgDataUrl }
    } else if (bgChoice === 'veil') patch.background = { kind: 'veil', opacity: 0.4 }
    else patch.background = { kind: 'default' }

    // provider key
    if (apiKey.trim()) {
      let stored = apiKey.trim()
      if (passphrase.length >= 4) {
        setVaultPassphrase(passphrase)
        stored = await encryptWithPassphrase(apiKey.trim(), passphrase)
        patch.passphraseSet = true
      }
      patch.providers = { ...settings.providers, [provider]: { apiKey: stored, baseUrl: '', enabled: true } }
      patch.defaultModel = `${provider}:${PROVIDERS.find((p) => p.id === provider)?.defaultModels[0] ?? 'default'}`
    }

    patch.onboarded = true
    useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
    applyTheme(theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion })
    ui.toast('Welcome to Research Engine', apiKey ? 'Your key is encrypted and stored locally.' : 'Running on the local demo model — add a key anytime.', 'success')
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 60 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -60 }),
  }

  const stepBody = [
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
        {['Local-first', 'BYOK providers', 'AIFlowEngine', 'Agent Flood', 'Read & Quiz'].map((t, i) => (
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

    /* 1 — Theme */
    <div key="s1" className="max-w-[560px] mx-auto">
      <StepHeader icon={Palette} title="Pick your theme" sub="Every surface follows it — chat, code blocks, gradients, everything." />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={clsx('p-3 rounded-[14px] text-left transition-all hover:scale-[1.02]')}
            style={{ border: `1.5px solid ${theme === t.id ? 'var(--primary)' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
            <div className="flex gap-1.5 mb-2">
              {t.swatches.map((c, i) => <span key={i} className="w-5 h-5 rounded-[6px]" style={{ background: c }} />)}
            </div>
            <div className="text-[12px] font-medium flex items-center gap-1">{t.name} {theme === t.id && <Check size={11} style={{ color: 'var(--primary)' }} />}</div>
          </button>
        ))}
      </div>
    </div>,

    /* 2 — Background */
    <div key="s2" className="max-w-[560px] mx-auto">
      <StepHeader icon={Image} title="Set a background" sub="Solid color, image, blurred image, or a dark veil. Change it anytime in Settings." />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {([['default', 'Theme default'], ['solid', 'Solid color'], ['image', 'Image'], ['blur', 'Blurred image'], ['veil', 'Dark veil']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setBgChoice(id)}
            className="p-3.5 rounded-[14px] text-left transition-all hover:scale-[1.02] h-[74px]"
            style={{ border: `1.5px solid ${bgChoice === id ? 'var(--primary)' : 'var(--surface-border)'}`, background: 'var(--surface)' }}>
            <div className="text-[12.5px] font-medium flex items-center gap-1.5">
              {label} {bgChoice === id && <Check size={11} style={{ color: 'var(--primary)' }} />}
            </div>
            <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>
              {id === 'default' && 'The signature look'}
              {id === 'solid' && 'One calm color'}
              {id === 'image' && 'Your own picture'}
              {id === 'blur' && 'Frosted glass feel'}
              {id === 'veil' && 'Cinematic dim'}
            </div>
          </button>
        ))}
        {(bgChoice === 'image' || bgChoice === 'blur') && (
          <label className="col-span-2 sm:col-span-1 flex items-center justify-center p-3 rounded-[14px] cursor-pointer text-[12px] gap-2"
            style={{ border: '1.5px dashed var(--surface-border)', color: 'var(--text-2)' }}>
            {bgDataUrl ? <><Check size={12} style={{ color: 'var(--success)' }} /> Image ready</> : 'Upload image…'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setBgDataUrl(await fileToBackgroundUrl(f))
            }} />
          </label>
        )}
      </div>
      {bgDataUrl && (bgChoice === 'image' || bgChoice === 'blur') && (
        <div className="mt-3 h-28 rounded-[14px] overflow-hidden hairline relative">
          <img src={bgDataUrl} alt="Preview" className="w-full h-full object-cover" style={{ filter: bgChoice === 'blur' ? 'blur(14px) scale(1.06)' : undefined }} />
        </div>
      )}
    </div>,

    /* 3 — Flow mode */
    <div key="s3" className="max-w-[520px] mx-auto">
      <StepHeader icon={Wind} title="How should AIFlowEngine run?" sub="The optimization layer that cuts token usage 40–70%. You can switch modes anytime." />
      <div className="space-y-2.5">
        {FLOW_MODES.map((m) => (
          <button key={m.id} onClick={() => setFlowMode(m.id)}
            className="w-full flex items-center gap-3 p-4 rounded-[14px] text-left transition-all"
            style={{
              border: `1.5px solid ${flowMode === m.id ? 'var(--primary)' : 'var(--surface-border)'}`,
              background: flowMode === m.id ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)',
            }}>
            <div className="flex-1">
              <div className="text-[14px] font-medium">{m.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>{m.desc}</div>
            </div>
            <span className="text-[11px] font-mono px-2 py-1 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>{m.pct}</span>
          </button>
        ))}
      </div>
    </div>,

    /* 4 — Provider */
    <div key="s4" className="max-w-[520px] mx-auto">
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

    /* 5 — Done */
    <div key="s5" className="text-center max-w-[480px] mx-auto">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 240 }}
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
        style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)' }}>
        <Check size={26} style={{ color: 'var(--success)' }} />
      </motion.div>
      <h2 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>You're set up</h2>
      <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Theme: <b>{THEMES.find((t) => t.id === theme)?.name}</b> · Flow: <b className="capitalize">{flowMode}</b> ·
        Model: <b>{apiKey ? PROVIDERS.find((p) => p.id === provider)?.name : 'Local demo'}</b>
      </p>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
        <Sparkles size={12} /> Try typing <code className="px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--elevated)' }}>-404</code> sometime.
      </div>
      <div className="mt-7">
        <Button size="lg" fullWidth onClick={finish} startContent={<Rocket size={16} />}>
          Enter Research Engine
        </Button>
      </div>
    </div>,
  ]

  return (
    <AuroraBackground className="h-full w-full">
      <div className="h-full flex flex-col">
        {/* progress */}
        <div className="flex items-center justify-center gap-1.5 pt-8">
          {stepBody.map((_, i) => (
            <button key={i} onClick={() => { setDir(i > step ? 1 : -1); setStep(i) }} aria-label={`Step ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 28 : 8, background: i <= step ? 'var(--primary)' : 'var(--elevated)' }} />
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 overscroll-contain">
          <div className="min-h-full flex items-center justify-center">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={variants}
                initial="enter" animate="center" exit="exit"
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                className="w-full py-8"
              >
                {stepBody[step]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* footer nav */}
        <div className="flex items-center justify-between px-8 pb-8 max-w-[720px] mx-auto w-full">
          {step > 0 ? (
            <Button variant="ghost" color="default" size="sm" onClick={back} startContent={<ArrowLeft size={13} />}>Back</Button>
          ) : <span />}
          {step > 0 && step < 5 ? (
            <div className="flex items-center gap-2">
              {step === 4 && <Button variant="ghost" color="default" size="sm" onClick={next}>Skip for now</Button>}
              <Button size="sm" onClick={next} disabled={step === 4 && PROVIDERS.find((p) => p.id === provider)?.needsKey === true && !apiKey && false}>
                Continue <ArrowRight size={13} className="inline" />
              </Button>
            </div>
          ) : <span />}
        </div>
      </div>
    </AuroraBackground>
  )
}

function StepHeader({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="mb-5">
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
