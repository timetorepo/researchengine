import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, PlayCircle, CheckCircle2, XCircle, Loader2, Copy, Trash2, RefreshCw, ShieldAlert, Bug } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { Switch } from '@/components/ui/heroui/Switch'
import { APP_VERSION, BUILD_ID } from '@/components/settings/AboutTab'
import { Button } from '@/components/ui/heroui/Button'
import { SAMPLE_PROJECT } from '@/lib/ide/sample'
import { createProjectRobust, postJson } from '@/lib/ide/create'

/**
 * Developer Mode, and the create-project test bench.
 *
 * The bench exists because "it still doesn't work" is not something a
 * screenshot can settle. Both buttons below run the *same* code the app runs —
 * `createProjectRobust`, the same payload shape, the same server — and print
 * what actually happened: the request body, the HTTP status, the response
 * body, how long it took and how many attempts it needed. Whatever it says is
 * a fact the next bug report can carry.
 */

interface Step { label: string; value: string; tone?: 'ok' | 'bad' | 'dim' }
interface RunResult {
  kind: 'project' | 'sample'
  ok: boolean
  when: number
  ms: number
  summary: string
  steps: Step[]
  raw: string
}

async function projectsOnDisk(): Promise<string[]> {
  try {
    const res = await fetch('/api/ide/projects')
    const j = await res.json()
    return (j.projects ?? []).map((p: any) => p.name)
  } catch { return [] }
}

export function DeveloperTab() {
  const settings = useStore((s) => s.settings)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
  const [busy, setBusy] = useState<'project' | 'sample' | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const refreshHealth = useCallback(async () => {
    try { setHealth(await (await fetch('/api/health')).json()) } catch { setHealth({ error: 'could not reach the backend' }) }
  }, [])
  useEffect(() => { void refreshHealth() }, [refreshHealth])

  /** Run one create flow end-to-end and keep every intermediate fact. */
  const run = async (kind: 'project' | 'sample') => {
    setBusy(kind); setResult(null)
    const started = Date.now()
    const taken = await projectsOnDisk()
    const stamp = Date.now().toString(36).slice(-4)
    const name = kind === 'sample' ? `sample-landing` : `dev-test-${stamp}`
    const fallback = kind === 'sample' ? 'sample-app' : 'dev-test'
    const files = kind === 'sample' ? SAMPLE_PROJECT : { 'README.md': `# ${name}\n\nCreated by the Settings → Developer test.\n` }
    const payload = { name, fallback, files: Object.keys(files), taken, unique: true }
    const steps: Step[] = [
      { label: 'POST', value: '/api/ide/projects' },
      { label: 'Request', value: JSON.stringify({ ...payload, files: payload.files.slice(0, 6).concat(Object.keys(files).length > 6 ? ['…'] : []) }) },
      { label: 'Projects already on disk', value: taken.length ? taken.join(', ') : '(none)', tone: 'dim' },
    ]
    let outcome
    const t0 = performance.now()
    try {
      outcome = await createProjectRobust(postJson, { name, fallback, files, taken, unique: true })
    } catch (e: any) {
      outcome = { ok: false, error: String(e?.message ?? e), attempts: 1 } as any
    }
    const ms = Math.round(performance.now() - t0)
    steps.push({ label: 'Attempts', value: String(outcome.attempts) })
    steps.push({
      label: 'Result',
      value: outcome.ok ? `201/200 — created “${outcome.name}”${outcome.renamed ? ' (renamed)' : ''}${outcome.invented ? ' (name invented by the server)' : ''}` : `FAILED — ${outcome.error}`,
      tone: outcome.ok ? 'ok' : 'bad',
    })

    // Leave nothing behind: a successful test project is deleted immediately,
    // so the bench can be run as often as you like without filling the list.
    if (outcome.ok && outcome.name) {
      try {
        const del = await fetch(`/api/ide/projects/${encodeURIComponent(outcome.name)}`, { method: 'DELETE' })
        steps.push({ label: 'Cleanup', value: `deleted “${outcome.name}” (${del.status})`, tone: del.ok ? 'dim' : 'bad' })
      } catch (e: any) {
        steps.push({ label: 'Cleanup', value: `could not delete the test project (${String(e?.message ?? e)})`, tone: 'bad' })
      }
    }

    const summary = outcome.ok
      ? kind === 'sample' ? 'The sample app can be created.' : 'A project can be created.'
      : 'This is the failure to report.'
    const res: RunResult = {
      kind, ok: !!outcome.ok, when: Date.now(), ms, summary, steps,
      raw: JSON.stringify({ kind, name, fallback, attempts: outcome.attempts, ok: outcome.ok, error: outcome.error, ms }, null, 2),
    }
    setResult(res)
    // Also into the notice trail, so Settings → About → Notices keeps it.
    useUI.getState().toast(
      res.ok ? `Test passed — ${summary}` : `Test failed — ${summary}`,
      res.ok ? `Took ${ms} ms over ${outcome.attempts} request(s).` : String(outcome.error),
      res.ok ? 'success' : 'danger',
    )
    setBusy(null)
  }

  const copy = async () => {
    const report = buildReport(result, health)
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  const served = health?.web?.served
  const source = health?.web?.source

  return (
    <div className="space-y-4">
      <section className="surface-elevated p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Terminal size={16} strokeWidth={1.6} style={{ color: 'var(--primary)' }} />
          <h3 className="text-[14px] font-semibold">Developer Mode</h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
          Adds a build fingerprint to the top bar, keeps the create-project test bench below, and shows
          the raw status and response body in failure messages instead of a summary.
        </p>
        <Switch
          checked={!!settings.developerMode}
          onChange={(v) => { update({ developerMode: v }); useUI.getState().toast(v ? 'Developer Mode on' : 'Developer Mode off', v ? 'Build fingerprint and raw errors are visible.' : 'Back to the quiet interface.', 'info') }}
          label="Enable Developer Mode"
          description="Same app, more of its working parts showing."
        />
      </section>

      <section className="surface-elevated p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Bug size={16} strokeWidth={1.6} style={{ color: 'var(--warning)' }} />
          <h3 className="text-[14px] font-semibold">Test creating a project</h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
          Runs the real thing — the same helper, the same payload — then deletes what it made.
          If pressing <b>Try a sample app</b> ever fails, run it here and copy the report: it says
          exactly which request the server refused and why.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run('project')} disabled={busy !== null}>
            {busy === 'project' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Test: create a project
          </Button>
          <Button variant="flat" onClick={() => run('sample')} disabled={busy !== null}>
            {busy === 'sample' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Test: create the sample app
          </Button>
          <Button variant="flat" onClick={copy} disabled={!result}>
            <Copy size={14} /> {copied ? 'Copied' : 'Copy report'}
          </Button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-[12px] p-3"
            style={{ background: 'var(--surface)', border: `1px solid ${result.ok ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--danger) 45%, transparent)'}` }}
            data-create-test-result={result.ok ? 'pass' : 'fail'}>
            <div className="flex items-center gap-2 mb-2">
              {result.ok ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> : <XCircle size={15} style={{ color: 'var(--danger)' }} />}
              <span className="text-[13px] font-medium">{result.summary}</span>
              <span className="ml-auto text-[11px]" style={{ color: 'var(--text-3)' }}>{result.ms} ms</span>
            </div>
            <div className="space-y-1">
              {result.steps.map((s, i) => (
                <div key={i} className="flex gap-2 text-[11.5px] font-mono break-all">
                  <span className="shrink-0 w-[132px]" style={{ color: 'var(--text-3)' }}>{s.label}</span>
                  <span style={{ color: s.tone === 'bad' ? 'var(--danger)' : s.tone === 'ok' ? 'var(--success)' : s.tone === 'dim' ? 'var(--text-3)' : 'var(--text-2)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </section>

      <section className="surface-elevated p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} strokeWidth={1.6} style={{ color: 'var(--text-2)' }} />
          <h3 className="text-[14px] font-semibold">Environment</h3>
          <button onClick={refreshHealth} className="ml-auto flex items-center gap-1 text-[11.5px] hover:underline" style={{ color: 'var(--primary)' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="space-y-1">
          <Row label="App version" value={APP_VERSION} />
          <Row label="Build id" value={BUILD_ID} />
          <Row label="Served bundle" value={served ? `${served.version} (${served.builtAt ?? 'unknown build time'})` : '—'} />
          <Row label="Source on disk" value={source?.version ?? '—'} />
          <Row label="Install mode" value={health?.web?.mode ?? '—'} />
          <Row label="Backend" value={health?.ok ? 'reachable' : health?.error ?? 'checking…'} tone={health?.ok ? 'ok' : 'bad'} />
          <Row label="Data directory" value={health?.db?.dir ?? health?.db?.path ?? 'see server log'} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="flat" onClick={() => useUI.setState({ diagnostics: true })}>
            <Bug size={14} /> Open diagnostics
          </Button>
          <Button variant="flat" onClick={() => useUI.setState({ settingsTab: 'about', settingsOpen: true })}>
            <Copy size={14} /> Notice trail (About)
          </Button>
          <Button variant="flat" onClick={() => void clearTestProjects()}>
            <Trash2 size={14} /> Delete test projects
          </Button>
        </div>
      </section>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex gap-3 text-[12px]">
      <span className="w-[132px] shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="font-mono break-all" style={{ color: tone === 'bad' ? 'var(--danger)' : tone === 'ok' ? 'var(--success)' : 'var(--text-2)' }}>{value}</span>
    </div>
  )
}

/** Any project whose name marks it as a test artifact. */
async function clearTestProjects() {
  const names = await projectsOnDisk()
  const junk = names.filter((n) => /^dev-test-|^sample-landing-\d+$|^untitled-project/.test(n))
  for (const n of junk) await fetch(`/api/ide/projects/${encodeURIComponent(n)}`, { method: 'DELETE' }).catch(() => null)
  useUI.getState().toast(junk.length ? 'Test projects removed' : 'Nothing to remove', junk.length ? junk.join(', ') : 'No test projects were on disk.', 'info')
}

function buildReport(result: RunResult | null, health: any): string {
  const lines = [
    'Research Engine — create-path report',
    `when        : ${new Date().toISOString()}`,
    `app version : ${APP_VERSION}`,
    `build id    : ${BUILD_ID}`,
    `served      : ${health?.web?.served?.version ?? '?'} (${health?.web?.served?.builtAt ?? '?'})`,
    `source      : ${health?.web?.source?.version ?? '?'}`,
    `mode        : ${health?.web?.mode ?? '?'}`,
    '',
  ]
  if (!result) lines.push('(no test run yet)')
  else {
    lines.push(`test        : ${result.kind === 'sample' ? 'create the sample app' : 'create a project'}`)
    lines.push(`verdict     : ${result.ok ? 'PASSED' : 'FAILED'} — ${result.summary}`)
    lines.push(`duration    : ${result.ms} ms`)
    for (const s of result.steps) lines.push(`  ${s.label}: ${s.value}`)
    lines.push('', 'raw:', result.raw)
  }
  return lines.join('\n')
}
