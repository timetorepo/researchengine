import { useEffect, useId, useRef, type PointerEvent, type KeyboardEvent } from 'react'
import { FileText, Link2, Move, Scaling } from 'lucide-react'
import { BoardMarkdown } from './BoardMarkdown'
import type { BoardItem } from '@/lib/board/storage'
import { changedGeometry, sameGeometry, type CardGeometry } from '@/lib/board/geometry'

type Props = { item:BoardItem; index:number; selected:boolean; disabled:boolean; zoom:number; onSelect:()=>void; onGeometry:(geometry:CardGeometry)=>void }
type Gesture = {pointerId:number;kind:'move'|'resize';startX:number;startY:number;scrollX:number;scrollY:number;scroller:HTMLElement|null;base:CardGeometry;next:CardGeometry;handle:HTMLButtonElement;zoom:number}
/** Pointer tracking writes only this card's styles. The document changes once on release. */
export function BoardCard(props:Props) {
  const {item,index,selected,disabled,zoom,onSelect}=props
  const root=useRef<HTMLDivElement>(null), gesture=useRef<Gesture|undefined>(undefined), latest=useRef(props)
  latest.current=props
  const help=useId()
  function clear() {
    const current=gesture.current;if(!current)return
    gesture.current=undefined
    if(root.current){root.current.style.transform='';root.current.style.width=`${current.base.width}px`;root.current.style.height=`${current.base.height}px`;delete root.current.dataset.manipulating}
    try {if(current.handle.hasPointerCapture(current.pointerId))current.handle.releasePointerCapture(current.pointerId)}catch{/* detached/cancelled pointer */}
  }
  useEffect(()=>{const cancel=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();clear()}};window.addEventListener('keydown',cancel,true);window.addEventListener('blur',clear);return()=>{window.removeEventListener('keydown',cancel,true);window.removeEventListener('blur',clear);clear()}},[])
  useEffect(()=>()=>clear(),[item.x,item.y,item.width,item.height,zoom,disabled,selected])
  function start(event:PointerEvent<HTMLButtonElement>,kind:'move'|'resize') {
    if(disabled||event.button!==0||!event.isPrimary||gesture.current)return
    event.preventDefault();event.stopPropagation();onSelect();event.currentTarget.focus({preventScroll:true})
    const scroller=root.current?.closest<HTMLElement>('.re-board-canvas-scroll')??null
    const base={x:item.x,y:item.y,width:item.width,height:item.height}
    gesture.current={pointerId:event.pointerId,kind,startX:event.clientX,startY:event.clientY,scrollX:scroller?.scrollLeft??0,scrollY:scroller?.scrollTop??0,scroller,base,next:base,handle:event.currentTarget,zoom}
    event.currentTarget.setPointerCapture(event.pointerId)
    if(root.current)root.current.dataset.manipulating='true'
  }
  function track(event:PointerEvent<HTMLButtonElement>) {
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId||!root.current)return
    const dx=(event.clientX-current.startX+(current.scroller?.scrollLeft??0)-current.scrollX)/current.zoom
    const dy=(event.clientY-current.startY+(current.scroller?.scrollTop??0)-current.scrollY)/current.zoom
    // No accidental edits for a stationary selection press.
    if(Math.abs(dx)<2&&Math.abs(dy)<2&&sameGeometry(current.base,current.next))return
    current.next=changedGeometry(current.base,current.kind,dx,dy)
    if(current.kind==='move')root.current.style.transform=`translate(${current.next.x-current.base.x}px,${current.next.y-current.base.y}px)`
    else {root.current.style.width=`${current.next.width}px`;root.current.style.height=`${current.next.height}px`}
  }
  function finish(event:PointerEvent<HTMLButtonElement>) {
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return
    track(event);const {base,next}=current;clear()
    if(!sameGeometry(base,next))latest.current.onGeometry(next)
  }
  function keyboard(event:KeyboardEvent<HTMLButtonElement>,kind:'move'|'resize') {
    if(disabled||gesture.current)return
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key]
    if(!direction)return
    event.preventDefault();event.stopPropagation();onSelect()
    const step=event.shiftKey?10:1;const next=changedGeometry(item,kind,direction[0]*step,direction[1]*step)
    if(!sameGeometry(item,next))props.onGeometry(next)
  }
  const handlers=(kind:'move'|'resize')=>({onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>start(event,kind),onPointerMove:track,onPointerUp:finish,onPointerCancel:clear,onLostPointerCapture:clear,onKeyDown:(event:KeyboardEvent<HTMLButtonElement>)=>keyboard(event,kind)})
  return <div ref={root} id={`board-card-${item.id}`} data-board-item={item.id} className="re-board-card" data-selected={selected} style={{left:item.x,top:item.y,width:item.width,height:item.height}}>
    <button className="re-board-card-select" aria-pressed={selected} aria-label={`Select ${item.kind} ${index+1}: ${item.text.slice(0,60)||'Untitled'}`} onClick={onSelect}>
      <small>{item.kind==='reference'?<Link2 size={13}/>:<FileText size={13}/>}{item.kind}</small><span className="re-board-card-text">{item.textFormat==='markdown'&&item.text?<BoardMarkdown text={item.text} compact/>:item.text||(item.kind==='reference'?'Add a source and your annotation…':'Write a note…')}</span>
      {item.attachmentId&&<em>{item.kind==='pdf'?`PDF · page ${item.source?.page??1} · select to preview`:'Image · select to preview'}</em>}{item.source?.url&&<em>{item.source.url}</em>}
    </button>
    {selected&&<><span id={help} className="sr-only">Drag a handle, or use arrow keys. Shift changes by ten units. Escape cancels a pointer gesture. Changes are drafts until saved.</span>
      <button type="button" className="re-board-move-handle" disabled={disabled} aria-label={`Move ${item.kind} card`} aria-describedby={help} {...handlers('move')}><Move size={14} aria-hidden="true"/></button>
      <button type="button" className="re-board-resize-handle" disabled={disabled} aria-label={`Resize ${item.kind} card`} aria-describedby={help} {...handlers('resize')}><Scaling size={14} aria-hidden="true"/></button>
    </>}
  </div>
}
