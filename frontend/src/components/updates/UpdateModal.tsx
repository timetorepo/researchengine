import { BoardProgressCircle } from '@/components/ui/boardui/Progress'
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
 *
 * The layout is deliberately quiet, in the way Apple's own sheets are: one
 * centred thing to do, a large round action, and nothing competing with it.
 * While an install runs the card shows only its progress; it cannot be closed
 * until the install finishes, so a half-written update is never left behind.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowDownToLine, Check, Copy, ExternalLink, Loader2, RefreshCw, Sparkles, TriangleAlert, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/heroui/Button'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { useUpdates, formatBytes, phaseLabel } from '@/lib/updates/client'
import { useRunningVersion } from '@/lib/appVersion'
import { ReleaseNotes } from '@/components/updates/ReleaseNotes'
import { ReadmeCard, prefetchReadme } from '@/components/updates/ReadmeCard'
import { UpdateRing, SuccessMark } from '@/components/updates/UpdateMotion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@heroui/react'

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


/** One status card: a HeroUI Card with a tinted tone, used for ready / done / failed. */
function UpdateCard({ tone, icon, title, children }: {
  tone: 'primary' | 'success' | 'danger'
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  const color = `var(--${tone})`
  return (
    <Card
      variant="secondary"
      className="mb-4 gap-1 p-4 text-[12.5px]"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: 'var(--text-2)' }}
    >
      <CardHeader className="flex-row items-center gap-2 p-0">
        <span className="shrink-0" style={{ color }}>{icon}</span>
        <CardTitle className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pl-6">{children}</CardContent>
    </Card>
  )
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
  /** The card is in its install view: progress only, nothing to press. */
  const [installing, setInstalling] = useState(false)
  /** An install finished and the card shows the done view. */
  const [doneOk, setDoneOk] = useState(false)
  /** "Read more" is open: the README takes the place of the release notes. */
  const [readmeOpen, setReadmeOpen] = useState(false)

  // Fresh notes every time it opens. The server caches its own check for ten
  // minutes, so an idle re-open costs nothing.
  useEffect(() => {
    if (!open) return
    let live = true
    setChecking(true)
    setCopied(false)
    setReadmeOpen(false)
    setDoneOk(false)
    setInstalling(false)
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
  const busyInstall = installing || running

  // The README is read on the server as soon as a release is found, so "Read
  // more" opens with the text already there.
  useEffect(() => {
    if (check?.available && latest) prefetchReadme(latest)
  }, [check?.available, latest])

  /** Remember that this version has been shown, so the popup does not reopen. */
  const skipVersion = () => {
    useStore.setState((s) => ({
      settings: { ...s.settings, updates: { ...(s.settings.updates ?? {}), dismissed: latest || undefined } },
    }))
    close()
  }

  const gitCommand = 'git pull && npm install && npm run build'
  const doInstall = async () => {
    setInstalling(true)
    setDoneOk(false)
    let ok = false
    try {
      ok = await install(latest || undefined)
    } finally {
      setInstalling(false)
    }
    if (ok) setDoneOk(true)
    await refreshStatus()
  }

  const meta = useMemo(() => {
    if (!check) return ''
    const bits: string[] = []
    if (check.publishedAt) bits.push(`published ${publishedWhen(check.publishedAt)}`)
    if (check.asset?.name) bits.push(`${check.asset.name}${check.asset.size ? ` · ${formatBytes(check.asset.size)}` : ''}`)
    return bits.join(' · ')
  }, [check])

  const actionWord = kind === 'desktop' ? 'Download installer' : 'Update'

  return (
    <Modal
      isOpen={!!open}
      onOpenChange={(v) => { if (!v && !busyInstall) close() }}
      size="lg"
      backdrop="blur"
      scrollBehavior="inside"
      placement="center"
      hideCloseButton={busyInstall}
      isDismissable={!busyInstall}
      isKeyboardDismissDisabled={busyInstall}
      classNames={{
        wrapper: 'z-[80]',
        backdrop: 'z-[79] bg-[var(--scrim)]',
        base: 'glass overflow-hidden rounded-[28px] border border-[var(--surface-border)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]',
        header: 'px-6 pt-6 pb-2',
        body: 'px-6 py-4',
        footer: 'px-6 py-4 border-t border-[var(--surface-border)]',
        closeButton: 'top-4 right-4 text-[var(--text-3)] hover:bg-[var(--elevated)]',
      }}
      aria-label={`Update to ${latest}`}
      data-update-modal
    >
      <ModalContent>
        {/* While an install runs, the card is only its progress. Nothing else. */}
        {busyInstall ? (
          <div className="flex flex-col items-center text-center px-8 py-12" data-update-progress aria-live="polite">
            <BoardProgressCircle value={progress && progress.total > 0 ? progress.pct : undefined} label={progress?.message || 'Installing update'} size={96} />
            <div className="mt-7 text-[18px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}>
              {progress?.message || phaseLabel(progress?.phase ?? 'downloading')}
            </div>
            {progress && progress.total > 0 && (
              <div className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                {formatBytes(progress.received)} of {formatBytes(progress.total)}
              </div>
            )}
            <p className="mt-9 text-[12.5px] max-w-[300px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Don’t close this card yet. Wait for the popup.
            </p>
          </div>
        ) : doneOk ? (
          <div className="flex flex-col items-center text-center px-8 py-10" data-update-done>
            <SuccessMark />
            <div className="mt-6 text-[20px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {kind === 'desktop' ? 'Installer ready' : 'Update installed'}
            </div>
            <p className="mt-2 text-[13px] max-w-[320px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {kind === 'desktop'
                ? `Run the installer to move to ${latest}. Your library is not touched.`
                : `Research Engine ${latest} is ready. Restart to start using it.`}
            </p>
            <div className="mt-7 flex w-full flex-col gap-2.5">
              {pending && kind !== 'desktop' && (
                <button onClick={restart} disabled={busy}
                  className="h-14 w-full rounded-full text-[16px] font-semibold disabled:opacity-60"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  <span className="inline-flex items-center gap-2"><RefreshCw size={15} /> Restart now</span>
                </button>
              )}
              <button onClick={close} className="h-11 w-full rounded-full text-[14px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <ModalHeader className="flex-col items-center gap-2 text-center pr-10">
              <span
                className="flex items-center justify-center w-14 h-14 rounded-[18px]"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 85%, #fff), var(--primary))', color: '#fff', boxShadow: '0 12px 30px -10px color-mix(in srgb, var(--primary) 70%, transparent)' }}
              >
                <Sparkles size={24} strokeWidth={1.8} />
              </span>
              <span className="mt-2 text-[21px] font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--text)' }}>
                {latest ? `Research Engine ${latest}` : 'Research Engine'}
              </span>
              <span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>
                {check?.available ? 'is available' : checking ? 'Checking for updates…' : 'You are up to date'}
                {' · '}You are on <b style={{ color: 'var(--text)' }}>{version}</b>
                {pending ? ` · ${pending.to} is already on disk` : ''}
              </span>
            </ModalHeader>

            <ModalBody>
              {pending && (
                <UpdateCard tone="primary" icon={<RefreshCw size={14} />} title={`Version ${pending.to} is ready`}>
                  Restart when you are ready to run it.
                </UpdateCard>
              )}

              {failure && (
                <UpdateCard tone="danger" icon={<TriangleAlert size={14} />} title="Could not download or install.">
                  <div>{failure}</div>
                  <div className="mt-1" style={{ color: 'var(--text-3)' }}>
                    Nothing was changed. Settings → Updates can also install an archive you already have.
                  </div>
                </UpdateCard>
              )}

              {notice && (
                <UpdateCard tone="success" icon={<Check size={14} />} title="Done">
                  {notice}
                </UpdateCard>
              )}

              {checking && !check && (
                <div className="flex items-center justify-center gap-2 text-[12.5px] py-8" style={{ color: 'var(--text-3)' }}>
                  <Loader2 size={14} className="animate-spin" /> Asking GitHub what the newest release is…
                </div>
              )}

              {check && !check.available && !pending && !running && (
                <div className="text-center text-[12.5px] py-2" style={{ color: 'var(--text-2)' }}>
                  The newest release is {check.current}. Nothing to install.
                </div>
              )}

              {check?.available && (
                <>
                  {/* The one large action. Round, full width, and the only filled thing here. */}
                  {kind !== 'checkout' && (
                    <button
                      onClick={doInstall}
                      disabled={busy || running}
                      className="mt-1 h-14 w-full rounded-full text-[17px] font-semibold tracking-tight transition-transform active:scale-[0.985] disabled:opacity-60"
                      style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 14px 34px -14px color-mix(in srgb, var(--primary) 80%, transparent)' }}
                    >
                      {actionWord} {latest}
                    </button>
                  )}

                  {/* What's new: the release notes, or — once opened — the README. One card, grows in place. */}
                  <motion.div
                    layout
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 overflow-hidden"
                    style={{ borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {readmeOpen && latest ? (
                        <motion.div key="readme" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                          <ReadmeCard version={latest} onBack={() => setReadmeOpen(false)} />
                        </motion.div>
                      ) : (
                        <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                            <ArrowDownToLine size={14} strokeWidth={1.8} style={{ color: 'var(--primary)' }} />
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>What's new in {latest}</span>
                            {meta && <span className="ml-auto text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{meta}</span>}
                          </div>
                          <div className="px-5 pb-2 text-[13px] leading-relaxed max-h-[180px] overflow-y-auto pane-scroll" style={{ color: 'var(--text-2)' }}>
                            <ReleaseNotes notes={notes} />
                          </div>
                          <button
                            onClick={() => setReadmeOpen(true)}
                            className="flex w-full items-center justify-between px-5 py-3 text-[13px] font-medium hover:bg-[var(--elevated)]"
                            style={{ borderTop: '1px solid var(--surface-border)', color: 'var(--primary)' }}
                          >
                            Read more
                            <ChevronRight size={15} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {kind === 'checkout' && (
                    <div className="mt-4 flex items-center gap-2 rounded-[18px] p-2 pl-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                      <code className="flex-1 truncate text-[12px]" style={{ color: 'var(--text-2)' }}>{gitCommand}</code>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(gitCommand)
                          setCopied(true)
                          window.setTimeout(() => setCopied(false), 1500)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px]"
                        style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {pending && (
                <button onClick={restart} disabled={busy}
                  className="mt-4 h-14 w-full rounded-full text-[17px] font-semibold disabled:opacity-60"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  <span className="inline-flex items-center gap-2"><RefreshCw size={15} /> Restart now</span>
                </button>
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
                {!pending && kind === 'checkout' && (
                  <Button variant="flat" onClick={close}>Close</Button>
                )}
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
