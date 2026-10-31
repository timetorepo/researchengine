import React, { useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowDownToLine, CheckCircle2, Download, Loader2, RefreshCw, RotateCcw,
  ShieldCheck, Sparkles, TriangleAlert, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { smoothCaretProps } from '@/components/input/SmoothText'
import HoldButton from '@/components/ui/reactbits/micro/HoldButton'
import BellToggle from '@/components/ui/reactbits/micro/BellToggle'
import { Switch } from '@/components/ui/heroui/Switch'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { useUpdates, formatBytes, phaseLabel } from '@/lib/updates/client'
import { useRunningVersion } from '@/lib/appVersion'
import { ChangelogPanel } from '@/components/settings/ChangelogPanel'
import { CHANGELOG } from '@/lib/updates/changelog'
import { History } from 'lucide-react'
import { saveNotice, updateNotice, warnNotice } from '@/stores/useNotices'

/**
 * Settings → Updates.
 *
 * The pitch, stated plainly because it is the reason this exists: an update
 * replaces the *program* and never the *library*. The card at the top says where
 * the library is, so the claim is checkable rather than reassuring.
 */
export function UpdatesTab() {
  /**
   * Two things live here now: the update in front of you, and the record behind
   * it. They are different jobs — one is a button, the other is a library — so
   * they are two views rather than one long scroll.
   */
  const [view, setView] = useState<'updates' | 'history'>('updates')
  const settings = useStore((s) => s.settings)
  /** What this install is actually running — never a placeholder string. */
  const version = useRunningVersion()
  const update = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
  const autoCheck = settings.updates?.autoCheck !== false
  const autoDownload = settings.updates?.autoDownload === true
  const { status, check, error, notice, busy, refreshStatus, runCheck, install, installFromFile, restart, setError } =
    useUpdates({ autoCheck: false })
  const [checking, setChecking] = useState(false)
  const [justChecked, setJustChecked] = useState(false)
  const [archive, setArchive] = useState<File | null>(null)
  const [sums, setSums] = useState('')
  const [localNote, setLocalNote] = useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)
  const src = settings.updates ?? {}
  const patchSource = (patch: Partial<NonNullable<typeof settings.updates>>) =>
    update({ updates: { ...(settings.updates ?? {}), ...patch } })

  /** Hand the chosen archive to the server, which verifies it before swapping. */
  const doInstallFile = async () => {
    if (!archive) return
    setLocalNote('')
    const okGo = await installFromFile(archive, sums || undefined)
    setLocalNote(okGo
      ? 'Installed — restart to run it. Your library was not touched.'
      : 'The archive was refused. Nothing was changed.')
  }

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
    if (result?.available) updateNotice('Update available', `${result.latest} is out — you are on ${result.current}.`)
    else if (result) saveNotice('Up to date', `You are running the newest release (${result.current}).`)
  }

  const doInstall = async () => {
    const ok = await install()
    if (!ok) return
    const s = await refreshStatus()
    const fellBack = s?.kind === 'portable'
    toast(
      s?.kind === 'desktop' ? 'Download ready' : 'Update downloaded',
      // The server's own sentence, so an archive is never described as an
      // installer and vice versa.
      s?.progress?.message || notice || (fellBack
        ? 'Press “Restart now” to finish. Your library was not touched.'
        : 'Saved to your Downloads folder.'),
      'success',
    )
  }

  const doRestart = async () => {
    toast('Restarting', 'The server is starting again with the new version.', 'info')
    await restart()
  }

  const doRollback = async () => {
    try {
      const res = await fetch('/api/update/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? 'rollback failed')
      warnNotice('Rolled back', 'The previous version is on disk again — restart to run it.')
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
        {/* Two views, one line, and the count on the second one is real. */}
        <div className="flex items-center gap-1.5 mt-3">
          {([['updates', 'This install', RefreshCw], ['history', `Every version (${CHANGELOG.length})`, History]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
              style={{ color: view === id ? 'var(--text)' : 'var(--text-3)' }}>
              {view === id && (
                <motion.span layoutId="updates-view" className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                  transition={{ type: 'spring', stiffness: 540, damping: 42 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5"><Icon size={12} /> {label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'history' ? (
        <ChangelogPanel runningVersion={version} />
      ) : (
      <>
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
          <h3 className="text-[14px] font-semibold">Research Engine {version}</h3>
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
            <div>{error ?? progress?.error}</div>
            {/UNABLE_TO_VERIFY|certificate|self.signed|SELF_SIGNED/i.test(String(error ?? progress?.error)) && (
              <div className="mt-1" style={{ color: 'var(--text-2)' }}>
                This network uses its own certificate authority. Start the server with
                {' '}<code>NODE_EXTRA_CA_CERTS=/path/to/your-ca.pem</code>, or use a manifest URL or an archive file instead.
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="flat" onClick={doCheck} disabled={checking || running}>
            {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check for updates
          </Button>
          {check?.available && !pending && kind !== 'desktop' && (
            /* Swapping the running app is worth a deliberate press: hold to
               fill, then it installs. The desktop path below stays a plain
               button — it only downloads an installer you then run yourself. */
            <HoldButton
              size="md"
              holdTime={900}
              radius={10}
              wave
              glow
              disabled={busy || running}
              backgroundColor="var(--primary)"
              fillColor="color-mix(in srgb, var(--primary) 55%, #000)"
              textColor="#fff"
              fillTextColor="#fff"
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              onHold={doInstall}
            >
              {`Hold to install ${check.latest}`}
            </HoldButton>
          )}
          {check?.available && !pending && kind === 'desktop' && (
            <Button onClick={doInstall} disabled={busy || running}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {`Download ${check.latest} installer`}
            </Button>
          )}
          {/* Notes belong here, not behind a link to a repository that may be
              private. The popup is still one press away for the long version. */}
          {check?.available && (
            <Button variant="flat" onClick={() => useUI.setState({ updatePopup: check.latest ?? 'latest' })}>
              <Sparkles size={13} /> What's new
            </Button>
          )}
        </div>
      </section>

      {/* Where updates come from */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <h3 className="text-[14px] font-semibold mb-1">Where updates come from</h3>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          This project's repository is <b>private</b> while it is in beta, so an update needs one of three things.
          Any of them works; pick whichever suits how you got the app.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>
              1. A read-only token for the repository (works while it is private)
            </label>
            <input
              type="password"
              value={src.token ?? ''}
              onChange={(e) => patchSource({ token: e.target.value || undefined })}
              placeholder="github_pat_… or ghp_…"
              aria-label="GitHub token for updates"
              {...smoothCaretProps()}
              className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
              A fine-grained token with <b>Contents: read</b> on this repository is enough. It is sent to GitHub only,
              never logged, and only used when checking or installing.
            </div>
          </div>
          <div>
            <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>
              2. Repository (leave empty for the built-in one)
            </label>
            <input
              value={src.repo ?? ''}
              onChange={(e) => patchSource({ repo: e.target.value || undefined })}
              placeholder="timetorepo/researchengine"
              aria-label="Update repository"
              {...smoothCaretProps()}
              className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
          </div>
          <div>
            <label className="text-[11.5px] block mb-1" style={{ color: 'var(--text-3)' }}>
              3. Your own release manifest — any static URL, no GitHub at all
            </label>
            <input
              value={src.manifestUrl ?? ''}
              onChange={(e) => patchSource({ manifestUrl: e.target.value || undefined })}
              placeholder="https://example.com/research-engine/latest.json"
              aria-label="Release manifest URL"
              {...smoothCaretProps()}
              className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
              <code>{'{"version":"0.31.0-beta.1","notes":"…","archive":"https://…/research-engine-0.31.0-beta.1-linux-x64.tar.gz"}'}</code>
              {' '}— one JSON file answers every install. Set this and the GitHub paths are not used.
            </div>
          </div>
          <div className="pt-1" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="text-[11.5px] font-medium mt-3 mb-1">Or update from a file you already have</div>
            <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-3)' }}>
              Download the release archive yourself (from the repo, a shared drive, anywhere) and hand it over —
              it is checked against <code>SHA256SUMS</code> exactly like the online path, and your library is never touched.
            </p>
            <input ref={fileRef} type="file" accept=".tar.gz,.tgz,.zip" className="hidden"
              aria-label="Release archive"
              onChange={(e) => { setArchive(e.target.files?.[0] ?? null); setLocalNote(''); e.target.value = '' }} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="flat" onClick={() => fileRef.current?.click()} disabled={busy}>
                <FolderOpen size={13} /> Choose archive…
              </Button>
              {archive && <span className="text-[11.5px] font-mono" style={{ color: 'var(--text-2)' }}>{archive.name}</span>}
              <Button onClick={doInstallFile} disabled={busy || !archive}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />} Install from file
              </Button>
            </div>
            <textarea
              value={sums}
              onChange={(e) => setSums(e.target.value)}
              rows={2}
              placeholder="Optional: paste the SHA256SUMS line for that file (needed when this machine cannot reach the release)"
              aria-label="Checksum text"
              {...smoothCaretProps()}
              className="w-full mt-2 px-3 py-2 rounded-[10px] text-[11.5px] font-mono outline-none resize-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
            {localNote && <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-2)' }}>{localNote}</div>}
          </div>
        </div>
        <div className="text-[11px] mt-3" style={{ color: 'var(--text-3)' }}>
          Reading from: <b>{status?.source?.manifestUrl ? 'your manifest' : (status?.source?.repo ?? 'timetorepo/researchengine')}</b>
          {status?.source?.token === 'set' ? ' · token set' : ''}
        </div>
      </section>

      {/* Preferences */}
      <section className="surface p-4" style={{ borderRadius: 'var(--radius-card)' }}>
        <h3 className="text-[14px] font-semibold mb-2">Preferences</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="pr-3">
            <div className="text-[12.5px] font-medium">Notify me of updates</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              The bell rings on launch, and again when something newer than this build is out.
            </div>
          </div>
          <BellToggle
            pressed={autoCheck}
            onChange={(v) => update({ updates: { ...(settings.updates ?? {}), autoCheck: v } })}
            label="Notify me of updates"
          />
        </div>
        <Switch
          checked={autoCheck}
          onChange={(v) => update({ updates: { ...(settings.updates ?? {}), autoCheck: v } })}
          label="Check quietly when the app opens"
          description="One request to GitHub when the app opens."
        />
        <div className="mt-3">
          <Switch
            checked={autoDownload}
            disabled={!autoCheck}
            onChange={(v) => update({ updates: { ...(settings.updates ?? {}), autoDownload: v } })}
            label="Download updates on launch"
            description={kind === 'portable'
              ? 'When a newer release is found on launch, it is downloaded and verified in the background. It is installed only when you press Restart now.'
              : 'Only for the portable build. The desktop app and source checkouts keep the download button.'}
          />
        </div>
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
      </>
      )}
    </div>
  )
}
