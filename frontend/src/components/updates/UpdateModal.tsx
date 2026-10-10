/**
 * "A new version is out" — as a real popup, using HeroUI's Modal.
 *
 * Two things this replaces:
 *
 *   • a small pill in the top bar that nobody notices until they go looking,
 *     which is not how you tell someone their app has a newer version;
 *   • a "Release notes" link pointing at the release's GitHub page, which is a
 *     404 on a repository that is still private — the notes were already in the
 *     check result, so they are rendered here instead.
 *
 * The component is HeroUI's `Modal` (the real package, styled with this app's
 * tokens — see the `@heroui-classes` block in globals.css), so the portal,
 * focus trap, Escape handling, scroll lock and the enter/exit animation are
 * theirs and not a re-implementation.
 *
 * Nothing installs by itself: the popup tells you, shows what changed, and waits
 * for a press.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { ArrowDownToLine, Check, Copy, ExternalLink, Loader2, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { useUpdates, formatBytes, phaseLabel } from '@/lib/updates/client'
import { useRunningVersion } from '@/lib/appVersion'
import { ReleaseNotes } from '@/components/updates/ReleaseNotes'

const KINDS = {
  portable: { label: 'portable install', action: 'Download & install' },
  desktop: { label: 'desktop app', action: 'Download installer' },
  checkout: { label: 'source checkout', action: 'How to update' },
} as const

function publishedWhen(iso: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const days = Math.round((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function UpdateModal() {
  const open = useUI((s) => s.updatePopup)
  const ui = useUI()
  const settings = useStore((s) => s.settings)
  const version = useRunningVersion()
  const { check, status, error, notice, busy, runCheck, install, refreshStatus, restart, setError, clearNotice } =
    useUpdates({ autoCheck: false })
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fresh notes every time it opens. The server caches its own check for ten
  // minutes, so an idle re-open costs nothing.
  useEffect(() => {
    if (!open) return
    let live = true
    setChecking(true)
    setCopied(false)
    clearNotice()
    void (async () => {
      await runCheck(true)
      await refreshStatus()
      if (live) setChecking(false)
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runCheck, refreshStatus])

  const close = () => { useUI.setState({ updatePopup: null }); setError(null); clearNotice() }

  const progress = status?.progress
  const running = !!progress && ['downloading', 'verifying', 'extracting', 'swapping'].includes(progress.phase)
  const pending = status?.pending ?? null
  const kind = (check?.kind ?? status?.kind ?? 'checkout') as keyof typeof KINDS
  const latest = check?.latest ?? pending?.to ?? open ?? ''
  const notes = check?.notes ?? ''
  const failure = error ?? progress?.error ?? null

  /** Remember that this version has been shown, so the popup does not reopen. */
  const skipVersion = () => {
    useStore.setState((s) => ({
      settings: { ...s.settings, updates: { ...(s.settings.updates ?? {}), dismissed: latest || undefined } },
    }))
    close()
  }

  const gitCommand = 'git pull && npm install && npm run build'
  const doInstall = async () => {
    const ok = await install(latest || undefined)
    if (ok) await refreshStatus()
  }

  const meta = useMemo(() => {
    if (!check) return ''
    const bits: string[] = []
    if (check.publishedAt) bits.push(`published ${publishedWhen(check.publishedAt)}`)
    if (check.asset?.name) bits.push(`${check.asset.name}${check.asset.size ? ` · ${formatBytes(check.asset.size)}` : ''}`)
    return bits.join(' · ')
  }, [check])

  return (
    <Modal
      isOpen={!!open}
      onOpenChange={(v) => { if (!v) close() }}
      size="2xl"
      backdrop="blur"
      scrollBehavior="inside"
      placement="center"
      hideCloseButton={false}
      isDismissable
      classNames={{
        wrapper: 'z-[80]',
        backdrop: 'z-[79] bg-[var(--scrim)]',
        base: 'glass overflow-hidden border border-[var(--surface-border)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]',
        header: 'px-5 pt-5 pb-3 border-b border-[var(--surface-border)]',
        body: 'px-5 py-4',
        footer: 'px-5 py-4 border-t border-[var(--surface-border)]',
        closeButton: 'top-4 right-4 text-[var(--text-3)] hover:bg-[var(--elevated)]',
      }}
      aria-label={`Update to ${latest}`}
      data-update-modal
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1 pr-10">
          <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}
            >
              <Sparkles size={13} />
            </span>
            Research Engine {latest || ''} is available
          </span>
          <span className="text-[12px] font-normal" style={{ color: 'var(--text-2)' }}>
            You are running <b style={{ color: 'var(--text)' }}>{version}</b>
            {pending ? ` · ${pending.to} is already on disk and waiting for a restart` : ''}
          </span>
        </ModalHeader>

        <ModalBody>
          {/* The install engine's own words, whichever kind of build this is. */}
          {running && progress && (
            <div className="mb-4">
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
                <div className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.max(3, progress.pct)}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-[12px] mb-4 text-[12.5px]"
              style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--text-2)' }}>
              <Check size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
              <div>{notice}</div>
            </div>
          )}

          {failure && (
            <div className="flex items-start gap-2 p-3 rounded-[12px] mb-4 text-[12.5px]"
              style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--text-2)' }}>
              <TriangleAlert size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div>
                <b style={{ color: 'var(--text)' }}>Could not download or install.</b>
                <div className="mt-0.5">{failure}</div>
                <div className="mt-1" style={{ color: 'var(--text-3)' }}>
                  Nothing was changed. Settings → Updates can also install an archive you already have.
                </div>
              </div>
            </div>
          )}

          {checking && !check && (
            <div className="flex items-center gap-2 text-[12.5px] py-6 justify-center" style={{ color: 'var(--text-3)' }}>
              <Loader2 size={14} className="animate-spin" /> Asking GitHub what the newest release is…
            </div>
          )}

          {check && !check.available && !pending && !running && (
            <div className="text-[12.5px] mb-1" style={{ color: 'var(--text-2)' }}>
              You are already on the newest release ({check.current}).
            </div>
          )}

          {check?.available && (
            <>
              {/* Release notes, inline — no trip to a private repo's web page. */}
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownToLine size={14} strokeWidth={1.7} style={{ color: 'var(--primary)' }} />
                <span className="text-[12.5px] font-semibold">What's new in {latest}</span>
                {meta && <span className="ml-auto text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{meta}</span>}
              </div>
              <div
                className="rounded-[12px] p-3.5 text-[12.5px] leading-relaxed max-h-[240px] overflow-y-auto pane-scroll"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
              >
                <ReleaseNotes notes={notes} />
              </div>

              {kind === 'checkout' && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-[10px] text-[11.5px] truncate"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                    {gitCommand}
                  </code>
                  <Button variant="flat" onClick={() => {
                    void navigator.clipboard.writeText(gitCommand)
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1500)
                  }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="flex-wrap gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { close(); ui.openSettings('updates') }}>
              Update settings
            </Button>
            {check?.url && (
              <a href={check.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[12px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                <ExternalLink size={12} /> GitHub
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipVersion}>Skip this version</Button>
            {pending && (
              <Button onClick={restart} disabled={busy}>
                <RefreshCw size={13} /> Restart now
              </Button>
            )}
            {!pending && check?.available && kind !== 'checkout' && (
              <Button onClick={doInstall} disabled={busy || running}>
                {busy || running ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
                {KINDS[kind].action} {latest}
              </Button>
            )}
            {!pending && kind === 'checkout' && (
              <Button variant="flat" onClick={close}>Close</Button>
            )}
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
