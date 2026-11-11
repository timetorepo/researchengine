import React, { useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, Upload, Trash2, Database, Archive, GitMerge } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'
// SmoothUI's AIApproval — the card you decide in, with the destructive option
// marked as destructive.
import AIApproval from '@/components/smoothui/ai-approval'
// shadcn-space @shadcn-space/button-28 — the hold-to-charge button. This is the
// only place it is used, and the only action in the app that erases everything:
// a click is too cheap for it, so it asks for a press that is held on purpose.
import { HoldToChargeButton } from '@/components/shadcn-space/button/button-28'

const COLLECTIONS = ['chats', 'articles', 'documents', 'quizzes', 'skills', 'spaces', 'citations', 'knowledge'] as const
type Col = typeof COLLECTIONS[number]

export function DataTab() {
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const state = useStore.getState()
  const [selected, setSelected] = useState<Col[]>([...COLLECTIONS])
  /** Wiping everything is the one irreversible thing in Settings, so it asks
   *  with a real card instead of the browser's confirm dialog. */
  const [confirmClear, setConfirmClear] = useState(false)

  const sizeKB = Math.round(JSON.stringify({
    chats: state.chats, articles: state.articles, skills: state.skills, citations: state.citations,
    knowledge: state.knowledge, documents: state.documents, quizzes: state.quizzes,
  }).length / 1024)

  const snapshot = () => {
    const s = useStore.getState()
    return {
      version: 2, exportedAt: new Date().toISOString(), app: 'research-engine',
      chats: s.chats, articles: s.articles, skills: s.skills, spaces: s.spaces,
      citations: s.citations, knowledge: s.knowledge, documents: s.documents, quizzes: s.quizzes,
    }
  }

  const exportJson = () => {
    download('research-engine-backup.json', JSON.stringify(snapshot(), null, 2), 'application/json')
    ui.toast('Exported', 'Full backup downloaded as JSON.', 'success')
  }

  const exportZip = async () => {
    const data = snapshot() as Record<string, any>
    const zip = new JSZip()
    const manifest = {
      app: 'research-engine',
      schema: 2,
      exportedAt: data.exportedAt,
      counts: Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(data[c]) ? data[c].length : 0])),
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    for (const c of COLLECTIONS) {
      if (!selected.includes(c)) continue
      zip.file(`data/${c}.json`, JSON.stringify(data[c] ?? [], null, 2))
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-engine-export-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    ui.toast('Exported', `ZIP archive with ${selected.length} collections downloaded.`, 'success')
  }

  /* Merge import: accept JSON backup or ZIP export; imported chats get a source tag. */
  const mergePayload = (p: any) => {
    if (!p || typeof p !== 'object') throw new Error('bad payload')
    useStore.setState((s) => {
      const tag = <T extends { title?: string; name?: string }>(items: T[]): T[] =>
        items.map((i: any) => ({ ...i, title: i.title ? (i.imported ? i.title : `[Imported] ${i.title}`) : i.title, imported: true }))
      return {
        chats: [...(tag(p.chats ?? []) as any), ...s.chats],
        articles: [...(p.articles ?? []), ...s.articles],
        documents: [...(p.documents ?? []), ...s.documents],
        quizzes: [...(p.quizzes ?? []), ...s.quizzes],
        skills: [...(p.skills ?? []).filter((sk: any) => !s.skills.find((x) => x.id === sk.id)), ...s.skills],
        spaces: [...(p.spaces ?? []).filter((sp: any) => !s.spaces.find((x) => x.id === sp.id)), ...s.spaces],
        citations: [...(p.citations ?? []).filter((c: any) => !s.citations.find((x) => x.url === c.url)), ...s.citations],
        knowledge: [...(p.knowledge ?? []), ...s.knowledge],
      }
    })
  }

  const importFile = async (f: File) => {
    try {
      if (f.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(f)
        const merged: Record<string, any> = {}
        for (const c of COLLECTIONS) {
          const entry = zip.file(`data/${c}.json`)
          if (entry) merged[c] = JSON.parse(await entry.async('string'))
        }
        mergePayload(merged)
      } else {
        mergePayload(JSON.parse(await f.text()))
      }
      ui.toast('Import merged', 'Imported items were merged into your library and tagged.', 'success')
    } catch {
      ui.toast('Import failed', 'Not a valid backup file.', 'danger')
    }
  }

  const clearAll = () => {
    useStore.getState().resetAll()
    setConfirmClear(false)
    ui.toast('Cleared', 'All local research data has been removed.', 'warning')
  }

  const toggle = (c: Col) => setSelected((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
        <Database size={20} style={{ color: 'var(--primary)' }} /> Data
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        Everything lives in your browser's local storage. Export it, move it, or wipe it.
      </p>

      <div className="surface p-4 mb-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-[13px] font-medium">Local database size</div>
          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            {sizeKB} KB across {state.chats.length} chats · {state.articles.length} articles · {state.documents.length} documents
          </div>
        </div>
      </div>

      {/* Bring conversations from other AI products */}
      <ImportSection />

      {/* Selective export */}
      <div className="surface p-4 mb-4">
        <div className="text-[12.5px] font-medium mb-2 flex items-center gap-1.5"><Archive size={13} style={{ color: 'var(--primary)' }} /> Collections to include in ZIP export</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {COLLECTIONS.map((c) => (
            <button key={c} onClick={() => toggle(c)}
              className="px-2.5 py-1 rounded-full text-[11.5px] capitalize transition-colors"
              style={{
                background: selected.includes(c) ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
                color: selected.includes(c) ? 'var(--primary)' : 'var(--text-3)',
                border: `1px solid ${selected.includes(c) ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'transparent'}`,
              }}>
              {c} ({Array.isArray((state as any)[c]) ? (state as any)[c].length : 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportZip} disabled={!selected.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] font-medium disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <Archive size={15} /> Export as ZIP
          </button>
          <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Download size={15} /> Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <GitMerge size={15} /> Import &amp; merge
          </button>
          <input ref={fileRef} type="file" accept="application/json,.zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
        </div>
      </div>

      {confirmClear ? (
        <AIApproval
          className="max-w-[460px]"
          question="Delete every chat, article, citation and knowledge card on this device?"
          options={[
            { id: 'export', label: 'Export a backup first', detail: 'Download a JSON copy, then decide' },
            { id: 'delete', label: 'Delete everything', detail: 'Immediate, local, and cannot be undone', destructive: true },
            { id: 'cancel', label: 'Keep my data' },
          ]}
          onDecide={(o) => {
            if (o.id === 'delete') clearAll()
            else if (o.id === 'export') { exportJson(); setConfirmClear(false); ui.toast('Backup downloaded', 'Keep it somewhere safe, then clear when you are ready.', 'success') }
            else setConfirmClear(false)
          }}
        >
          <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
            Nothing here is ever uploaded, so there is no copy on a server to restore from.
          </p>
        </AIApproval>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {/* Hold to erase. A click is too cheap for the one irreversible
              action in the app, so this one charges up while held (1.5 s) and
              lets go the moment the pointer leaves. */}
          <HoldToChargeButton
            label="Hold to erase everything"
            holdingLabel="Keep holding…"
            completedLabel="Everything erased"
            holdDuration={1500}
            autoResetDelay={2500}
            variant="destructive"
            onComplete={clearAll}
          />
          <button onClick={() => { exportJson(); ui.toast('Backup downloaded', 'Keep it somewhere safe.', 'success') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
            <Download size={15} /> Export a backup first
          </button>
          <button onClick={() => ui.toast('Tip', 'Importing merges — it never overwrites your existing chats.', 'info')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
            style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
            <Upload size={15} /> How merge works
          </button>
        </div>
      )}

      <p className="text-[11.5px] mt-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        Nothing here is ever uploaded. There is no Research Engine cloud, account, or sync service — by design.
        Imported chats are tagged <span style={{ color: 'var(--warning)' }}>[Imported]</span> so you always know their source.
      </p>
    </div>
  )
}

/**
 * Transfer in: a ChatGPT or Claude export becomes ordinary Sessions in this
 * history. The file is read in the browser; nothing is uploaded.
 */
function ImportSection() {
  const ui = useUI()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState('')

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const { readExportFile } = await import('@/lib/transfer/import')
      const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
      const res = await readExportFile(file, makeId)
      if (!res || res.chats.length === 0) {
        ui.toast('Nothing to import', 'That is not a ChatGPT or Claude export. Choose conversations.json, or the zip ChatGPT sends.', 'warning')
        return
      }
      useStore.setState((st) => ({ chats: [...res.chats, ...st.chats] }))
      const from = res.source === 'chatgpt' ? 'ChatGPT' : 'Claude'
      const skipped = res.skipped ? `, ${res.skipped} empty one${res.skipped === 1 ? '' : 's'} skipped` : ''
      const msg = `${res.chats.length} conversation${res.chats.length === 1 ? '' : 's'} from ${from}${skipped}.`
      setLast(msg)
      ui.toast('Imported', msg, 'success')
    } catch {
      ui.toast('Import failed', 'That file could not be read. Check that it is the JSON or zip the provider exported.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface p-4 mb-4">
      <div className="text-[12.5px] font-medium mb-1">Bring your conversations from ChatGPT or Claude</div>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
        Export your data from the provider, then choose the zip or conversations.json here. Each conversation becomes a Session in your history, read entirely in this browser.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => ref.current?.click()} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Upload size={13} /> {busy ? 'Reading…' : 'Choose export file'}
        </button>
        {last && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{last}</span>}
        <input ref={ref} type="file" accept=".json,.zip,application/json,application/zip" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = '' }} />
      </div>
    </div>
  )
}
