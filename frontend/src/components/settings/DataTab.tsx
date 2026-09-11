import React, { useRef } from 'react'
import { Download, Upload, Trash2, Database } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download } from '@/lib/utils'

export function DataTab() {
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const state = useStore.getState()

  const sizeKB = Math.round(JSON.stringify({
    chats: state.chats, articles: state.articles, skills: state.skills, citations: state.citations,
    knowledge: state.knowledge, documents: state.documents, quizzes: state.quizzes,
  }).length / 1024)

  const exportAll = () => {
    const data = useStore.getState()
    const payload = {
      version: 1, exportedAt: new Date().toISOString(),
      chats: data.chats, articles: data.articles, skills: data.skills, spaces: data.spaces,
      citations: data.citations, knowledge: data.knowledge, documents: data.documents, quizzes: data.quizzes,
    }
    download('research-engine-backup.json', JSON.stringify(payload, null, 2), 'application/json')
    ui.toast('Exported', 'Full backup downloaded as JSON.', 'success')
  }

  const importAll = (f: File) => {
    const r = new FileReader()
    r.onload = () => {
      try {
        const p = JSON.parse(String(r.result))
        useStore.setState((s) => ({
          chats: p.chats ?? s.chats, articles: p.articles ?? s.articles,
          skills: p.skills ?? s.skills, spaces: p.spaces ?? s.spaces,
          citations: p.citations ?? s.citations, knowledge: p.knowledge ?? s.knowledge,
          documents: p.documents ?? s.documents, quizzes: p.quizzes ?? s.quizzes,
        }))
        ui.toast('Imported', 'Backup restored.', 'success')
      } catch { ui.toast('Import failed', 'Not a valid backup file.', 'danger') }
    }
    r.readAsText(f)
  }

  const clearAll = () => {
    if (!confirm('Delete all chats, articles, citations and knowledge? This cannot be undone.')) return
    useStore.getState().resetAll()
    ui.toast('Cleared', 'All local research data has been removed.', 'warning')
  }

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

      <div className="flex flex-wrap gap-2">
        <button onClick={exportAll} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] font-medium"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <Download size={15} /> Export everything
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
          <Upload size={15} /> Import backup
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
        <button onClick={clearAll} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px]"
          style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
          <Trash2 size={15} /> Clear all data
        </button>
      </div>

      <p className="text-[11.5px] mt-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        Nothing here is ever uploaded. There is no Research Engine cloud, account, or sync service — by design.
      </p>
    </div>
  )
}
