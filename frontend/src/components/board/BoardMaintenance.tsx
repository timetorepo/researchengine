import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BoardDocument, openBoardStore } from '@/lib/board/storage'

type Props={store:Awaited<ReturnType<typeof openBoardStore>>;namespace:string;board:Pick<BoardDocument,'id'|'title'|'revision'>;disabled:boolean;compact?:boolean;onBusy:(busy:boolean)=>void;onDeleted:(notice:string)=>void}
export function BoardMaintenance({store,namespace,board,disabled,compact=false,onBusy,onDeleted}:Props) {
  const [working,setWorking]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
  async function run(operation:'delete'|'cleanup') {
    if(disabled||working)return
    const warning=operation==='delete'
      ? `Permanently delete “${board.title||'Untitled board'}” at revision ${board.revision}, its previous revision and all its stored originals? Download a full backup first if needed. This tab’s recovery draft will also be discarded. Drafts in other tabs are not backups and cannot restore deleted originals. This has no undo and is not secure disk erasure.`
      : 'Remove originals not referenced by the current or previous saved revision? Those two revisions stay intact. Older drafts in other tabs may still need these files. Save or download those drafts first. This has no undo and is not secure disk erasure.'
    if(!window.confirm(warning))return
    setWorking(true);onBusy(true);setError('');setStatus(operation==='delete'?'Deleting local board…':'Checking saved revision references…')
    try {
      const result=await store.maintain(board.id,board.revision,operation)
      if(operation==='delete'){
        let notice=`Board deleted with ${result.files} originals (${result.bytes.toLocaleString()} bytes).`
        try{sessionStorage.removeItem(`${namespace}:board-draft:${board.id}`)}catch{notice+=' This tab’s recovery entry could not be cleared; it cannot restore the deleted board.'}
        onDeleted(notice)
      }else setStatus(`Removed ${result.files} unused originals (${result.bytes.toLocaleString()} bytes). Current and previous saved revisions were retained.`)
    }catch(e){setError(e instanceof Error?e.message:'Board maintenance failed.');setStatus('Maintenance did not complete. No successful deletion is claimed.')}
    finally{setWorking(false);onBusy(false)}
  }
  const controls=<><div className="re-board-maintenance-actions">{!compact&&<button className="bui-button" disabled={disabled||working} onClick={()=>void run('cleanup')}>Clean unused originals</button>}<button className="bui-button" aria-label={`Delete board ${board.title||'Untitled board'}`} disabled={disabled||working} onClick={()=>void run('delete')}><Trash2 size={14} aria-hidden="true"/>{compact?'Delete':'Delete this board'}</button></div>{status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}</>
  return compact?<div className="re-board-maintenance-compact">{controls}</div>:<details className="re-board-maintenance"><summary>Board storage and deletion</summary><p>Save or discard unsaved changes before maintenance. Cleanup keeps originals used by the current and previous saved revision, not older tab drafts. Delete removes this board, both saved revisions, its originals and this tab’s recovery draft. Neither action can be undone. Back up important work first. Browser deletion is not secure disk erasure.</p>{controls}</details>
}
