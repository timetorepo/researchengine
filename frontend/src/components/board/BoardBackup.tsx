import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportBoardBackup, importBoardBackup } from '@/lib/board/backup'
import { boardWritesFrozen, type BoardDocument, type openBoardStore } from '@/lib/board/storage'

type Props={store:Awaited<ReturnType<typeof openBoardStore>>;document?:BoardDocument;disabled:boolean;dirty?:boolean;onBusy:(busy:boolean)=>void}
export function BoardBackup({store,document,disabled,dirty,onBusy}:Props) {
  const navigate=useNavigate(), controller=useRef<AbortController|undefined>(undefined)
  const [status,setStatus]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false)
  useEffect(()=>()=>controller.current?.abort(),[])
  async function run(file?:File) {
    if(disabled||controller.current||boardWritesFrozen())return
    if(file&&dirty&&!window.confirm('Import opens a separate board and leaves this unsaved draft. Save or download it first if you need to preserve your edits. Continue?'))return
    const abort=new AbortController();controller.current=abort;setWorking(true);onBusy(true);setError('');setStatus(file?'Validating backup and originals…':'Reading originals and creating backup…')
    try {
      if(file) {
        const prepared=await importBoardBackup(file,abort.signal)
        setStatus('Saving separate local board…')
        const saved=await store.save(prepared.document,0,prepared.attachments,abort.signal)
        navigate(`/board/${saved.id}`)
      } else if(document) {
        const blob=await exportBoardBackup(document,id=>store.attachment(document.id,id),abort.signal)
        if(abort.signal.aborted)return
        const url=URL.createObjectURL(blob),link=window.document.createElement('a');link.href=url;link.download=`board-${document.id}.reboard`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
        setStatus('Backup download requested. Check your browser’s downloads; the board revision was not changed.')
      }
    }catch(e){setError(e instanceof Error?e.message:'Backup failed. No board was replaced.');setStatus(abort.signal.aborted?'Cancelled · no imported board saved':'Backup operation failed · existing boards unchanged')}
    finally{controller.current=undefined;setWorking(false);onBusy(false)}
  }
  return <div className="re-board-backup"><div className="re-board-backup-actions">{document&&<button className="bui-button" disabled={disabled||working} onClick={()=>void run()}>Download full backup</button>}
    <label className="bui-button">Import backup as new board<input aria-label="Import Board backup as new board" type="file" accept=".reboard" disabled={disabled||working} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void run(file)}} /></label>
    {working&&<button className="bui-button" onClick={()=>controller.current?.abort()}>Cancel backup operation</button>}</div>
    <p>Unencrypted .reboard file. Includes {document?'this draft':'one board'} and linked originals, not revision history or removed files. Import creates a separate board. Keep backups private. Browser memory and storage limits apply.</p>
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  </div>
}
