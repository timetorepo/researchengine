import React, { useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, Upload, Trash2, Database, Archive, GitMerge } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'

const COLLECTIONS = ['chats', 'articles', 'documents', 'quizzes', 'skills', 'spaces', 'citations', 'knowledge'] as const
type Col = typeof COLLECTIONS[number]

export function DataTab() {
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const state = useStore.getState()
  const [selected, setSelected] = useState<Col[]>([...COLLECTIONS])

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
    if (!confirm('Delete all chats, articles, citations and knowledge? This cannot be undone.')) return
    useStore.getState().resetAll()
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

      <div className="flex flex-wrap gap-2">
        <button onClick={clearAll} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
          style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
          <Trash2 size={15} /> Clear all data
        </button>
        <button onClick={() => ui.toast('Tip', 'Importing merges — it never overwrites your existing chats.', 'info')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
          <Upload size={15} /> How merge works
        </button>
      </div>

      <p className="text-[11.5px] mt-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        Nothing here is ever uploaded. There is no Research Engine cloud, account, or sync service — by design.
        Imported chats are tagged <span style={{ color: 'var(--warning)' }}>[Imported]</span> so you always know their source.
      </p>
    </div>
  )
}
