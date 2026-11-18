import { useEffect, useRef } from 'react'
import { FileText } from 'lucide-react'
import { useIslandActions, type ActivityHandle } from '@/lib/island'
import { dismissDocumentActivity, useDocumentActivity } from '@/lib/documents/activity'
const stageLabels = { reading: 'Reading file', extracting: 'Extracting text', ready: 'Reference ready', failed: 'Document failed', cancelled: 'Import cancelled' }
export function DocumentIslandActivity() {
  const jobs = useDocumentActivity(s => s.jobs)
  const api = useIslandActions()
  const handles = useRef(new Map<string, ActivityHandle>())
  useEffect(() => () => { handles.current.forEach(h => h.end()); handles.current.clear() }, [api])
  useEffect(() => {
    const ids = new Set(jobs.map(j => j.id))
    for (const [id, handle] of handles.current) if (!ids.has(id)) { handle.end(); handles.current.delete(id) }
    for (const job of jobs) {
      const active = job.stage === 'reading' || job.stage === 'extracting'
      const accent = job.stage === 'failed' ? '#ff6b70' : job.stage === 'ready' ? '#47d7a5' : job.stage === 'cancelled' ? '#ffbf69' : '#55c8ff'
      const percent = active && job.total && job.done !== undefined ? Math.round(job.done / job.total * 100) : undefined
      const icon = <FileText size={18} color={accent} aria-hidden />
      const content = { label: `${job.name}: ${stageLabels[job.stage]}`, priority: active ? 1 : 0,
        onPress: () => api.expand(job.id), compact: { leading: icon, trailing: <span className="re-islandcn-value" style={{ color: accent }}>{percent !== undefined ? `${percent}%` : job.stage === 'ready' ? 'Ready' : job.stage === 'failed' ? 'Failed' : active ? 'File' : 'Ended'}</span> }, minimal: icon,
        expanded: { leading: icon, trailing: <span style={{ color: accent, fontSize: 12 }}>{percent !== undefined ? `${percent}%` : stageLabels[job.stage]}</span>, bottom: <div className="re-islandcn-detail">
          <h2>{stageLabels[job.stage]}</h2><p>{job.name}</p>
          {jobs.length > 1 && <div className="re-islandcn-actions" aria-label="Document imports">{jobs.map(other => <button key={other.id} type="button" onClick={() => api.expand(other.id)}>{other.name} · {stageLabels[other.stage]}</button>)}</div>}
          {job.error && <p role="alert">{job.error}</p>}
          {job.total !== undefined && active && <p>{job.done} of {job.total} pages extracted</p>}
          <div className="re-islandcn-actions"><button type="button" onClick={active ? job.cancel : () => dismissDocumentActivity(job.id)}>{active ? 'Cancel import' : 'Dismiss'}</button></div>
        </div> } }
      const handle = handles.current.get(job.id)
      if (handle) handle.update(content)
      else handles.current.set(job.id, api.start({ id: job.id, ...content }))
    }
  }, [jobs, api])
  return null
}
