import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { BoardAttachment } from './storage'
const check = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError') }
export async function openBoardPDF(blob: Blob, signal?: AbortSignal): Promise<PDFDocumentProxy> {
  check(signal)
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const data = await blob.arrayBuffer(); check(signal)
  const task = pdfjs.getDocument({data, isEvalSupported:false, enableXfa:false, useWorkerFetch:false})
  const cancel = () => { void task.destroy() }
  signal?.addEventListener('abort',cancel,{once:true})
  try {
    check(signal)
    const document = await task.promise
    check(signal)
    return document
  } catch(error) {
    await task.destroy(); check(signal)
    if (/password/i.test(error instanceof Error ? error.message : String(error))) throw new Error('Password-protected PDF. Unlock a copy before importing it.')
    throw error
  } finally { signal?.removeEventListener('abort',cancel) }
}
/** Content signatures plus actual browser/pdf.js decoding, not extension-only acceptance. */
export async function prepareBoardAttachment(file: File, signal?: AbortSignal): Promise<{attachment: BoardAttachment; kind:'image'|'pdf'; pages?:number}> {
  check(signal)
  const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer()); check(signal)
  const ascii = String.fromCharCode(...bytes)
  const mime = ascii.startsWith('%PDF-') ? 'application/pdf'
    : bytes[0]===137 && ascii.slice(1,4)==='PNG' ? 'image/png'
    : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'image/jpeg'
    : ascii.startsWith('RIFF') && ascii.slice(8,12)==='WEBP' ? 'image/webp' : undefined
  if (!mime) throw new Error(`${file.name}: unsupported content. Choose a PDF, PNG, JPEG or WebP file. SVG and HTML are not imported.`)
  const blob = file.slice(0,file.size,mime)
  if (mime==='application/pdf') {
    const document = await openBoardPDF(blob,signal)
    try { check(signal); return {kind:'pdf',pages:document.numPages,attachment:{id:crypto.randomUUID(),name:file.name,blob}} } finally { await document.destroy() }
  }
  const image = await createImageBitmap(blob)
  try { check(signal); if (!image.width || !image.height) throw new Error('Image has no pixels.') } finally { image.close() }
  return {kind:'image',attachment:{id:crypto.randomUUID(),name:file.name,blob}}
}
