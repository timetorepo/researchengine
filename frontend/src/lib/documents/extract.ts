// Document extraction. Runs async so the main thread stays responsive;
// PDF parsing happens in the pdf.js worker.
export async function extractText(file: File, options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<string> {
  const check = () => { if (options.signal?.aborted) throw new DOMException('Processing cancelled', 'AbortError') }
  check()
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || file.type.startsWith('text/')) {
    return await file.text()
  }

  if (name.endsWith('.pdf')) {
    const pdfjs: any = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const buf = await file.arrayBuffer()
    check()
    const task = pdfjs.getDocument({ data: buf })
    const cancel = () => { void task.destroy() }
    options.signal?.addEventListener('abort', cancel, { once: true })
    try {
      const doc = await task.promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        check()
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((it: any) => it.str).join(' '))
        page.cleanup()
        options.onProgress?.(i, doc.numPages)
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      check()
      const out = pages.join('\n\n')
      if (out.trim().length < 40) throw new Error('No selectable text found. This PDF may need OCR; no token estimate is available.')
      return out
    } catch (err: any) {
      check()
      if (/password/i.test(String(err?.message))) throw new Error('This PDF is password-protected. Remove the password and try again.')
      throw err
    } finally {
      options.signal?.removeEventListener('abort', cancel)
      await task.destroy()
    }
  }

  if (name.endsWith('.docx')) {
    const mammoth: any = await import('mammoth/mammoth.browser')
    const buf = await file.arrayBuffer()
    const res = await mammoth.extractRawText({ arrayBuffer: buf })
    const text: string = res.value ?? ''
    if (text.trim().length < 40) {
      throw new Error('This DOCX contains no readable text. It may be empty or image-only.')
    }
    return text
  }

  if (name.endsWith('.epub')) {
    // Lightweight: EPUB is a zip; without a zip lib we surface a friendly note.
    throw new Error('EPUB support is handled by the backend document service in Docker mode. For now, paste the text or convert to PDF.')
  }

  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, or Markdown.')
}

/** Split into sentences for quiz generation. */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 320)
}
