// Document extraction. Runs async so the main thread stays responsive;
// PDF parsing happens in the pdf.js worker.
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || file.type.startsWith('text/')) {
    return await file.text()
  }

  if (name.endsWith('.pdf')) {
    const pdfjs: any = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const buf = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data: buf }).promise
    let out = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      out += content.items.map((it: any) => it.str).join(' ') + '\n\n'
    }
    return out
  }

  if (name.endsWith('.docx')) {
    const mammoth: any = await import('mammoth/mammoth.browser')
    const buf = await file.arrayBuffer()
    const res = await mammoth.extractRawText({ arrayBuffer: buf })
    return res.value
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
