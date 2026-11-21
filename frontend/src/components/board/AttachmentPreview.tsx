import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { BoardAttachment, BoardItem, openBoardStore } from '@/lib/board/storage'
import { openBoardPDF } from '@/lib/board/attachments'

type Store = Awaited<ReturnType<typeof openBoardStore>>
/** Only the selected card decodes its attachment. Blob URLs are revoked on selection change. */
export function AttachmentPreview({store,boardId,item,onPage}: {store:Store;boardId:string;item:BoardItem;onPage:(page:number)=>void}) {
  const [asset,setAsset] = useState<BoardAttachment>()
  const [url,setURL] = useState('')
  const [error,setError] = useState('')
  useEffect(()=>{
    let alive=true;let objectURL='';setAsset(undefined);setURL('');setError('')
    if (!item.attachmentId) { setError('This card has no attached original.'); return }
    store.attachment(boardId,item.attachmentId).then(value=>{
      if (!alive) return
      if (!value) throw new Error('The original file is missing from this local board.')
      objectURL=URL.createObjectURL(value.blob);setAsset(value);setURL(objectURL)
    }).catch(error=>{if(alive)setError(error instanceof Error?error.message:'Could not load the original file.')})
    return ()=>{alive=false;if(objectURL)URL.revokeObjectURL(objectURL)}
  },[store,boardId,item.attachmentId])
  return <section className="re-board-attachment" aria-label="Attached original">
    {!asset && error ? <p role="alert">{error}</p> : !asset ? <p role="status">Loading local original…</p> : <>
      {error && <p role="alert">{error}</p>}<p className="re-board-filename">{asset.name} · {asset.blob.size.toLocaleString()} bytes</p>
      {item.kind==='image' ? <img src={url} alt={item.text || asset.name} onError={()=>setError('The saved image could not be decoded. Download the original to inspect it.')} /> : <PDFPreview blob={asset.blob} page={item.source?.page ?? 1} onPage={onPage} />}
      <a href={url} download={asset.name}>Download original file</a>
      <p>Local preview only. No OCR or AI processing.</p>
    </>}
  </section>
}
export function PDFPreview({blob,page,onPage,disabled=false}:{blob:Blob;page:number;onPage:(page:number)=>void;disabled?:boolean}) {
  const [document,setDocument] = useState<PDFDocumentProxy>()
  const [error,setError] = useState('')
  const [text,setText] = useState('')
  const [rendering,setRendering] = useState(true)
  const canvas=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const controller=new AbortController();let opened:PDFDocumentProxy|undefined;setDocument(undefined);setError('')
    openBoardPDF(blob,controller.signal).then(value=>{opened=value;if(controller.signal.aborted)void value.destroy();else setDocument(value)}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Could not open PDF.')})
    return ()=>{controller.abort();void opened?.destroy()}
  },[blob])
  useEffect(()=>{
    if(!document || !canvas.current)return
    let alive=true;let task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined
    const node=canvas.current;setRendering(true);setText('');setError('')
    const context=node.getContext('2d');context?.clearRect(0,0,node.width,node.height)
    async function render() {
      if(!document || !context)throw new Error('PDF canvas unavailable.')
      if(page<1 || page>document.numPages)throw new Error(`Page ${page} is outside this ${document.numPages}-page PDF.`)
      const source=await document.getPage(page);if(!alive)return
      const natural=source.getViewport({scale:1});const viewport=source.getViewport({scale:Math.min(800/natural.width,1000/natural.height,2)})
      node.width=Math.max(1,Math.ceil(viewport.width));node.height=Math.max(1,Math.ceil(viewport.height))
      task=source.render({canvasContext:context,viewport});await task.promise
      const content=await source.getTextContent();if(!alive)return
      setText(content.items.map(item=>'str' in item?item.str:'').join(' '));setRendering(false)
    }
    void render().catch(error=>{if(alive){setError(error instanceof Error?error.message:'Could not render PDF page.');setRendering(false)}})
    return ()=>{alive=false;task?.cancel()}
  },[document,page])
  return <div className="re-board-pdf">
    {document && <label>Linked PDF page · {document.numPages} total<input className="bui-field" aria-label="Linked PDF page" disabled={disabled} type="number" min={1} max={document.numPages} value={page} onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isInteger(n)&&n>=1&&n<=document.numPages)onPage(n)}} /></label>}
    {error && <p role="alert">{error}</p>}
    {rendering && !error && <p role="status">Rendering PDF page {page}…</p>}
    <canvas ref={canvas} role="img" aria-label={`PDF page ${page} preview`} hidden={!!error || rendering} />
    {!rendering && !error && <details><summary>Selectable page text</summary><p>{text || 'No selectable text on this page. It may be scanned; OCR has not been run.'}</p></details>}
  </div>
}
