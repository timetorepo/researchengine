/**
 * What the agent may reach, and what it brought back.
 *
 * Two things a person needs when an agent has a shell: the boundary, stated in
 * one sentence, and the list of things that came in from outside. The boundary
 * is chosen here (project · chosen folders · the whole computer) and the list
 * is the download ledger, with each entry's VirusTotal verdict on its face.
 * Nothing on this panel is a promise the backend does not enforce.
 */
import React, { useEffect, useState } from 'react'
import {
  FolderLock, FolderKey, HardDrive, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Download, GitBranch, Loader2, Check, X, ExternalLink, RefreshCw, KeyRound,
} from 'lucide-react'
import { useAccess, ACCESS_LABEL, FULL_ACCESS_PHRASE, type AccessMode } from '@/lib/ide/access'
import { useDownloads, vtTone, vtLabel, type DownloadEvent } from '@/lib/ide/downloads'
import { formatBytes } from '@/lib/updates/client'

const MODE_ICON: Record<AccessMode, React.ReactNode> = {
  project: <FolderLock size={13} />,
  selected: <FolderKey size={13} />,
  full: <HardDrive size={13} />,
}

const MODE_NOTE: Record<AccessMode, string> = {
  project: 'The AI reads and runs commands only inside the open project folder. This is the default.',
  selected: 'The project, plus each folder you list below. Everything else stays out of reach.',
  full: 'Every file this account can read. Only choose this if you mean it — commands can then touch anything you can.',
}

export function AgentSafety() {
  const access = useAccess()
  const downloads = useDownloads()
  const [rootDraft, setRootDraft] = useState('')
  const [phrase, setPhrase] = useState('')
  const [askingFull, setAskingFull] = useState(false)
  const [vt, setVt] = useState<{ configured: boolean; source: string } | null>(null)
  const [vtDraft, setVtDraft] = useState('')
  const [vtError, setVtError] = useState('')
  const [vtBusy, setVtBusy] = useState(false)

  useEffect(() => { void access.load(); void downloads.load(); void loadVt() }, [])

  const loadVt = async () => {
    try {
      const res = await fetch('/api/agent/virustotal')
      setVt(await res.json())
    } catch { setVt({ configured: false, source: 'none' }) }
  }

  const saveVt = async () => {
    setVtBusy(true); setVtError('')
    try {
      const res = await fetch('/api/agent/virustotal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: vtDraft.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setVtError(json?.error ?? `HTTP ${res.status}`); return }
      setVtDraft(''); setVt({ configured: true, source: 'saved' })
    } finally { setVtBusy(false) }
  }

  const clearVt = async () => {
    await fetch('/api/agent/virustotal', { method: 'DELETE' })
    setVt({ configured: false, source: 'none' })
  }

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-4" data-agent-safety>
      {/* ---------- the boundary ---------- */}
      <section className="flex flex-col gap-2">
        <header className="flex items-center gap-2">
          <ShieldCheck size={13} style={{ color: 'var(--ide-accent)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>What the AI can reach</span>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          {(['project', 'selected', 'full'] as AccessMode[]).map((m) => (
            <button key={m} onClick={() => { if (m === 'full' && access.mode !== 'full') { setAskingFull(true) } else { void access.setMode(m) } }}
              data-access-mode={m}
              className="text-left rounded-[10px] px-2.5 py-2 flex flex-col gap-1"
              style={{
                background: access.mode === m ? 'color-mix(in srgb, var(--ide-accent) 14%, transparent)' : 'var(--ide-hover, var(--elevated))',
                border: `1px solid ${access.mode === m ? 'color-mix(in srgb, var(--ide-accent) 40%, transparent)' : 'transparent'}`,
              }}>
              <span className="flex items-center gap-1.5 text-[11.5px] font-medium"
                style={{ color: access.mode === m ? 'var(--ide-accent)' : 'var(--ide-text)' }}>
                {MODE_ICON[m]} {ACCESS_LABEL[m]}
              </span>
              <span className="text-[10.5px] leading-snug" style={{ color: 'var(--ide-faint)' }}>{MODE_NOTE[m]}</span>
            </button>
          ))}
        </div>

        {askingFull && (
          <div className="rounded-[10px] px-3 py-2 flex flex-col gap-2"
            style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)' }}>
            <span className="text-[11.5px]" style={{ color: 'var(--ide-text)' }}>
              Full computer access means any command the AI runs can read, change or delete anything your account can.
              Nothing outside this app will ask again.
            </span>
            <div className="flex items-center gap-2">
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)}
                placeholder={`Type “${FULL_ACCESS_PHRASE}” to continue`}
                aria-label="Confirmation phrase"
                className="ide-input text-[11.5px] flex-1" />
              <button disabled={phrase.trim().toLowerCase() !== FULL_ACCESS_PHRASE.toLowerCase()}
                onClick={() => { setAskingFull(false); setPhrase(''); void access.setMode('full') }}
                className="ide-btn primary" style={{ height: 26 }}>
                <Check size={11} /> Allow full access
              </button>
              <button onClick={() => { setAskingFull(false); setPhrase('') }} className="ide-btn outlined" style={{ height: 26 }}>
                <X size={11} /> Cancel
              </button>
            </div>
          </div>
        )}

        {access.mode !== 'full' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--ide-faint)' }}>Folders the AI may read</span>
            {access.roots.length === 0 && (
              <span className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>None yet — the project folder is always included.</span>
            )}
            {access.roots.map((root) => (
              <div key={root} className="flex items-center gap-2 text-[11.5px] font-mono" style={{ color: 'var(--ide-dim)' }}>
                <FolderKey size={11} />
                <span className="truncate">{root}</span>
                <button onClick={() => void access.removeRoot(root)} className="ml-auto ide-icon-btn" style={{ width: 20, height: 20 }} aria-label={`Remove ${root}`}>
                  <X size={11} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input value={rootDraft} onChange={(e) => setRootDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && rootDraft.trim()) { void access.addRoot(rootDraft); setRootDraft('') } }}
                placeholder="~/Documents/references — absolute or ~ path"
                aria-label="Folder to allow"
                className="ide-input text-[11.5px] flex-1" />
              <button onClick={() => { if (rootDraft.trim()) { void access.addRoot(rootDraft); setRootDraft('') } }}
                className="ide-btn outlined" style={{ height: 26 }}>Add</button>
            </div>
          </div>
        )}

        <span className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>
          Right now: {access.reaches}
          {access.mode !== 'full' && ' Commands that reach further are refused with the path that failed.'}
        </span>
      </section>

      {/* ---------- VirusTotal ---------- */}
      <section className="flex flex-col gap-2">
        <header className="flex items-center gap-2">
          <ShieldCheck size={13} style={{ color: vt?.configured ? 'var(--success, #16a34a)' : 'var(--ide-faint)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>VirusTotal checks</span>
          <span className="text-[11px]" style={{ color: vt?.configured ? 'var(--success, #16a34a)' : 'var(--ide-faint)' }}>
            {vt === null ? 'checking…' : vt.configured ? `on · key ${vt.source === 'environment' ? 'from the environment' : 'saved on this machine'}` : 'off'}
          </span>
          {vt?.configured && (
            <button onClick={() => void clearVt()} className="ml-auto text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>Turn off</button>
          )}
        </header>
        {!vt?.configured && (
          <>
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ide-dim)' }}>
              Every link the agent downloads from is checked before the download starts, and the file is checked again by
              its SHA-256 after. Paste a VirusTotal API key to switch that on — free keys are available to anyone with an
              account.
            </p>
            <div className="flex items-center gap-2">
              <input value={vtDraft} onChange={(e) => setVtDraft(e.target.value)} type="password"
                placeholder="64-character VirusTotal API key" aria-label="VirusTotal API key"
                className="ide-input text-[11.5px] font-mono flex-1" />
              <button onClick={() => void saveVt()} disabled={vtBusy || !vtDraft.trim()} className="ide-btn primary" style={{ height: 26 }}>
                {vtBusy ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />} Save
              </button>
              <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noreferrer"
                className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ide-accent)' }}>
                Get a key <ExternalLink size={10} />
              </a>
            </div>
            {vtError && <span className="text-[11px]" style={{ color: 'var(--danger)' }}>{vtError}</span>}
            <span className="text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
              virus total dot com → sign in → your API key. The free tier allows about 500 lookups a day, which is far more
              than a day of building needs.
            </span>
          </>
        )}
        {vt?.configured && (
          <p className="text-[11.5px]" style={{ color: 'var(--ide-dim)' }}>
            Downloads are announced when they start and their verdict is shown when they finish. A link flagged by any
            engine is refused before a byte is fetched; a file flagged after arrival is kept in the project and marked
            dangerous, so you can look at it and delete it deliberately.
          </p>
        )}
      </section>

      {/* ---------- the ledger ---------- */}
      <section className="flex flex-col gap-1.5 min-h-0">
        <header className="flex items-center gap-2">
          <Download size={13} style={{ color: 'var(--ide-dim)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text)' }}>What the agent brought in</span>
          <span className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>{downloads.events.length ? `${downloads.events.length} event${downloads.events.length === 1 ? '' : 's'}` : 'nothing yet'}</span>
          <button onClick={() => void downloads.load()} className="ml-auto ide-icon-btn" style={{ width: 22, height: 22 }} aria-label="Refresh">
            {downloads.loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </button>
        </header>
        {downloads.events.length === 0 && (
          <span className="text-[11px]" style={{ color: 'var(--ide-faint)' }}>
            Clones, installs and downloads started by the agent appear here — with the VirusTotal result for each.
          </span>
        )}
        {[...downloads.events].reverse().map((e, i) => <LedgerRow key={`${e.at}-${i}`} e={e} />)}
      </section>
    </div>
  )
}

function LedgerRow({ e }: { e: DownloadEvent }) {
  const tone = vtTone(e.vt)
  const Icon = e.vt === 'clean' ? ShieldCheck : e.vt === 'malicious' ? ShieldX : e.vt === 'suspicious' ? ShieldAlert : ShieldQuestion
  const what = e.kind === 'download' ? (e.path ?? e.url ?? '') : (e.command ?? '')
  return (
    <div className="rounded-[9px] px-2.5 py-2 flex flex-col gap-1"
      style={{ background: 'var(--ide-hover, var(--elevated))', border: e.refused ? '1px solid color-mix(in srgb, var(--danger) 35%, transparent)' : '1px solid transparent' }}>
      <div className="flex items-center gap-2">
        {e.kind === 'download' ? <Download size={11} style={{ color: 'var(--ide-faint)' }} /> : <GitBranch size={11} style={{ color: 'var(--ide-faint)' }} />}
        <span className="text-[11.5px] font-mono truncate" style={{ color: 'var(--ide-text)' }} title={what}>{what}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] shrink-0" style={{ color: tone }}>
          <Icon size={11} /> {vtLabel(e.vt)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--ide-faint)' }}>
        <span>{new Date(e.at).toLocaleString()}</span>
        {e.project && <span>· {e.project}</span>}
        {typeof e.bytes === 'number' && e.bytes > 0 && <span>· {formatBytes(e.bytes)}</span>}
        {e.total ? <span>· {e.flagged ?? 0}/{e.total} engines flagged</span> : null}
        {e.sha256 && <span className="font-mono truncate">· {e.sha256.slice(0, 16)}…</span>}
      </div>
      <span className="text-[11px]" style={{ color: 'var(--ide-dim)' }}>{e.note}</span>
    </div>
  )
}
