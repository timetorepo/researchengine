import { create } from 'zustand'
export type DocumentStage = 'reading' | 'extracting' | 'ready' | 'failed' | 'cancelled'
export interface DocumentActivity { id: string; name: string; stage: DocumentStage; done?: number; total?: number; error?: string; cancel: () => void }
export const useDocumentActivity = create<{ jobs: DocumentActivity[] }>(() => ({ jobs: [] }))
export function startDocumentActivity(name: string, cancel: () => void) {
  const id = crypto.randomUUID()
  // Terminal entries can be dismissed; active work is never evicted.
  useDocumentActivity.setState(s => ({ jobs: [...s.jobs, { id, name, stage: 'reading', cancel }] }))
  return { id, update: (patch: Partial<Omit<DocumentActivity, 'id'>>) => useDocumentActivity.setState(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, ...patch } : j) })) }
}
export const dismissDocumentActivity = (id: string) => useDocumentActivity.setState(s => ({ jobs: s.jobs.filter(j => j.id !== id || j.stage === 'reading' || j.stage === 'extracting') }))
