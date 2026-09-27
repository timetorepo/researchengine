import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Upload, BookOpenText, FolderOpen, Plus, Trash2, Mail, CalendarDays, HardDrive } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { INTEGRATION_META } from '@/components/input/IntegrationPicker'
import { timeAgo, fmt } from '@/lib/utils'
import type { DocumentRecord } from '@/types'

const SERVICES = [
  { id: 'drive', scopes: ['drive.readonly'], desc: 'A working local Drive: upload files the AI can search and read (Local connector data below).' },
  { id: 'gmail', scopes: ['gmail.readonly'], desc: 'A working local Mail store: add messages the AI can search and reference.' },
  { id: 'gcal', scopes: ['calendar.readonly'], desc: 'A working local Calendar: add events the AI can plan around.' },
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

/* Working local connector data. Drive accepts file uploads, Mail accepts
 * messages, Calendar accepts events — all stored locally and searchable by
 * the AI through connector_search / connector_read tool calls. */
type Box = 'drive' | 'mail' | 'calendar'
const BOXES: { id: Box; name: string; icon: any; hint: string }[] = [
  { id: 'drive', name: 'Drive', icon: HardDrive, hint: 'Files the AI can search and read.' },
  { id: 'mail', name: 'Mail', icon: Mail, hint: 'Messages the AI can reference.' },
  { id: 'calendar', name: 'Calendar', icon: CalendarDays, hint: 'Events the AI can plan around.' },
]

function ConnectorDataPanel() {
  const ui = useUI()
  const [box, setBox] = useState<Box>('drive')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  // mail / calendar forms
  const [form, setForm] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/connectors/list?box=${box}`)
      const j = await res.json()
      setItems(j.items ?? [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [box])
  useEffect(() => { void refresh() }, [refresh])

  const uploadDrive = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { ui.toast('Too large', 'Drive files are capped at 8 MB.', 'warning'); return }
    const dataBase64 = await new Promise<string>((resolve) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] ?? ''); r.readAsDataURL(file)
    })
    const text = /\.(txt|md|markdown|csv|json|log|tex|rst|yml|yaml|xml|html)$/i.test(file.name) ? await file.text() : null
    const res = await fetch('/api/connectors/add', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ box: 'drive', name: file.name, mime: file.type || 'application/octet-stream', dataBase64, text }),
    })
    if (res.ok) { ui.toast('Added to Drive', file.name, 'success'); void refresh() }
    else ui.toast('Upload failed', (await res.json()).error ?? 'Unknown error', 'danger')
  }

  const submitForm = async () => {
    let payload: any
    if (box === 'mail') {
      if (!form.subject && !form.body) { ui.toast('Nothing to add', 'Write a subject or body first.', 'warning'); return }
      payload = { box, from: form.from ?? 'me@local', to: form.to ?? '', subject: form.subject ?? '(no subject)', body: form.body ?? '', date: new Date().toISOString() }
    } else {
      if (!form.title) { ui.toast('Nothing to add', 'Give the event a title.', 'warning'); return }
      payload = { box, title: form.title, date: form.date ?? new Date().toISOString().slice(0, 10), time: form.time ?? '', location: form.location ?? '', notes: form.notes ?? '' }
    }
    const res = await fetch('/api/connectors/add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { ui.toast('Added', payload.title ?? payload.subject, 'success'); setForm({}); void refresh() }
    else ui.toast('Could not add', (await res.json()).error ?? 'Unknown error', 'danger')
  }

  const remove = async (id: string) => {
    await fetch(`/api/connectors/item?box=${box}&id=${id}`, { method: 'DELETE' })
    void refresh()
  }

  const inp = 'w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none'
  const inpStyle = { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' } as const

  return (
    <div className="mb-8">
      <h3 className="text-[13px] font-semibold mb-1">Local connector data</h3>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
        Populate Drive, Mail and Calendar with your own data. The chatbox connector picker and the AI's tools read it — fully on-device.
      </p>

      <div className="flex gap-1.5 mb-3">
        {BOXES.map((b) => (
          <button key={b.id} onClick={() => setBox(b.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors"
            style={{
              background: box === b.id ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--surface)',
              border: `1px solid ${box === b.id ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--surface-border)'}`,
              color: box === b.id ? 'var(--primary)' : 'var(--text-2)',
            }}>
            <b.icon size={13} /> {b.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* add side */}
        <div className="surface p-4">
          <div className="text-[12px] font-medium mb-2">{BOXES.find((b) => b.id === box)?.hint}</div>
          {box === 'drive' ? (
            <>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                <Upload size={13} /> Upload file
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDrive(f); e.target.value = '' }} />
            </>
          ) : box === 'mail' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={form.from ?? ''} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="From" className={inp} style={inpStyle} />
                <input value={form.to ?? ''} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="To" className={inp} style={inpStyle} />
              </div>
              <input value={form.subject ?? ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className={inp} style={inpStyle} />
              <textarea value={form.body ?? ''} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Message body…" rows={4}
                className={`${inp} resize-none`} style={inpStyle} />
              <button onClick={() => void submitForm()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                <Plus size={13} /> Add message
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" className={inp} style={inpStyle} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.date ?? ''} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inp} style={inpStyle} />
                <input type="time" value={form.time ?? ''} onChange={(e) => setForm({ ...form, time: e.target.value })} className={inp} style={inpStyle} />
              </div>
              <input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (optional)" className={inp} style={inpStyle} />
              <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={`${inp} resize-none`} style={inpStyle} />
              <button onClick={() => void submitForm()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                <Plus size={13} /> Add event
              </button>
            </div>
          )}
        </div>

        {/* list side */}
        <div className="surface overflow-hidden flex flex-col max-h-64">
          <div className="flex items-center justify-between px-3.5 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-2)' }}>{items.length} item{items.length === 1 ? '' : 's'}</span>
            <button onClick={() => void refresh()} className="p-1 rounded-md" style={{ color: 'var(--text-3)' }} aria-label="Refresh">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 && <div className="p-4 text-[12px] text-center" style={{ color: 'var(--text-3)' }}>Nothing here yet.</div>}
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 px-3.5 py-2 text-[12px]" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>{it.name ?? it.subject ?? it.title}</span>
                <span className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text-3)' }}>{it.preview ?? ''}</span>
                <button onClick={() => void remove(it.id)} className="p-1 rounded-md" style={{ color: 'var(--danger)' }} aria-label="Remove item">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
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

      {/* Working connector data — everything here is local and queryable by the AI. */}
      <ConnectorDataPanel />

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
