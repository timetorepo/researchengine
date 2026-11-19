/** Local Board storage. No provider calls, server sync, or HTML execution. */
let frozen = false
/** Wipe barrier: never resurrect deleted Boards from a late UI save/draft. */
export function freezeBoardWrites() { frozen = true }
export function boardWritesFrozen() { return frozen }
export type BoardItem = {
  id: string; kind: 'note' | 'reference' | 'image' | 'pdf' | 'drawing' | 'shape' | 'connector' | 'frame'
  x: number; y: number; width: number; height: number; text: string
  attachmentId?: string; source?: { url?: string; page?: number }; parentId?: string
  points?: { x: number; y: number }[]; fromId?: string; toId?: string
}
export type BoardDocument = {
  schemaVersion: 1; id: string; title: string; revision: number; updatedAt: string
  items: BoardItem[]; viewport: { x: number; y: number; zoom: number }
}
export type BoardAttachment = { id: string; name: string; blob: Blob }
export class BoardConflict extends Error { constructor() { super('Board changed in another window. Reload before saving.'); this.name = 'BoardConflict' } }
export function newBoard(title = 'Untitled board'): BoardDocument {
  return { schemaVersion: 1, id: crypto.randomUUID(), title, revision: 0, updatedAt: new Date().toISOString(), items: [], viewport: { x: 0, y: 0, zoom: 1 } }
}
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** Validate on reads as well as writes. Unknown versions fail closed, never reset data. */
export function validateBoard(value: unknown): asserts value is BoardDocument {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id || typeof value.title !== 'string' || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || !Array.isArray(value.items) || !record(value.viewport) || !finite(value.viewport.x) || !finite(value.viewport.y) || !finite(value.viewport.zoom) || value.viewport.zoom <= 0) throw new Error('Unsupported or invalid Board document; original data was not replaced.')
  const ids = new Set<string>()
  for (const item of value.items) {
    if (!record(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !['note','reference','image','pdf','drawing','shape','connector','frame'].includes(String(item.kind)) || !finite(item.x) || !finite(item.y) || !finite(item.width) || item.width <= 0 || !finite(item.height) || item.height <= 0 || typeof item.text !== 'string') throw new Error('Invalid Board item.')
    ids.add(item.id)
    for (const key of ['attachmentId','parentId','fromId','toId']) if (item[key] !== undefined && (typeof item[key] !== 'string' || !item[key])) throw new Error('Invalid Board link.')
    if (item.source !== undefined && (!record(item.source) || (item.source.url !== undefined && typeof item.source.url !== 'string') || (item.source.page !== undefined && (!Number.isSafeInteger(item.source.page) || Number(item.source.page) < 1)))) throw new Error('Invalid Board provenance.')
    if (item.points !== undefined && (!Array.isArray(item.points) || item.points.some(p => !record(p) || !finite(p.x) || !finite(p.y)))) throw new Error('Invalid Board drawing.')
  }
  const byId = new Map((value.items as BoardItem[]).map(item => [item.id,item]))
  for (const item of value.items as BoardItem[]) {
    for (const ref of [item.parentId,item.fromId,item.toId]) if (ref && (!ids.has(ref) || ref === item.id)) throw new Error('Board link target missing or self-referential.')
    const visited = new Set([item.id]); let parent = item.parentId
    while (parent) { if (visited.has(parent)) throw new Error('Board groups cannot form a cycle.'); visited.add(parent); parent = byId.get(parent)?.parentId }
  }
}
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error) }) }
function completed(tx: IDBTransaction): Promise<void> { return new Promise((resolve,reject) => { tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error ?? new Error('Board save aborted.')); tx.onerror=()=>{ /* abort carries the final failure */ } }) }
export function boardDatabaseName(namespace: string) { return `research-engine-boards-v1:${namespace}` }
/** Deleting a Board database closes our open connections through onversionchange. */
export async function deleteBoardDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Close other app windows to finish deleting local Board data.'))
  })
}
export async function openBoardStore(name = 'research-engine-boards-v1') {
  const req = indexedDB.open(name,1)
  req.onupgradeneeded=()=>{ for (const store of ['boards','previous','attachments']) req.result.createObjectStore(store,{keyPath:'id'}) }
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false
    req.onblocked = () => { blocked = true; reject(new Error('Close other app windows, then reload to open local Board storage.')) }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => { if (blocked) req.result.close(); else resolve(req.result) }
  })
  db.onversionchange=()=>db.close()
  return {
    close: () => db.close(),
    async list(): Promise<Pick<BoardDocument, 'id' | 'title' | 'revision' | 'updatedAt'>[]> {
      const tx=db.transaction('boards','readonly'); const done=completed(tx); const documents=await request(tx.objectStore('boards').getAll()); await done
      return documents.map(document=>{ validateBoard(document); const {id,title,revision,updatedAt}=document; return {id,title,revision,updatedAt} }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
    },
    async load(id: string): Promise<BoardDocument | undefined> {
      const tx=db.transaction('boards','readonly'); const done=completed(tx); const result=await request(tx.objectStore('boards').get(id)); await done
      if (result !== undefined) validateBoard(result); return result
    },
    async previous(id: string): Promise<BoardDocument | undefined> {
      const tx=db.transaction('previous','readonly'); const done=completed(tx); const result=await request(tx.objectStore('previous').get(id)); await done
      if (result !== undefined) validateBoard(result); return result
    },
    async attachment(boardId: string, id: string): Promise<BoardAttachment | undefined> {
      const tx=db.transaction('attachments','readonly'); const done=completed(tx); const result=await request(tx.objectStore('attachments').get([boardId,id])); await done
      return result ? { id, name: result.name, blob: result.blob } : undefined
    },
    /** Resolve only after transaction commits. Existing attachment IDs are immutable. */
    async save(document: BoardDocument, expectedRevision: number, attachments: BoardAttachment[] = [], signal?: AbortSignal): Promise<BoardDocument> {
      if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError')
      if (frozen) throw new Error('Board writes are disabled after a data wipe. Reload the app to start a new workspace.')
      validateBoard(document)
      if (document.revision !== expectedRevision || !Number.isSafeInteger(expectedRevision + 1)) throw new BoardConflict()
      const snapshot = structuredClone(document); const incoming = new Map(attachments.map(a=>[a.id,a]))
      if (incoming.size !== attachments.length || attachments.some(a=>!a.id || typeof a.name !== 'string' || !(a.blob instanceof Blob))) throw new Error('Invalid Board attachments.')
      const tx=db.transaction(['boards','previous','attachments'],'readwrite'); const done=completed(tx)
      const cancel = () => { try { tx.abort() } catch { /* committed already */ } }
      signal?.addEventListener('abort',cancel,{once:true})
      try {
        const boards=tx.objectStore('boards'), blobs=tx.objectStore('attachments'); const current=await request(boards.get(snapshot.id))
        if ((current?.revision ?? 0) !== expectedRevision) throw new BoardConflict()
        if (current) validateBoard(current)
        // Store-scoped keys prevent one board from resolving another board's attachment.
        for (const attachment of attachments) {
          const id=[snapshot.id,attachment.id]
          if (await request(blobs.getKey(id))) throw new Error('Attachment ID already exists; use a new ID.')
          blobs.put({...attachment,id})
        }
        for (const item of snapshot.items) if (item.attachmentId && !incoming.has(item.attachmentId) && !(await request(blobs.getKey([snapshot.id,item.attachmentId])))) throw new Error('Board attachment missing; nothing was saved.')
        const saved: BoardDocument={...snapshot,revision:expectedRevision+1,updatedAt:new Date().toISOString()}
        if (current) tx.objectStore('previous').put(current)
        boards.put(saved); await done; return saved
      } catch (error) { try { tx.abort() } catch { /* already completed or aborted */ } await done.catch(()=>{}); if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError'); throw error }
      finally { signal?.removeEventListener('abort',cancel) }
    },
  }
}
