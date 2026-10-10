import React, { useEffect, useMemo, useState } from 'react'
import { Rocket, Loader2, Copy, Check, CircleSlash, Clock, CheckCircle2 } from 'lucide-react'
import {
  THROTTLE_STAGES, runPlan, formatReport, type ThrottleRun, type StageState,
} from '@/lib/design/throttle'
import { useDesign } from '@/stores/useDesign'
import { useUI } from '@/stores/useUI'

/**
 * Full Throttle — the six directives as one run.
 *
 * Design Mode's six surfaces each do their job well and each cost a click, so
 * the pipeline the user asked for was six things to remember. This drives them
 * in the order the directives name and reports where it got to.
 *
 * It does not pretend to have done the agent's work. It checks what each stage
 * needs, runs what it can, and says plainly what it could not and why. A blocked
 * brief blocks the direction and the prototype — that is the second directive
 * doing its job, not a failure, and a runner that skipped it to look fast would
 * be worse than no runner.
 */
export function ThrottlePanel({
  previewUp,
  onOpenTab,
}: {
  previewUp: boolean
  onOpenTab: (tab: string) => void
}) {
  const ui = useUI()
  const brief = useDesign((s) => s.brief)
  const directions = useDesign((s) => s.directions)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<ThrottleRun | null>(null)
  const [copied, setCopied] = useState(false)
  // The ship host is the ship panel's own choice, not the design store's: it is
  // written into project files and outlives this panel's state.
  const [host, setHost] = useState('')
  // The prototype checklist lives in PrototypeBoard's own state, because it is a
  // thing you tick while looking at four frames. Full Throttle reads whether any
  // of them is ticked by listening for the event that board emits when one is.
  const [prototypeTicked, setPrototypeTicked] = useState(false)
  useEffect(() => {
    const on = () => setPrototypeTicked(true)
    window.addEventListener('re:prototype-checked', on)
    return () => window.removeEventListener('re:prototype-checked', on)
  }, [])

  const input = useMemo(() => ({
    previewUp,
    // A brief with any real answer is a brief. An object of empty strings is not.
    hasBrief: !!brief && Object.values(brief).some((v) => typeof v === 'string' && v.trim().length > 0),
    hasDirection: directions.some((d) => d.chosen),
    // The prototype checklist is worked through when at least one box is ticked.
    hasPrototype: prototypeTicked,
    hasHost: host.trim().length > 0,
  }), [previewUp, brief, directions, host, prototypeTicked])

  const start = async () => {
    setRunning(true)
    // The stages are surfaces you work in, not work this panel does for you, so
    // the "run" is a walk of them in order with the checks between.
    const result = runPlan(input)
    setRun(result)
    setRunning(false)
    ui.toast(
      result.complete ? 'Full Throttle ready' : 'Full Throttle stopped',
      result.headline,
      result.complete ? 'success' : 'warning',
    )
  }

  const copy = () => {
    if (!run) return
    navigator.clipboard?.writeText(formatReport(run)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const shown = run?.stages ?? runPlan(input).stages

  return (
    <div className="flex flex-col gap-3 p-3 text-[12px] min-h-0 overflow-y-auto">
      <div className="flex items-start gap-2.5">
        <Rocket size={15} style={{ color: 'var(--ide-accent)' }} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium">Full Throttle</div>
          <div className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--ide-faint)' }}>
            Runs the six directives in order: research, ask what premium means, directions, prototype,
            hunt the bugs, ship. It checks what each stage needs and tells you which ones it could not
            reach. Shipping is never automatic.
          </div>
        </div>
      </div>

      <button onClick={start} disabled={running}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-[11.5px] font-medium disabled:opacity-40"
        style={{ background: 'var(--ide-accent)', color: 'var(--ide-bg)' }}>
        {running ? <><Loader2 size={12} className="animate-spin" /> Running the pipeline…</> : <><Rocket size={12} /> Run Full Throttle</>}
      </button>

      {run && (
        <div className="rounded-[10px] px-2.5 py-2 text-[11px] leading-snug"
          style={{
            background: run.complete ? 'color-mix(in srgb, var(--ide-accent) 12%, transparent)' : 'color-mix(in srgb, var(--ide-cyan) 12%, transparent)',
            color: run.complete ? 'var(--ide-accent)' : 'var(--ide-cyan)',
          }}>
          {run.headline}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {THROTTLE_STAGES.map((stage, i) => {
          const result = shown.find((s) => s.id === stage.id)
          const state: StageState = result?.state ?? 'pending'
          const tone = state === 'done' ? 'var(--ide-accent)' : state === 'blocked' ? 'var(--ide-danger)' : 'var(--ide-faint)'
          return (
            <button key={stage.id} onClick={() => onOpenTab(stage.tab)}
              className="flex items-start gap-2 px-2.5 py-2 rounded-[8px] text-left"
              style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border)' }}>
              <span className="mt-[1px] shrink-0">
                {state === 'done' ? <CheckCircle2 size={12} style={{ color: tone }} />
                  : state === 'blocked' ? <CircleSlash size={12} style={{ color: tone }} />
                    : <Clock size={12} style={{ color: tone }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[11.5px] font-medium block" style={{ color: 'var(--ide-text)' }}>
                  {i + 1}. {stage.title}
                </span>
                <span className="text-[10.5px] leading-snug block mt-0.5" style={{ color: tone }}>
                  {result?.note ?? stage.needs}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {run && (
        <button onClick={copy}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px]"
          style={{ background: 'var(--ide-elevated)', border: '1px solid var(--ide-border)', color: 'var(--ide-faint)' }}>
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy the report</>}
        </button>
      )}

      <div className="text-[10.5px] leading-snug" style={{ color: 'var(--ide-faint)' }}>
        Full Throttle does not write the design for you. It walks the stages in order, checks what each
        one needs, and stops where a human answer is missing rather than guessing.
      </div>
    </div>
  )
}
