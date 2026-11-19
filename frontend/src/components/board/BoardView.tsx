import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, Link2, Plus, Save, Undo2, Redo2, LayoutDashboard, Shapes, Frame } from 'lucide-react'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen, boardDatabaseName, newBoard, openBoardStore, validateBoard, type BoardDocument, type BoardItem } from '@/lib/board/storage'
import { SearchField } from '@/components/ui/native/SearchField'
import { ditherMaskStyle } from '@/lib/dither/pattern'
import { prepareBoardAttachment } from '@/lib/board/attachments'
import { AttachmentPreview } from './AttachmentPreview'
import { BoardCard } from './BoardCard'
import { editGeometry, frameContents, frameOptions } from '@/lib/board/structure'
import { BoardNoteEditor } from './BoardNoteEditor'
import { BoardBackup } from './BoardBackup'
import type { BoardAttachment } from '@/lib/board/storage'
import './board.css'

type Store = Awaited<ReturnType<typeof openBoardStore>>
const message = (error: unknown) => error instanceof Error ? error.message : 'Board storage is unavailable.'
function sourceURL(value?: string) { try { const url = new URL(value ?? ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined } catch { return undefined } }

/** First local Board slice. Explicit commits; per-tab recovery drafts never imply a saved revision. */
export function BoardView() {
  const { id } = useParams()
  // The app reloads on role changes. Capture scope so late writes never switch users.
  const [namespace] = useState(activeNamespace)
  const [store, setStore] = useState<Store>()
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true; let opened: Store | undefined
    openBoardStore(boardDatabaseName(namespace)).then(value => { opened = value; if (alive) setStore(value); else value.close() }).catch(e => { if (alive) setError(message(e)) })
    return () => { alive = false; opened?.close() }
  }, [namespace])
  if (!store) return <div className="re-board-page"><h1>Board</h1>{error ? <p role="alert">{error}</p> : <p role="status">Opening local boards…</p>}</div>
  return id ? <BoardEditor key={`${namespace}:${id}`} id={id} namespace={namespace} store={store} /> : <BoardList store={store} />
}
function BoardList({ store }: { store: Store }) {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Awaited<ReturnType<Store['list']>>>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { let alive = true; store.list().then(value => { if (alive) { setBoards(value); setReady(true) } }).catch(e => { if (alive) setError(message(e)) }); return () => { alive = false } }, [store])
  async function create() { setBusy(true); setError(''); try { const board = await store.save(newBoard(), 0); navigate(`/board/${board.id}`) } catch(e) { setError(message(e)); setBusy(false) } }
  const visible = boards.filter(board => board.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="re-board-page"><header className="re-board-list-header"><div><h1>Board</h1><p>Collect notes and sources. Make room for the next idea.</p></div><button className="bui-button" disabled={busy} onClick={create}><Plus size={16} />New board</button></header>
    <p className="re-board-disclosure">Local to this browser profile. Not synced or encrypted by Board. Save revisions explicitly; browser data can be cleared.</p>
    <BoardBackup store={store} disabled={busy} onBusy={setBusy} />
    <SearchField aria-label="Search boards" placeholder="Find a board…" value={query} onValueChange={setQuery} />
    {error && <p role="alert">{error}</p>}
    {!ready && !error && <p role="status">Loading boards…</p>}
    {ready && !boards.length && <div className="re-board-empty"><div className="re-board-empty-texture" aria-hidden="true" style={ditherMaskStyle(0.25, {cell: 2})} /><LayoutDashboard size={28} aria-hidden="true" /><h2>Your thinking, in one place</h2><p>Start with a note or a source link. Nothing is sent to an AI.</p><button className="bui-button" disabled={busy} onClick={create}>Create your first board</button></div>}
    {ready && !!boards.length && !visible.length && <p role="status">No boards match your search.</p>}
    <ul className="re-board-list">{visible.map(board => <li key={board.id}><Link to={`/board/${board.id}`}><LayoutDashboard size={20} aria-hidden="true" /><span><strong>{board.title || 'Untitled board'}</strong><small>Revision {board.revision} · {new Date(board.updatedAt).toLocaleString()}</small></span></Link></li>)}</ul>
  </section>
}
function BoardEditor({ id, namespace, store }: { id: string; namespace: string; store: Store }) {
  const draftKey = `${namespace}:board-draft:${id}`
  const [board, setBoard] = useState<BoardDocument>()
  const [previous, setPrevious] = useState<BoardDocument>()
  const [recovered, setRecovered] = useState<BoardDocument>()
  const [selected, select] = useState<string>()
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Loading board…')
  const undo = useRef<BoardDocument[]>([]), redo = useRef<BoardDocument[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const importController = useRef<AbortController | undefined>(undefined)
  const [importProgress,setImportProgress] = useState<{done:number;total:number;name:string}>()
  useEffect(()=>()=>importController.current?.abort(),[])
  const savedBase = useRef<BoardDocument | undefined>(undefined)
  useEffect(() => {
    let alive = true
    Promise.all([store.load(id), store.previous(id)]).then(([saved, backup]) => {
      if (!alive) return
      if (!saved) { setError('This board was not found in this local workspace.'); setStatus(''); return }
      setBoard(saved); savedBase.current = saved; setPrevious(backup); setStatus(`Saved revision ${saved.revision}`)
      try { const raw = sessionStorage.getItem(draftKey); if (raw) { const draft: unknown = JSON.parse(raw); validateBoard(draft); if (draft.id !== id) throw new Error('Draft belongs to a different board.'); setRecovered(draft) } } catch(e) { setError(`Recovery draft could not be read. ${message(e)} Original stored data was not replaced.`) }
    }).catch(e => { if (alive) { setError(message(e)); setStatus('') } })
    return () => { alive = false }
  }, [id, store, draftKey])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function draft(next: BoardDocument, record = true) {
    if (!board || busy) return
    if (boardWritesFrozen()) { setError('Board writes are disabled after a data wipe. Reload the app to start a new workspace.'); return }
    if (record) { undo.current = [...undo.current.slice(-99), board]; redo.current = [] }
    setBoard(next); setDirty(true); setStatus('Unsaved changes · recovery draft in this tab'); setHistoryVersion(v => v + 1)
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)) } catch(e) { setError(`Recovery draft could not be stored. Keep this page open and save or download your draft. ${message(e)}`); setStatus('Unsaved changes · recovery draft unavailable') }
  }
  async function commit(next: BoardDocument, files: BoardAttachment[] = [], signal?: AbortSignal) {
    setBusy(true); setError(''); setStatus('Saving local revision…')
    try {
      const saved = await store.save(next, next.revision, files, signal)
      setPrevious(savedBase.current); savedBase.current = saved; setBoard(saved); setDirty(false); undo.current = []; redo.current = []; setHistoryVersion(v => v + 1); setStatus(`Saved revision ${saved.revision}`)
      try { sessionStorage.removeItem(draftKey) } catch { setError('Revision saved, but the tab recovery draft could not be removed.') }
    } catch(e) { setError(message(e)); setStatus('Not saved · your draft remains open'); throw e } finally { setBusy(false) }
  }
  async function save() { if (board) await commit(board).catch(()=>{}) }
  async function importFiles(files: File[]) {
    if (!board || busy || recovered || !files.length) return
    const controller=new AbortController();importController.current=controller;setBusy(true);setError('');
    const attachments: BoardAttachment[]=[];const items:BoardItem[]=[]
    try {
      for (const [index,file] of files.entries()) {
        setImportProgress({done:index,total:files.length,name:file.name});setStatus('Checking local files…')
        const prepared=await prepareBoardAttachment(file,controller.signal);const n=board.items.length+items.length
        attachments.push(prepared.attachment);items.push({id:crypto.randomUUID(),kind:prepared.kind,text:file.name,attachmentId:prepared.attachment.id,x:40+(n%4)*280,y:40+Math.floor(n/4)*220,width:250,height:190,...(prepared.kind==='pdf'?{source:{page:1}}:{})})
        setImportProgress({done:index+1,total:files.length,name:file.name})
      }
      if (controller.signal.aborted) throw new DOMException('Import cancelled','AbortError')
      setImportProgress(undefined);await commit({...board,items:[...board.items,...items]},attachments,controller.signal);select(items[0]?.id)
    } catch(e) {setError(message(e));setStatus(controller.signal.aborted?'Import cancelled · no new cards saved':'Import not saved · your existing draft is unchanged')}
    finally {importController.current=undefined;setImportProgress(undefined);setBusy(false)}
  }
  function downloadDraft() {
    if (!board) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], {type: 'application/json'})); const link = document.createElement('a'); link.href = url; link.download = `board-${board.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function add(kind: 'note' | 'reference' | 'shape' | 'frame') {
    if (!board) return
    const n = board.items.length
    const item: BoardItem = {id: crypto.randomUUID(), kind, text: '', x: 40 + (n % 4) * 280, y: 40 + Math.floor(n / 4) * 220, width: kind === 'frame' ? 600 : 250, height: kind === 'frame' ? 420 : 190, ...(kind === 'shape' ? {shape:'rectangle' as const} : {}), ...(kind === 'reference' ? { source: { url: '' } } : {})}
    draft({...board, items: [...board.items, item]}); select(item.id)
  }
  function change(patch: Partial<BoardItem>) {
    if (!board || !selected || recovered) return
    const item=board.items.find(value=>value.id===selected);if(!item)return
    if(patch.parentId&&!frameOptions(board.items,item).some(value=>value.id===patch.parentId))return
    const positioned=editGeometry(board.items,selected,{x:patch.x??item.x,y:patch.y??item.y,width:patch.width??item.width,height:patch.height??item.height})
    draft({...board,items:positioned.map(value=>value.id===selected?{...value,...patch,x:value.x,y:value.y}:value)})
  }
  function travel(direction: 'undo' | 'redo') {
    if (!board) return
    const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo
    const next = from.current.pop(); if (next) { to.current.push(board); draft(next, false) }
  }
  if (!board) return <section className="re-board-page"><Link to="/board">All boards</Link>{error && <p role="alert">{error}</p>}<p role="status">{status}</p></section>
  const canvasWidth = board.items.reduce((size,item) => Math.max(size,item.x + item.width + 80),1400)
  const canvasHeight = board.items.reduce((size,item) => Math.max(size,item.y + item.height + 80),900)
  const active = board.items.find(item => item.id === selected)
  const visible = board.items.filter(item => `${item.text} ${item.source?.url ?? ''} ${item.kind}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="re-board-editor" aria-label="Board workspace">
    <header className="re-board-toolbar"><Link to="/board" className="bui-button">All boards</Link><input className="bui-field re-board-title" aria-label="Board title" value={board.title} disabled={busy || !!recovered} onChange={e => draft({...board, title: e.target.value})} />
      <button className="bui-button" disabled={!dirty || busy || !!recovered} onClick={save}><Save size={15} />Save revision</button><button className="bui-button" title="JSON document only; attached files are not included." onClick={downloadDraft}>Download draft</button>
    </header>
    <BoardBackup store={store} document={board} dirty={dirty} disabled={busy || !!recovered} onBusy={setBusy} />
    <div className="re-board-status"><span role="status">{status}</span><span>Browser-local · no AI requests</span></div>
    {error && <div className="re-board-notice" role="alert">{error}</div>}
    {recovered && <div className="re-board-notice"><p>A recovery draft exists from this tab. Its base revision is {recovered.revision}; the saved board is revision {board.revision}. Loading it does not overwrite the saved board.</p><button className="bui-button" onClick={() => { draft(recovered); setRecovered(undefined) }}>Load recovery draft</button><button className="bui-button" onClick={() => { try { sessionStorage.removeItem(draftKey); setRecovered(undefined) } catch(e) { setError(message(e)) } }}>Keep saved board</button></div>}
    <div className="re-board-tools" aria-label="Board tools"><button className="bui-button" disabled={busy || !!recovered} onClick={() => add('note')}><Plus size={14} />Note</button><button className="bui-button" disabled={busy || !!recovered} onClick={() => add('reference')}><Link2 size={14} />Reference</button><button className="bui-button" disabled={busy || !!recovered} onClick={() => add('shape')}><Shapes size={14}/>Shape</button><button className="bui-button" disabled={busy || !!recovered} onClick={() => add('frame')}><Frame size={14}/>Frame</button><button className="bui-button" disabled={busy || !undo.current.length} onClick={() => travel('undo')} aria-label="Undo board edit"><Undo2 size={15} /></button><button className="bui-button" disabled={busy || !redo.current.length} onClick={() => travel('redo')} aria-label="Redo board edit"><Redo2 size={15} /></button>
      <button className="bui-button" disabled={busy || !!recovered || board.viewport.zoom <= 0.5} onClick={() => draft({...board, viewport: {...board.viewport, zoom: Math.max(0.5, board.viewport.zoom - 0.25)}})} aria-label="Zoom out">−</button><output aria-label="Board zoom">{Math.round(board.viewport.zoom * 100)}%</output><button className="bui-button" disabled={busy || !!recovered || board.viewport.zoom >= 2} onClick={() => draft({...board, viewport: {...board.viewport, zoom: Math.min(2, board.viewport.zoom + 0.25)}})} aria-label="Zoom in">+</button>
    </div>
    <div className="re-board-import"><label className="bui-button">Import &amp; save files<input aria-label="Import and save Board files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" disabled={busy || !!recovered} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';void importFiles(files)}} /></label><span>PDF, PNG, JPEG or WebP. Imports save the entire current draft with the originals. No upload or AI call. Browser storage and memory limits apply.</span>
      {importProgress && <div role="status">Validated {importProgress.done}/{importProgress.total} files · {importProgress.name}<progress aria-label="Files validated" max={importProgress.total} value={importProgress.done} /><button className="bui-button" onClick={()=>importController.current?.abort()}>Cancel file import</button></div>}
    </div>
    <div className="re-board-body" data-history={historyVersion}>
      <aside className="re-board-outline" aria-label="Board outline"><h2>Outline</h2><SearchField aria-label="Search board items" placeholder="Find a note or source…" value={query} onValueChange={setQuery} />{!visible.length && <p>{board.items.length ? 'No matching items.' : 'No items yet. Add a note or reference.'}</p>}<ol>{visible.map((item, index) => <li key={item.id}><button aria-pressed={item.id === selected} onClick={() => { select(item.id); document.getElementById(`board-card-${item.id}`)?.scrollIntoView({block: 'nearest', inline: 'nearest'}) }}>{item.kind === 'reference' ? <Link2 size={14} /> : item.kind === 'shape' ? <Shapes size={14}/> : item.kind === 'frame' ? <Frame size={14}/> : <FileText size={14} />}<span>{item.text.trim().split('\n')[0] || `${item.kind} ${index + 1}`}</span></button></li>)}</ol></aside>
      <div className="re-board-canvas-scroll" tabIndex={0} role="region" aria-label="Board canvas, scroll to pan"><div className="re-board-canvas-size" style={{width: canvasWidth * board.viewport.zoom, height: canvasHeight * board.viewport.zoom}}><div className="re-board-canvas" style={{width:canvasWidth, height:canvasHeight, transform: `scale(${board.viewport.zoom})`}}>
        {!board.items.length && <div className="re-board-canvas-empty"><LayoutDashboard size={28} /><h2>A little space to think</h2><p>Add your first note or reference from the toolbar.</p></div>}
        {board.items.map((item, index) => <BoardCard key={item.id} item={item} index={index} members={item.kind==='frame'?frameContents(board.items,item.id):undefined} selected={item.id === selected} disabled={busy || !!recovered || boardWritesFrozen()} zoom={board.viewport.zoom} onSelect={() => select(item.id)} onGeometry={geometry => { if (!recovered) draft({...board, items: editGeometry(board.items,item.id,geometry)}) }} />)}
      </div></div></div>
      <aside className="re-board-inspector" aria-label="Selected item editor"><h2>{active ? 'Edit item' : 'Item details'}</h2>{active ? <fieldset disabled={busy || !!recovered}>{active.attachmentId && <AttachmentPreview key={active.id} store={store} boardId={board.id} item={active} onPage={page=>change({source:{...active.source,page}})} />}<BoardNoteEditor key={active.id} item={active} onChange={change} />{active.kind==='shape'&&<label>Shape<select className="bui-field" aria-label="Shape type" value={active.shape??'rectangle'} onChange={event=>change({shape:event.target.value as BoardItem['shape']})}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="diamond">Diamond</option></select></label>}
        <label>Frame membership<select className="bui-field" aria-label="Parent frame" value={active.parentId??''} onChange={event=>change({parentId:event.target.value||undefined})}><option value="">No frame</option>{frameOptions(board.items,active).map(frame=><option key={frame.id} value={frame.id}>{frame.text.trim().split('\n')[0]||'Untitled frame'} · {frame.id.slice(0,8)}</option>)}</select></label>
        {active.kind==='frame'&&<p>{frameContents(board.items,active.id).length-1} members (including nested frames). Moving this frame moves its members. Resizing changes only the boundary. Membership is explicit, not inferred from overlap. Removing a frame keeps its contents.</p>}{active.kind === 'reference' && <><label>Source URL<input className="bui-field" type="url" aria-label="Source URL" value={active.source?.url ?? ''} onChange={e => change({source:{...active.source,url:e.target.value}})} /></label>{sourceURL(active.source?.url) ? <a href={sourceURL(active.source?.url)} target="_blank" rel="noopener noreferrer">Open source in new tab</a> : <p>Use an http or https URL to open a source.</p>}</>}
        <div className="re-board-position">{(['x','y','width','height'] as const).map(axis => <label key={axis}>{axis === 'x' || axis === 'y' ? `${axis.toUpperCase()} position` : axis === 'width' ? 'Width' : 'Height'}<input className="bui-field" aria-label={axis === 'x' || axis === 'y' ? `${axis.toUpperCase()} position` : axis === 'width' ? 'Card width' : 'Card height'} type="number" min={axis === 'width' ? 160 : axis === 'height' ? 120 : 0} value={active[axis]} onChange={e => { if (e.currentTarget.value !== '' && Number.isFinite(e.currentTarget.valueAsNumber)) change({[axis]: Math.max(axis === 'width' ? 160 : axis === 'height' ? 120 : 0,e.currentTarget.valueAsNumber)}) }} /></label>)}</div>
        <button className="bui-button" onClick={() => { if (window.confirm('Remove this item from the draft? You can undo before saving.')) { draft({...board,items:board.items.filter(item => item.id !== active.id).map(item=>({...item,parentId:item.parentId===active.id?undefined:item.parentId,fromId:item.fromId===active.id?undefined:item.fromId,toId:item.toId===active.id?undefined:item.toId}))}); select(undefined) } }}>Remove item</button>
      </fieldset> : <p>Select a card or an outline entry to edit it. Selected cards have move and resize handles. Use arrow keys on a handle (Shift for ten units), or edit position and size fields. Escape cancels a drag.</p>}
      <details className="re-board-recovery"><summary>Previous saved revision</summary>{previous ? <><p>Revision {previous.revision} · {previous.title || 'Untitled board'} · {previous.items.length} items</p><button className="bui-button" disabled={busy || !!recovered} onClick={() => { if (!dirty || window.confirm('Replace unsaved edits with the previous revision?')) { draft({...previous, revision: board.revision}); select(undefined) } }}>Load previous revision into draft</button><p>Review it, then Save revision to commit. The current saved board stays intact until then.</p></> : <p>A previous snapshot appears after the next save.</p>}</details>
      </aside>
    </div>
  </section>
}
