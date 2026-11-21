import {useRef,useState} from 'react'
import {BoardCard} from '../board/BoardCard'
import {BoardConnectors} from '../board/BoardConnectors'
import {BoardDrawSurface,DrawingTools} from '../board/BoardDraw'
import {editGeometry,frameContents,frameOptions} from '@/lib/board/structure'
import {previewConnectors,removeBoardItem} from '@/lib/board/connectors'
import {strokeItem,type DrawPoint} from '@/lib/board/drawing'
import {validateSharedBoardItems,type TeamBoard,type TeamItem} from '../../../../shared/teams/board'
import '../board/board.css'

export function SharedBoardCanvas({board,disabled,onChange}:{board:TeamBoard;disabled:boolean;onChange:(board:TeamBoard)=>void}){
 const [selected,select]=useState(''),[zoom,setZoom]=useState(1),[drawing,setDrawing]=useState(false),[error,setError]=useState(''),[url,setURL]=useState(''),[version,tick]=useState(0)
 const history=useRef<TeamBoard[]>([]),redo=useRef<TeamBoard[]>([])
 const item=board.items.find(i=>i.id===selected)
 function commit(items:TeamItem[]){if(disabled)return;try{const clean=JSON.parse(JSON.stringify(items));validateSharedBoardItems(clean);history.current.push(structuredClone(board));if(history.current.length>50)history.current.shift();redo.current=[];onChange({...board,items:clean});tick(version+1);setError('')}catch{setError('Invalid canvas edit. Check geometry, source URL, frame membership and connector endpoints. Draft unchanged.')}}
 function patch(value:Partial<TeamItem>){if(item)commit(board.items.map(i=>i.id===item.id?{...i,...value}:i))}
 function add(kind:'note'|'reference'|'shape'|'frame'){
  const next:TeamItem={id:crypto.randomUUID(),kind,text:'',x:40+board.items.length*20,y:40+board.items.length*20,width:kind==='frame'?480:260,height:kind==='frame'?360:180,...(kind==='shape'?{shape:'rectangle' as const}:{})};commit([...board.items,next]);select(next.id)
 }
 function draw(points:DrawPoint[]){try{const next=strokeItem(points);commit([...board.items,next]);select(next.id);setDrawing(false)}catch{setError('Invalid stroke; draft unchanged.')}}
 const width=Math.max(1600,...board.items.map(i=>i.x+i.width+100)),height=Math.max(1000,...board.items.map(i=>i.y+i.height+100))
 return <section aria-label="Shared Board canvas editor">
  <p>Canvas edits are local drafts until you publish the reviewed revision. Scroll to pan; zoom is local only. Image/PDF originals cannot be uploaded or previewed here yet; existing item references are preserved.</p>
  <div className="re-teams-actions">{(['note','reference','shape','frame'] as const).map(kind=><button key={kind} className="bui-button" disabled={disabled} onClick={()=>add(kind)}>Add canvas {kind}</button>)}
   <button className="bui-button" disabled={disabled||!history.current.length} onClick={()=>{const previous=history.current.pop();if(previous){redo.current.push(structuredClone(board));onChange(previous);tick(version+1)}}}>Undo canvas edit</button>
   <button className="bui-button" disabled={disabled||!redo.current.length} onClick={()=>{const next=redo.current.pop();if(next){history.current.push(structuredClone(board));onChange(next);tick(version+1)}}}>Redo canvas edit</button>
  </div>
  <label>Canvas zoom<select className="bui-field" aria-label="Shared canvas zoom" value={zoom} onChange={e=>{setZoom(Number(e.target.value));setDrawing(false)}}>{[0.25,0.5,1,1.5,2].map(v=><option key={v} value={v}>{v*100}%</option>)}</select></label>
  <DrawingTools active={drawing&&!disabled} disabled={disabled} onToggle={()=>setDrawing(!drawing)} onAdd={draw}/>
  <div className="re-board-canvas-scroll re-shared-canvas" tabIndex={0} role="region" aria-label="Shared canvas, scroll to pan"><div className="re-board-canvas-size" style={{width:width*zoom,height:height*zoom}}><div className="re-board-canvas" style={{width,height,transform:`scale(${zoom})`}}>
   {board.items.filter(i=>i.kind!=='connector').map((i,index)=><BoardCard key={i.id} item={i} index={index} selected={i.id===selected} disabled={disabled||drawing} zoom={zoom} onSelect={()=>select(i.id)} members={i.kind==='frame'?frameContents(board.items,i.id):undefined} onPreview={changes=>previewConnectors(board.items,changes)} onGeometry={geometry=>commit(editGeometry(board.items,i.id,geometry))}/>)}
   <BoardConnectors items={board.items} selected={selected} onSelect={select}/>
   {drawing&&!disabled&&<BoardDrawSurface width={width} height={height} zoom={zoom} disabled={disabled} onStroke={draw} onCancel={()=>setDrawing(false)}/>}
  </div></div></div>
  <label>Canvas item<select className="bui-field" aria-label="Shared canvas item" value={item?.id??''} onChange={e=>{select(e.target.value);setURL('')}}><option value="">Select an item</option>{board.items.map((i,index)=><option key={i.id} value={i.id}>{index+1} · {i.kind} · {i.text.slice(0,60)||i.id}</option>)}</select></label>
  {item&&<fieldset disabled={disabled}><legend>Selected {item.kind}</legend>
   <label>Item text<textarea className="bui-field" aria-label="Shared canvas item text" value={item.text} onChange={e=>patch({text:e.target.value})}/></label>
   {(['x','y','width','height'] as const).map(field=><label key={field}>{field}<input className="bui-field" aria-label={`Shared item ${field}`} type="number" value={item[field]} onChange={e=>{if(e.target.value!=='')commit(editGeometry(board.items,item.id,{x:item.x,y:item.y,width:item.width,height:item.height,[field]:Number(e.target.value)}))}}/></label>)}
   <label>Text format<select aria-label="Shared item text format" className="bui-field" value={item.textFormat??'plain'} onChange={e=>patch({textFormat:e.target.value==='markdown'?'markdown':undefined})}><option value="plain">Plain text</option><option value="markdown">Markdown</option></select></label>
   {item.kind==='shape'&&<label>Shape<select aria-label="Shared shape" className="bui-field" value={item.shape??'rectangle'} onChange={e=>patch({shape:e.target.value as TeamItem['shape']})}>{['rectangle','ellipse','diamond'].map(v=><option key={v}>{v}</option>)}</select></label>}
   <label>Parent frame<select aria-label="Shared parent frame" className="bui-field" value={item.parentId??''} onChange={e=>patch({parentId:e.target.value||undefined})}><option value="">No parent frame</option>{frameOptions(board.items,item).map(i=><option key={i.id} value={i.id}>{i.text||i.id}</option>)}</select></label>
   {item.kind==='reference'&&<><p>Current source: {item.source?.url??'none'}</p><label>Source URL<input className="bui-field" aria-label="Shared reference URL" value={url} onChange={e=>setURL(e.target.value)}/></label><button className="bui-button" onClick={()=>patch({source:url?{url}:undefined})}>Apply shared reference URL</button></>}
   {item.kind==='connector'&&(['fromId','toId'] as const).map(field=><label key={field}>{field}<select className="bui-field" aria-label={`Shared connector ${field}`} value={item[field]} onChange={e=>patch({[field]:e.target.value})}>{board.items.filter(i=>i.kind!=='connector').map(i=><option key={i.id} value={i.id}>{i.text||i.id}</option>)}</select></label>)}
   {item.kind!=='connector'&&<button className="bui-button" disabled={!board.items.some(i=>i.kind!=='connector'&&i.id!==item.id)} onClick={()=>{const target=board.items.find(i=>i.kind!=='connector'&&i.id!==item.id)!;const next:TeamItem={id:crypto.randomUUID(),kind:'connector',text:'',x:0,y:0,width:1,height:1,fromId:item.id,toId:target.id};commit([...board.items,next]);select(next.id)}}>Connect selected item</button>}
   <button className="bui-button" onClick={()=>{if(window.confirm('Delete selected item and its incident connections from this draft?')){commit(removeBoardItem(board.items,item.id));select('')}}}>Delete selected shared item</button>
  </fieldset>}
  {error&&<p role="alert">{error}</p>}
 </section>
}
