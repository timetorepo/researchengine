import type { BoardItem } from './storage'

export type BoardEvidence = {
  citation: string
  item: BoardItem
  original?: { name: string; type: string; bytes: number; page?: number; text?: string; note: string }
}
/** Lossless text/provenance projection. Geometry is deliberately NOT agent evidence.
 * Deduplicate exact strings only; never trim, summarize or normalize source text. */
export function compactBoardEvidence(sources: BoardEvidence[]) {
  const texts: Record<string, string> = {}
  const refs = new Map<string, string>()
  function textRef(text: string) {
    let ref = refs.get(text)
    if (!ref) { ref = `t${refs.size + 1}`; refs.set(text, ref); texts[ref] = text }
    return ref
  }
  const originals: Record<string, Omit<NonNullable<BoardEvidence['original']>, 'bytes' | 'text'> & { textRef?: string; fileId?: string }> = {}
  const originalRefs = new Map<string, string>()
  const items = sources.map(({ citation, item, original }) => {
    let originalRef: string | undefined
    if (original) {
      const { bytes: _bytes, text, ...metadata } = original
      const value = { ...metadata, fileId: item.attachmentId, ...(text === undefined ? {} : { textRef: textRef(text) }) }
      const key = JSON.stringify(value)
      originalRef = originalRefs.get(key)
      if (!originalRef) { originalRef = `o${originalRefs.size + 1}`; originalRefs.set(key, originalRef); originals[originalRef] = value }
    }
    return {
      citation, kind: item.kind, textRef: textRef(item.text),
      ...(item.textFormat ? { textFormat: item.textFormat } : {}),
      ...(item.source ? { source: item.source } : {}),
      ...(item.parentId ? { parent: `board:${item.parentId}` } : {}),
      ...(item.fromId ? { from: `board:${item.fromId}` } : {}),
      ...(item.toId ? { to: `board:${item.toId}` } : {}),
      ...(originalRef ? { originalRef } : {}),
    }
  })
  return { items, texts, originals }
}
