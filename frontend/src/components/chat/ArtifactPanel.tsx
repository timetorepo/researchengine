// Side panel for code from a chat: the code, and a live preview served from localhost.
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Code2, Copy, ExternalLink, Eye, X } from 'lucide-react'
import { useArtifacts, publishPreview } from '@/lib/artifacts/store'
import { isRunnable, previewDocument, titleFor } from '@/lib/artifacts/preview'
import { highlight } from '@/lib/highlight'

type Tab = 'preview' | 'code'

export function ArtifactPanel() {
  const current = useArtifacts((s) => s.current)
  const close = useArtifacts((s) => s.close)
  return (
    <AnimatePresence>
      {current && <Panel key={current.code.length + current.lang + current.title} artifact={current} onClose={close} />}
    </AnimatePresence>
  )
}

function Panel({ artifact, onClose }: { artifact: { title: string; lang: string; code: string }; onClose: () => void }) {
  const runnable = isRunnable(artifact.lang)
  const [tab, setTab] = useState<Tab>(runnable ? 'preview' : 'code')
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const doc = useMemo(() => (runnable ? previewDocument(artifact.lang, artifact.code) : null), [artifact, runnable])
  const title = artifact.title || titleFor(artifact.lang, artifact.code)

  useEffect(() => {
    if (!doc) return
    let alive = true
    setError(null)
    publishPreview(doc)
      .then((r) => { if (alive) setUrl(r.url) })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)) })
    return () => { alive = false }
  }, [doc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = () => {
    navigator.clipboard.writeText(artifact.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.aside
      role="complementary"
      aria-label="Artifact"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 right-0 bottom-0 z-[70] flex flex-col w-full sm:w-[min(620px,56vw)]"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--surface-border)', boxShadow: '-12px 0 40px rgba(0,0,0,0.12)' }}
    >
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{title}</div>
          <div className="text-[10.5px] font-mono" style={{ color: 'var(--text-3)' }}>{artifact.lang || 'text'}</div>
        </div>
        {runnable && (
          <div role="tablist" className="flex rounded-[10px] p-0.5" style={{ background: 'var(--elevated)' }}>
            {(['preview', 'code'] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className="px-2.5 py-1 rounded-[8px] text-[11.5px] inline-flex items-center gap-1 transition-colors"
                style={{ background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text-3)' }}
              >
                {t === 'preview' ? <Eye size={12} /> : <Code2 size={12} />}
                {t === 'preview' ? 'Preview' : 'Code'}
              </button>
            ))}
          </div>
        )}
        <button onClick={copy} aria-label="Copy code" className="p-1.5 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open preview in a browser tab" className="p-1.5 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
            <ExternalLink size={14} />
          </a>
        )}
        <button onClick={onClose} aria-label="Close artifact" className="p-1.5 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
          <X size={14} />
        </button>
      </header>

      <div className="flex-1 min-h-0 relative">
        {tab === 'preview' && runnable ? (
          error ? (
            <div className="p-5 text-[12.5px]" style={{ color: 'var(--text-2)' }}>{error}</div>
          ) : url ? (
            <iframe
              key={url}
              src={url}
              title={title}
              sandbox="allow-scripts"
              className="w-full h-full border-0 bg-white"
            />
          ) : (
            <div className="p-5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>Starting the preview…</div>
          )
        ) : (
          <div className="absolute inset-0 overflow-auto">
            <pre className="!m-0 !rounded-none min-h-full text-[12.5px]">
              <code dangerouslySetInnerHTML={{ __html: highlight(artifact.code) }} />
            </pre>
          </div>
        )}
      </div>

      {runnable && (
        <footer className="px-4 py-1.5 text-[10.5px]" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--surface-border)' }}>
          Runs on this machine in a sandbox with no access to the app. Libraries load from the web.
        </footer>
      )}
    </motion.aside>
  )
}
