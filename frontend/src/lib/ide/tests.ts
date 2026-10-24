// Client-side UI test runner.
//
// A "test" here is a list of steps, each of which is a real client tool call
// against the live preview (click, type, navigate, wait, assert, snapshot).
// The same engine powers:
//   · the Test panel's one-click buttons for every discovered control,
//   · "Run all", and
//   · the AI's run_ui_test tool.
// Progress is published to a tiny observable store so the panel can light each
// step up as it executes.
import { nanoid } from 'nanoid'
import { designSession, formatSnapshot, type ControlInfo } from './bridge'

export interface TestStep {
  action: 'click' | 'type' | 'navigate' | 'wait' | 'assert' | 'snapshot' | 'press'
  target?: string
  text?: string
  url?: string
  ms?: number
  submit?: boolean
  note?: string
  checks?: any[]
  key?: string
}

export interface StepResult {
  index: number
  action: string
  label: string
  status: 'running' | 'pass' | 'fail' | 'info'
  detail: string
  ms: number
}

export interface TestRun {
  id: string
  name: string
  startedAt: number
  finishedAt?: number
  status: 'running' | 'passed' | 'failed' | 'error'
  steps: StepResult[]
  /** The script that produced this run, so the user can replay it. */
  spec: TestStep[]
}

let runs: TestRun[] = []
const listeners = new Set<() => void>()

function publish() {
  runs = [...runs]
  for (const fn of listeners) { try { fn() } catch { /* ignore */ } }
}

export const testStore = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  get(): TestRun[] { return runs },
  latest(): TestRun | null { return runs[0] ?? null },
  clear() { runs = []; publish() },
}

/* ------------------------------------------------------------------ */
/* single-step execution                                              */
/* ------------------------------------------------------------------ */

function labelFor(step: TestStep): string {
  if (step.note) return step.note
  if (step.action === 'click') return `click ${step.target}`
  if (step.action === 'type') return `type "${String(step.text ?? '').slice(0, 24)}" into ${step.target}`
  if (step.action === 'navigate') return `navigate ${step.url}`
  if (step.action === 'wait') return `wait ${step.ms ?? 500}ms`
  if (step.action === 'assert') return `assert ${step.checks?.length ?? 0} condition(s)`
  if (step.action === 'press') return `press ${step.key ?? 'Enter'}`
  return 'snapshot'
}

async function execStep(step: TestStep, index: number): Promise<StepResult> {
  const started = Date.now()
  const base: StepResult = { index, action: step.action, label: labelFor(step), status: 'info', detail: '', ms: 0 }
  try {
    if (step.action === 'click') {
      const out = await designSession.call('click', { target: step.target, waitMs: 450 }, 15_000)
      const errs = (out.console ?? []).filter((c: any) => c.level === 'error')
      const changed = out.navigated || out.domDelta !== 0
      return {
        ...base,
        status: errs.length ? 'fail' : changed ? 'pass' : 'info',
        detail: [
          out.navigated ? `navigated → ${out.urlAfter}` : `no navigation`,
          `DOM ${out.domDelta >= 0 ? '+' : ''}${out.domDelta}`,
          errs.length ? `console error: ${errs[0].text.slice(0, 140)}` : '',
          !changed && !errs.length ? 'nothing visibly happened — is the button wired up?' : '',
        ].filter(Boolean).join(' · '),
        ms: Date.now() - started,
      }
    }
    if (step.action === 'type') {
      const out = await designSession.call('type', { target: step.target, text: step.text ?? '', submit: !!step.submit }, 15_000)
      return { ...base, status: 'pass', detail: `value = ${JSON.stringify(out.typed)}${out.urlAfter ? ` · url ${out.urlAfter}` : ''}`, ms: Date.now() - started }
    }
    if (step.action === 'navigate') {
      await designSession.call('navigate', { url: step.url ?? '/' }, 8000).catch(() => null)
      await designSession.waitForReady(15_000).catch(() => null)
      await new Promise((r) => setTimeout(r, 350))
      const ping = await designSession.call('ping', {}, 8000).catch(() => null)
      return { ...base, status: ping ? 'pass' : 'fail', detail: ping ? `now at ${ping.url}` : 'page did not come back up', ms: Date.now() - started }
    }
    if (step.action === 'wait') {
      await new Promise((r) => setTimeout(r, Math.min(step.ms ?? 500, 10_000)))
      return { ...base, status: 'info', detail: 'waited', ms: Date.now() - started }
    }
    if (step.action === 'press') {
      await designSession.call('press', { key: step.key ?? 'Enter' }, 8000)
      return { ...base, status: 'pass', detail: 'key sent', ms: Date.now() - started }
    }
    if (step.action === 'snapshot') {
      const snap = await designSession.call('snapshot', { maxNodes: 60 }, 15_000)
      return { ...base, status: 'info', detail: `${snap.elements?.length ?? 0} elements · ${snap.findings?.length ?? 0} finding(s)`, ms: Date.now() - started }
    }
    if (step.action === 'assert') {
      const checks = Array.isArray(step.checks) ? step.checks : []
      const out = await designSession.call('assert', { checks }, 20_000)
      const failed = (out.results ?? []).filter((r: any) => !r.pass)
      return {
        ...base,
        status: out.allPassed ? 'pass' : 'fail',
        detail: out.allPassed
          ? `all ${out.total} check(s) passed`
          : failed.map((r: any) => `${r.check} ${r.target ?? ''}: ${r.detail}`).join(' | ').slice(0, 400),
        ms: Date.now() - started,
      }
    }
    return { ...base, status: 'fail', detail: `unknown action "${step.action}"`, ms: Date.now() - started }
  } catch (e: any) {
    return { ...base, status: 'fail', detail: String(e?.message ?? e), ms: Date.now() - started }
  }
}

/* ------------------------------------------------------------------ */
/* runs                                                               */
/* ------------------------------------------------------------------ */

/** Execute a full test script, publishing progress as it goes. */
export async function runSteps(steps: TestStep[], name: string): Promise<TestRun> {
  const run: TestRun = {
    id: nanoid(8), name, startedAt: Date.now(), status: 'running', spec: steps,
    steps: steps.map((s, i) => ({ index: i, action: s.action, label: labelFor(s), status: 'info', detail: 'queued', ms: 0 })),
  }
  runs = [run, ...runs].slice(0, 10)
  publish()

  try {
    for (let i = 0; i < steps.length; i++) {
      run.steps[i] = { ...run.steps[i], status: 'running', detail: 'running…' }
      publish()
      const result = await execStep(steps[i], i)
      run.steps[i] = result
      publish()
      if (result.status === 'fail' && (steps[i].action === 'assert' || steps[i].action === 'navigate')) {
        // A failed assertion or a dead navigation invalidates the rest of the run.
        for (let j = i + 1; j < steps.length; j++) run.steps[j] = { ...run.steps[j], status: 'info', detail: 'skipped after failure' }
        break
      }
    }
  } catch (e: any) {
    run.status = 'error'
    run.finishedAt = Date.now()
    publish()
    return run
  }
  run.status = run.steps.some((s) => s.status === 'fail') ? 'failed' : 'passed'
  run.finishedAt = Date.now()
  publish()
  return run
}

/** Text report handed back to the model. */
export async function runUiTest(steps: TestStep[], name: string): Promise<string> {
  if (!steps.length) return 'No test steps were provided.'
  const run = await runSteps(steps.slice(0, 40), name)
  const lines = run.steps.map((s) => `${s.status === 'pass' ? 'PASS' : s.status === 'fail' ? 'FAIL' : 'INFO'} · ${s.label} — ${s.detail} (${s.ms}ms)`)
  return `${name}: ${run.status.toUpperCase()} (${run.steps.filter((s) => s.status === 'pass').length}/${run.steps.length} steps passed)\n${lines.join('\n')}`
}

/**
 * One-click check for a discovered control: click it, look for console errors,
 * navigation or DOM growth. Used by the Test panel's per-control buttons.
 */
export async function testControl(control: ControlInfo, opts: { expectNavigate?: boolean } = {}): Promise<TestRun> {
  const steps: TestStep[] = []
  if (control.kind === 'input') {
    steps.push({ action: 'type', target: control.uid, text: control.currentValue || 'test input', note: `type into "${control.name}"` })
    steps.push({ action: 'assert', checks: [{ kind: 'noConsoleErrors' }], note: 'no console errors after typing' })
  } else {
    steps.push({ action: 'click', target: control.uid, note: `click "${control.name}"` })
    steps.push({ action: 'assert', checks: [{ kind: 'noConsoleErrors' }], note: 'no console errors after click' })
    if (opts.expectNavigate) steps.push({ action: 'assert', checks: [{ kind: 'count', selector: 'h1', expect: 1 }], note: 'target page has a heading' })
    steps.push({ action: 'snapshot', note: 'record resulting state' })
  }
  return await runSteps(steps, `${control.kind}: ${control.name}`)
}

/** Re-run a previous test exactly as it ran before. */
export async function replayRun(run: TestRun): Promise<TestRun> {
  return await runSteps(run.spec, `${run.name} (replay)`)
}

/** Snapshot the current screen as text (used by the Test panel report). */
export async function screenDigest(): Promise<string> {
  try {
    const snap = await designSession.call('snapshot', { maxNodes: 60 }, 12_000)
    return formatSnapshot(snap, 30)
  } catch (e: any) {
    return `Could not read the screen: ${e?.message ?? e}`
  }
}
