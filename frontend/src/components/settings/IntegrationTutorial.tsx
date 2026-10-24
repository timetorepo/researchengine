/**
 * The integrations tutorial.
 *
 * Not a slideshow about integrations — the real walk: pick a service, read
 * what it gives you, create the credential exactly where it is created, paste
 * it into the real form, and test it against the live service, so the last
 * screen of the tutorial is the service itself saying yes. Every step is the
 * same machinery the accounts panel uses (saveCreds, probeIntegration), which
 * is the difference between a tutorial and a screenshot of one.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  ArrowLeft, ArrowRight, Check, ExternalLink, FolderOpen, HardDrive, Hash,
  Loader2, Mail, Calendar, Github, StickyNote, X, Lightbulb, GraduationCap, PlugZap,
} from 'lucide-react'
import { INTEGRATIONS, FIELD_LABELS, type IntegrationId } from '@/lib/integrations/registry'
import { guideFor } from '@/lib/integrations/guides'
import { probeIntegration, saveCreds } from '@/lib/integrations/client'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  files: FolderOpen, drive: HardDrive, gmail: Mail, gcal: Calendar, github: Github, notion: StickyNote, slack: Hash,
}

type StepId = 'pick' | 'about' | 'create' | 'paste' | 'test' | 'use'

const stepsFor = (auth: 'none' | 'token'): StepId[] =>
  auth === 'none' ? ['pick', 'about', 'use'] : ['pick', 'about', 'create', 'paste', 'test', 'use']

const STEP_TITLES: Record<StepId, string> = {
  pick: 'Pick a service',
  about: 'What it gives you',
  create: 'Create the credential',
  paste: 'Paste it here',
  test: 'Test it for real',
  use: 'Use it',
}

export function IntegrationTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()
  const [id, setId] = useState<IntegrationId | null>(null)
  const [at, setAt] = useState(0) // index into the service's step list
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('')
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  const def = useMemo(() => INTEGRATIONS.find((i) => i.id === id) ?? null, [id])
  const steps = useMemo(() => stepsFor(def?.auth ?? 'token'), [def])
  const step = steps[Math.min(at, steps.length - 1)]
  const guide = id ? guideFor(id) : null

  useEffect(() => {
    if (!open) { setId(null); setAt(0); setValues({}); setResult(null); setBusy('') }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pick = (next: IntegrationId) => { setId(next); setAt(1); setValues({}); setResult(null) }
  const next = () => setAt((a) => Math.min(a + 1, steps.length - 1))
  const back = () => setAt((a) => Math.max(a - 1, 0))

  const save = async (andTest: boolean) => {
    if (!id) return
    setBusy(andTest ? 'test' : 'save')
    setResult(null)
    try {
      await saveCreds(id, values)
      setValues({})
      if (!andTest) { next(); return }
      const out = await probeIntegration(id)
      setResult({ kind: 'ok', message: out.account ? `Working — signed in as ${out.account}.` : out.detail })
      setAt(steps.indexOf('use')) // the service said yes: the walk is done
    } catch (e: any) {
      setResult({ kind: 'err', message: String(e?.message ?? e) })
    } finally {
      setBusy('')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-ui="integration-tutorial"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="surface p-4 sm:p-5 mb-6"
          style={{ borderColor: 'color-mix(in srgb, var(--primary) 35%, var(--surface-border))' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-[10px] grid place-items-center"
              style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
              <GraduationCap size={16} strokeWidth={1.7} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Connect a service, step by step</div>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {def ? `${def.name} — ${STEP_TITLES[step]}` : 'The real console, the real credential, the real test.'}
              </div>
            </div>
            <div className="tut-dots" aria-label={`Step ${at + 1} of ${steps.length}`}>
              {steps.map((s2, i) => (
                <span key={s2} className={i === at ? 'on' : i < at ? 'done' : ''} />
              ))}
            </div>
            <button onClick={onClose} aria-label="Close tutorial" className="p-1.5 rounded-full" style={{ color: 'var(--text-3)' }}>
              <X size={14} />
            </button>
          </div>

          {/* No exit animation between steps: the content swaps with the enter
              motion alone, so there is never a moment with two steps on screen. */}
          <div>
            <motion.div
              key={`${id ?? 'none'}-${step}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}>

              {step === 'pick' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INTEGRATIONS.map((i) => {
                    const Icon = ICONS[i.id] ?? FolderOpen
                    return (
                      <button key={i.id} onClick={() => pick(i.id)}
                        className="flex items-center gap-3 p-3 rounded-[12px] text-left"
                        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                        <span className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0"
                          style={{ background: `hsl(${i.hue} 50% 45% / 0.18)`, color: `hsl(${i.hue} 62% 62%)` }}>
                          <Icon size={15} strokeWidth={1.6} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-medium">{i.name}</span>
                          <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>
                            {i.auth === 'none' ? 'no account needed' : i.short}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {step === 'about' && def && (
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  <p className="mb-2">{def.hint}</p>
                  <p className="mb-3">
                    The agent gets exactly {def.scopes.length ? def.scopes.join(', ') : 'read access to this machine'} — nothing
                    else, and nothing is ever written back unless a service offers no other way.
                  </p>
                  {def.auth === 'none'
                    ? <p style={{ color: 'var(--success)' }}>This one is already connected. Skip ahead to what it can do.</p>
                    : <p>The next steps happen in {def.name}'s own console, then end back here at Save &amp; test.</p>}
                </div>
              )}

              {step === 'create' && def && guide && (
                <div>
                  <ol className="flex flex-col gap-2 mb-3">
                    {guide.steps.map((s2, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                        <span className="w-5 h-5 rounded-full grid place-items-center shrink-0 text-[10px] font-semibold"
                          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{i + 1}</span>
                        <span>{s2}</span>
                      </li>
                    ))}
                  </ol>
                  {guide.shape && (
                    <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-3)' }}>What you are looking for: {guide.shape}</p>
                  )}
                  {guide.gotcha && (
                    <p className="flex items-start gap-1.5 text-[11.5px] mb-3" style={{ color: 'var(--warning)' }}>
                      <Lightbulb size={12} className="mt-0.5 shrink-0" /> {guide.gotcha}
                    </p>
                  )}
                  {def.docs && (
                    <a href={def.docs} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--primary)' }}>
                      Open {def.name}'s console <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {step === 'paste' && def && (
                <div>
                  <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
                    The credential is encrypted into this browser's vault — the same one that holds your provider keys. The
                    server never stores it.
                  </p>
                  {def.fields.map((field) => {
                    const meta = FIELD_LABELS[field]
                    return (
                      <label key={field} className="block mb-2">
                        <span className="block text-[11px] mb-1" style={{ color: 'var(--text-3)' }}>{meta.label}</span>
                        <input
                          type={meta.secret ? 'password' : 'text'}
                          value={values[field] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                          placeholder={meta.placeholder}
                          aria-label={`${def.name} ${meta.label}`}
                          autoComplete="off"
                          className="w-full px-3 py-2 rounded-[10px] text-[12.5px] font-mono outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
                        />
                      </label>
                    )
                  })}
                </div>
              )}

              {step === 'test' && def && (
                <div>
                  <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
                    This makes one authenticated call to {def.name}. "Connected" is only ever the service saying yes — a
                    refusal is quoted verbatim, so you can tell a wrong token from a missing scope.
                  </p>
                  <button onClick={() => void save(true)} disabled={!!busy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)', color: '#fff' }}>
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />} Save &amp; test
                  </button>
                  {result && (
                    <p className="text-[12px] mt-3" style={{ color: result.kind === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
                      {result.message}
                    </p>
                  )}
                </div>
              )}

              {step === 'use' && def && (
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  <ul className="flex flex-col gap-1.5">
                    <li className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> In the composer, the plug menu lists {def.name} as connected — attach a file, message or page to any message.</li>
                    <li className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> The agent searches it with <code>integration_search</code> and reads a hit with <code>integration_read</code>, read-only.</li>
                    <li className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> The Library's recommendations read the same connections when you switch them on.</li>
                  </ul>
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button onClick={back} disabled={at === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] disabled:opacity-40"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <ArrowLeft size={12} /> Back
            </button>
            <span className="flex-1" />
            {step !== 'test' && (
              <button onClick={next} disabled={step === 'pick' && !id}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-[12px] font-medium disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                {step === 'use' ? 'Done' : 'Next'} {step !== 'use' && <ArrowRight size={12} />}
              </button>
            )}
            {step === 'use' && (
              <button onClick={() => { setId(null); setAt(0) }}
                className="px-3 py-1.5 rounded-[10px] text-[12px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Connect another service
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
