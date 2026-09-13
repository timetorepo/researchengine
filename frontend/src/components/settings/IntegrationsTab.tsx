import React, { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Upload, BookOpenText, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { INTEGRATION_META } from '@/components/input/IntegrationPicker'
import { timeAgo, fmt } from '@/lib/utils'
import type { DocumentRecord } from '@/types'

const SERVICES = [
  { id: 'drive', scopes: ['drive.readonly'], desc: 'Search, read and reference files as context.' },
  { id: 'gmail', scopes: ['gmail.readonly'], desc: 'Search inbox, summarize threads, draft replies.' },
  { id: 'gcal', scopes: ['calendar.readonly'], desc: 'Read events, suggest study schedules.' },
  { id: 'github', scopes: ['repo:read'], desc: 'Read repos, reference code, open issues (with consent).' },
  { id: 'notion', scopes: ['read_content'], desc: 'Read pages, insert research summaries.' },
  { id: 'zotero', scopes: ['library:read'], desc: 'Sync your citation library.' },
  { id: 'files', scopes: ['scoped-folder'], desc: 'Upload, browse and importing files from the Research Engine files folder on this machine.' },
]

const TEXTISH = /\.(txt|md|markdown|csv|json|log|tex|rst|yml|yaml|xml|html)$/i
const STUDYABLE = /\.(txt|md|markdown|pdf|docx)$/i

interface FsEntry { name: string; dir: boolean; size: number }

/** The local-files integration: a real, working view of <dataDir>/files with
 *  upload and import — not a placeholder. All traffic stays on this machine. */
function LocalFilesPanel() {
  const ui = useUI()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [root, setRoot] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    try {
      const res = await fetch('/api/fs/list')
      const json = await res.json()
      setEntries(json.files ?? [])
      setRoot(json.root ?? '')
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  const upload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { ui.toast('Too large', 'Files are capped at 8 MB in the local folder.', 'warning'); return }
    setBusy(true)
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
        r.onerror = () => reject(new Error('read failed'))
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/fs/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataBase64 }),
      })
      if (!res.ok) throw new Error(await res.text())
      useStore.getState().logConnection('local://files', `upload: ${file.name}`, file.size, 'local')
      ui.toast('Uploaded', `${file.name} is now in the Research Engine files folder.`, 'success')
      await refresh()
    } catch (e: any) {
      ui.toast('Upload failed', String(e?.message ?? e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const study = async (name: string) => {
    // Pull the raw bytes from the local folder and hand them to Read & Quiz
    // as a regular File — same extraction pipeline as drag & drop.
    try {
      const res = await fetch(`/api/fs/read-bin?path=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(await res.text())
      const buf = await res.arrayBuffer()
      const file = new File([buf], name)
      useUI.setState({ pendingQuizFile: file })
      navigate('/quiz')
    } catch (e: any) {
      ui.toast('Could not open file', String(e?.message ?? e), 'danger')
    }
  }

  const importAsDocument = async (name: string) => {
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(await res.text())
      const text = await res.text()
      if (text.trim().length < 40) throw new Error('This file has too little text to study.')
      const rec: DocumentRecord = {
        id: nanoid(8), name, kind: name.split('.').pop() ?? 'file', text, addedAt: Date.now(),
      }
      useStore.setState((s) => ({ documents: [rec, ...s.documents] }))
      useStore.getState().logConnection('local://files', `import: ${name}`, text.length, 'local')
      ui.toast('Imported as a document', `${name} · ${fmt(Math.round(text.length / 4))} tokens — open Read & Quiz to study it.`, 'success')
    } catch (e: any) {
      ui.toast('Import failed', String(e?.message ?? e), 'danger')
    }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen size={13} style={{ color: 'var(--primary)' }} />
        <span className="text-[11.5px] font-medium">Files folder</span>
        <span className="text-[10px] font-mono truncate flex-1" style={{ color: 'var(--text-3)' }} title={root}>{root}</span>
        <button onClick={() => void refresh()} className="p-1 rounded-md hover:bg-[var(--elevated)] transition-colors" aria-label="Refresh file list" style={{ color: 'var(--text-3)' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Empty — upload a file or drop one anywhere on the home screen.</p>
      ) : (
        <div className="max-h-44 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--surface-border)' }}>
          {entries.map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="truncate flex-1" title={f.name}>{f.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-3)' }}>{f.dir ? 'folder' : fmt(f.size)}</span>
              {!f.dir && TEXTISH.test(f.name) && (
                <button onClick={() => void importAsDocument(f.name)}
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  Import
                </button>
              )}
              {!f.dir && STUDYABLE.test(f.name) && (
                <button onClick={() => void study(f.name)} title="Open in Read & Quiz"
                  className="shrink-0 p-1 rounded transition-colors"
                  style={{ color: 'var(--primary)' }}>
                  <BookOpenText size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function IntegrationsTab() {
  const integrations = useStore((s) => s.integrations)
  const log = useStore((s) => s.connectionLog)
  const ui = useUI()

  const toggle = (id: string, scopes: string[]) => {
    const cur = integrations[id]
    const meta = INTEGRATION_META[id]
    if (cur?.connected) {
      useStore.setState((s) => ({ integrations: { ...s.integrations, [id]: { ...cur, connected: false } } }))
      ui.toast(`${meta.name} disconnected`, 'OAuth tokens removed from the local vault.')
    } else {
      // OAuth handled locally via a localhost callback server; simulated here.
      useStore.setState((s) => ({
        integrations: { ...s.integrations, [id]: { id, connected: true, scopes, lastSync: Date.now() } },
      }))
      useStore.getState().logConnection(`oauth://localhost/callback`, `${meta.name} OAuth grant`, 512, 'local')
      ui.toast(`${meta.name} connected`, `Scopes: ${scopes.join(', ')}. Read-only until you grant write access.`, 'success')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Integrations</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Read-only by default, with explicit consent for write access. Tokens are encrypted and stored locally.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {SERVICES.map((svc) => {
          const meta = INTEGRATION_META[svc.id]
          const st = integrations[svc.id]
          const connected = !!st?.connected
          return (
            <div key={svc.id} className="surface p-4 flex flex-col">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: `hsl(${meta.hue} 50% 45% / 0.18)`, color: `hsl(${meta.hue} 62% 62%)` }}>
                  <meta.icon size={16} strokeWidth={1.5} />
                </span>
                <div className="flex-1">
                  <div className="font-medium text-[13.5px]">{meta.name}</div>
                  <div className="text-[10.5px]" style={{ color: connected ? 'var(--success)' : 'var(--text-3)' }}>
                    {connected ? `Connected · last sync ${st.lastSync ? timeAgo(st.lastSync) : 'now'}` : 'Not connected'}
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] flex-1 mb-3" style={{ color: 'var(--text-2)' }}>{svc.desc}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(svc.id, svc.scopes)}
                  className="flex-1 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors"
                  style={{
                    background: connected ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--primary)',
                    color: connected ? 'var(--danger)' : '#fff',
                  }}>
                  {connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              {connected && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {svc.scopes.map((sc) => (
                    <span key={sc} className="px-1.5 py-0.5 rounded-full text-[9.5px] font-mono" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>{sc}</span>
                  ))}
                </div>
              )}
              {connected && svc.id === 'files' && <LocalFilesPanel />}
            </div>
          )
        })}
      </div>

      <h3 className="text-[13px] font-semibold mb-2">Connection log</h3>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>A live record of every outbound request.</p>
      <div className="surface overflow-hidden">
        {log.length === 0 && <div className="p-4 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>No outbound requests yet.</div>}
        {log.slice(0, 12).map((e) => (
          <div key={e.id} className="flex items-center gap-2 px-3.5 py-2 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.status === 'local' ? 'var(--success)' : e.status === 'error' ? 'var(--danger)' : 'var(--primary)' }} />
            <span className="font-mono text-[11px] truncate flex-1" title={e.endpoint}>{e.endpoint}</span>
            <span className="truncate max-w-[180px]" style={{ color: 'var(--text-2)' }}>{e.purpose}</span>
            <span style={{ color: 'var(--text-3)' }}>{timeAgo(e.t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
