/**
 * Recorded audio lives in IndexedDB, not in localStorage: a meeting is many
 * megabytes and localStorage is a few. Nothing here leaves the device.
 */
const DB = 're.meetings'
const STORE = 'audio'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        t.oncomplete = () => { db.close(); resolve(req.result) }
        t.onerror = () => { db.close(); reject(t.error) }
      }),
  )
}

export const saveAudio = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)).then(() => undefined)
export const loadAudio = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const deleteAudio = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined)
