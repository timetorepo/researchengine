/* Adapted from BoardUI's file-upload layout (MIT). Replaces demo timer/8 MB ceiling with local extraction. */
import { useEffect, useRef, useState } from 'react'
import { FileText, Info, UploadCloud } from 'lucide-react'
import { BoardOverlay } from './Overlay'
import { BoardPopover } from './Popover'
import { BoardProgress } from './Progress'
import { extractText } from '@/lib/documents/extract'

export function DocumentUpload({ onConfirm, label = 'Add document', actionLabel = 'Use extracted text' }: {
  onConfirm: (file: File, text: string) => void | Promise<void>; label?: string; actionLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File>()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number>()
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const close = () => { if (saving) return; controller.current?.abort(); setBusy(false); setOpen(false) }
  const process = async (next: File) => {
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    setFile(next); setText(''); setError(''); setBusy(true); setProgress(undefined)
    try {
      const content = await extractText(next, { signal: current.signal, onProgress: (done, total) => { if (!current.signal.aborted) setProgress(done / total * 100) } })
      if (!current.signal.aborted) { if (!content.trim()) throw new Error('No readable text found.'); setText(content) }
    } catch (err) { if (!current.signal.aborted) setError(err instanceof Error ? err.message : 'Could not read this file.') }
    finally { if (controller.current === current) setBusy(false) }
  }
  return <>
    <button type="button" className="bui-button" onClick={() => setOpen(true)} aria-label={label}><UploadCloud size={15} />{label}</button>
    <BoardOverlay open={open} onClose={close} title="Document upload">
      <div className="p-5 overflow-y-auto flex-1 space-y-4">
        <button type="button" disabled={saving} className="bui-upload-zone" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!saving && e.dataTransfer.files[0]) void process(e.dataTransfer.files[0]) }}>
          <UploadCloud size={30} className="mx-auto mb-3 text-[var(--text-2)]" /><span className="block text-sm font-medium">Drop a document or choose a file</span><span className="block text-xs mt-2 text-[var(--text-3)]">PDF, DOCX, TXT or Markdown · processed locally</span>
        </button>
        <input ref={input} type="file" accept=".pdf,.docx,.txt,.md,.markdown,text/*" className="sr-only" tabIndex={-1} aria-label="Choose document" onChange={(e) => { if (e.target.files?.[0]) void process(e.target.files[0]); e.target.value = '' }} />
        {file && <div className="flex items-center gap-2 text-sm"><FileText size={16} /><span className="break-all">{file.name}</span><span className="text-xs text-[var(--text-3)] shrink-0">{new Intl.NumberFormat().format(file.size)} bytes</span></div>}
        {busy && <BoardProgress label="Extracting document text" value={progress} showValue />}
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        {text && <><div className="flex items-center flex-wrap gap-3"><p className="text-sm font-medium">About {Math.ceil(text.length / 4).toLocaleString()} text tokens</p>
          <BoardPopover label="About token estimates" trigger={<Info size={14} />}><p>This is an estimate from extracted text: characters divided by four, not a model-specific tokenizer. Language and model affect the actual count. Conversation, instructions, tools and output allowance also use context. Native PDF or vision accounting differs.</p></BoardPopover>
        </div><p className="text-xs text-[var(--text-2)]">Full extracted text: {text.length.toLocaleString()} characters. No silent truncation. Provider context and memory limits still apply.</p>
        <details className="text-xs"><summary className="cursor-pointer">Preview extracted text</summary><pre className="whitespace-pre-wrap max-h-48 overflow-auto mt-2 p-3 bg-[var(--elevated)] rounded-lg">{text.slice(0, 4000)}{text.length > 4000 ? '\nPreview shortened; full text is retained.' : ''}</pre></details></>}
        <p className="text-xs text-[var(--text-3)]">Choosing a file does not send it to a model. Image-only PDFs need OCR. Large documents may exceed available memory or a provider's context limit.</p>
      </div>
      <footer className="p-4 border-t border-[var(--surface-border)] flex justify-end gap-2"><button type="button" className="bui-button" disabled={saving} onClick={close}>Cancel</button>
        <button type="button" className="bui-button bui-button-primary" disabled={!text || busy || saving} onClick={async () => {
          if (!file || !text || saving) return
          setSaving(true); setError('')
          try { await onConfirm(file, text); setOpen(false); setText(''); setFile(undefined) } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the document.') } finally { setSaving(false) }
        }}>{saving ? 'Saving…' : actionLabel}</button>
      </footer>
    </BoardOverlay>
  </>
}
