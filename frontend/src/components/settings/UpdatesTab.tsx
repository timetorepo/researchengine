import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownToLine, CheckCircle2, Download, HardDriveDownload, Loader2, RefreshCw, RotateCcw,
  ShieldCheck, Sparkles, TriangleAlert, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { Switch } from '@/components/ui/heroui/Switch'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { useUpdates, formatBytes, phaseLabel } from '@/lib/updates/client'
import { APP_VERSION } from '@/components/settings/AboutTab'

/**
 * Settings → Updates.
 *
 * The pitch, stated plainly because it is the reason this exists: an update
 * replaces the *program* and never the *library*. The card at the top says where
 * the library is, so the claim is checkable rather than reassuring.
 */
export function UpdatesTab() {
  const settings = useStore((s) => s.settings)
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
  const autoCheck = settings.updates?.autoCheck !== false
  const { status, check, error, busy, refreshStatus, runCheck, install, setError } = useUpdates({ autoCheck: false })
  const [checking, setChecking] = useState(false)
  const [justChecked, setJustChecked] = useState(false)

  const toast = (title: string, body: string, tone: 'success' | 'danger' | 'info' = 'info') =>
    useUI.getState().toast(title, body, tone)

  const progress = status?.progress
  const running = !!progress && ['downloading', 'verifying', 'extracting', 'swapping'].includes(progress.phase)
  const pending = status?.pending ?? null
  const outcome = status?.outcome ?? null
  const kind = status?.kind ?? check?.kind ?? 'checkout'
  const canSelfUpdate = status?.canSelfUpdate ?? check?.canSelfUpdate ?? false

  const doCheck = async () => {
    setChecking(true)
    const result = await runCheck(true)
    setChecking(false)
    setJustChecked(true)
    if (result?.available) toast('Update available', `${result.latest} is out — you are on ${result.current}.`, 'success')
    else if (result) toast('Up to date', `You are running the newest release (${result.current}).`, 'success')
  }

  const doInstall = async () => {
    const ok = await install()
    if (ok) {
      const s = await refreshStatus()
      if (s?.kind === 'desktop') toast('Installer ready', 'Opened it for you — your library is where it was.', 'success')
      else toast('Update downloaded', 'Press “Restart now” to finish. Your library was not touched.', 'success')
    }
  }

  const doRestart = async () => {
    toast('Restarting', 'The server is starting again with the new version.', 'info')
    try { await fetch('/api/update/restart', { method: 'POST' }) } catch { /* the request dies with the server */ }
    // Give the server a moment to come back before reloading the page.
    setTimeout(() => window.location.reload(), 4000)
  }

  const doRollback = async () => {
    try {
      const res = await fetch('/api/update/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? 'rollback failed')
      toast('Rolled back', 'The previous version is on disk again — restart to run it.', 'success')
      await refreshStatus()
    } catch (e: any) {
      setError(String(e?.message ?? e))
    }
  }

  const doDismiss = async () => {
    await fetch('/api/update/dismiss', { method: 'POST' }).catch(() => null)
    await refreshStatus()
  }

  // What the update path is for this install, said in one line.
  const pathLine = kind === 'portable'
    ? 'Updates install themselves: download, verify, swap, restart.'
    : kind === 'desktop'
      ? 'The desktop app updates through its installer — this page downloads the verified one and opens it for you.'
      : 'You are running from a source checkout — update with git pull && npm run build.'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Updates</h2>
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
          Keep the app current without losing anything. An update replaces the program and <b>never</b> the library.
        </p>
      </div>

      {/* Where your data is — the claim, made checkable. */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'var(--elevated)', color: 'var(--success)' }}>
            <ShieldCheck size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-medium">Your library is never part of an update</div>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>
              Chats, documents, settings and keys live in the data folder below. The updater is not allowed to write
              there — it refuses to, and the test suite proves it by hashing the folder before and after an update.
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11.5px] font-mono px-2 py-1 rounded-[8px] w-fit max-w-full"
              style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
              <FolderOpen size={12} className="shrink-0" />
              <span className="truncate">{status?.dataDir ?? '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Current state */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine size={16} strokeWidth={1.6} style={{ color: 'var(--primary)' }} />
          <h3 className="text-[14px] font-semibold">Research Engine {APP_VERSION}</h3>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
            {kind === 'portable' ? 'portable install' : kind === 'desktop' ? 'desktop app' : 'source checkout'}
          </span>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>{pathLine}</p>

        {/* An update that has been downloaded but not started */}
        {pending && (
          <div className="flex items-start gap-2.5 p-3 rounded-[12px] mb-3"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 34%, transparent)' }}>
            <Sparkles size={15} style={{ color: 'var(--primary)' }} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-[12.5px]">
              <b>{pending.to} is installed and waiting.</b> The files are in place, the previous version is kept as a
              backup, and your library has not been touched.
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Button onClick={doRestart}><RotateCcw size={13} /> Restart now</Button>
                <Button variant="flat" onClick={doRollback}><RotateCcw size={13} /> Roll back to {pending.from}</Button>
              </div>
            </div>
          </div>
        )}

        {/* The result of the last update (or rollback) */}
        {outcome && !pending && (
          <div className="flex items-start gap-2.5 p-3 rounded-[12px] mb-3"
            style={{
              background: outcome.ok ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--warning) 12%, transparent)',
              border: `1px solid color-mix(in srgb, ${outcome.ok ? 'var(--success)' : 'var(--warning)'} 30%, transparent)`,
            }}>
            {outcome.ok ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} className="shrink-0 mt-0.5" />
              : <TriangleAlert size={15} style={{ color: 'var(--warning)' }} className="shrink-0 mt-0.5" />}
            <div className="flex-1 text-[12.5px]">
              {outcome.ok
                ? <><b>Update to {outcome.to} completed.</b> It has been serving pages since {new Date(outcome.at).toLocaleString()}; the backup was dropped.</>
                : <><b>The update to {outcome.from} was rolled back.</b> {outcome.reason ?? 'It did not start.'} You are running {outcome.to || 'the previous version'} again, with everything intact.</>}
              <button onClick={doDismiss} className="block mt-1 text-[11.5px] hover:underline" style={{ color: 'var(--text-3)' }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Progress */}
        {running && progress && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-[12.5px] mb-1.5">
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span>{progress.message || phaseLabel(progress.phase)}</span>
              {progress.total > 0 && (
                <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {formatBytes(progress.received)} / {formatBytes(progress.total)}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--primary)' }}
                animate={{ width: `${Math.max(3, progress.pct)}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
              />
            </div>
          </div>
        )}

        {/* What the last check found */}
        {!running && check && (
          <div className="text-[12.5px] mb-3" style={{ color: 'var(--text-2)' }}>
            {check.available ? (
              <span>Newest release: <b style={{ color: 'var(--text)' }}>{check.latest}</b> — you are on {check.current}.</span>
            ) : justChecked ? (
              <span>You are on the newest release ({check.current}).</span>
            ) : (
              <span>Newest release: <b style={{ color: 'var(--text)' }}>{check.latest ?? '—'}</b>.</span>
            )}
          </div>
        )}

        {(error || progress?.error) && (
          <div className="text-[12px] px-3 py-2 rounded-[10px] mb-3"
            style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
            {error ?? progress?.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="flat" onClick={doCheck} disabled={checking || running}>
            {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check for updates
          </Button>
          {check?.available && !pending && (
            <Button onClick={doInstall} disabled={busy || running}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {kind === 'desktop' ? `Download ${check.latest} installer` : `Install ${check.latest}`}
            </Button>
          )}
          {check?.url && (
            <a href={check.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px]"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <HardDriveDownload size={13} /> Release notes
            </a>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <h3 className="text-[14px] font-semibold mb-2">Preferences</h3>
        <Switch
          checked={autoCheck}
          onChange={(v) => update({ updates: { ...(settings.updates ?? {}), autoCheck: v } })}
          label="Check quietly when the app opens"
          description="One request to GitHub. Nothing is ever downloaded or installed without you pressing the button."
        />
        {!canSelfUpdate && kind === 'checkout' && (
          <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-3)' }}>
            In a source checkout the updater still tells you when something newer exists. Run the packaged build
            (or the desktop app) to get one-click updates.
          </p>
        )}
        {kind === 'desktop' && (
          <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-3)' }}>
            The desktop app cannot replace its own running binary, so it downloads the release installer, checks it
            against the release, and hands it to your OS. Your library lives in the folder above either way.
          </p>
        )}
      </section>

      {/* What an update does, step by step */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <h3 className="text-[14px] font-semibold mb-2">What an update does</h3>
        <ol className="text-[12.5px] space-y-1.5" style={{ color: 'var(--text-2)' }}>
          <li>1. Reads the newest release from GitHub (prereleases included).</li>
          <li>2. Downloads the archive for your platform.</li>
          <li>3. Checks its SHA-256 against the <span className="font-mono">SHA256SUMS</span> committed at that tag — a mismatch stops everything before a byte is written.</li>
          <li>4. Unpacks into <span className="font-mono">.update/stage</span> inside the app folder and checks it really is a Research Engine server.</li>
          <li>5. Moves the new <span className="font-mono">server/</span>, <span className="font-mono">frontend-dist/</span> and <span className="font-mono">bin/</span> into place, keeping the previous ones as a backup.</li>
          <li>6. Restarts. If the new version cannot serve pages, the previous one is put back automatically.</li>
        </ol>
      </section>
    </div>
  )
}
