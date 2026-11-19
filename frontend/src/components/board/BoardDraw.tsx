import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Pencil, MousePointer2 } from 'lucide-react'
import { drawingPath, parseDrawingPoints, type DrawPoint } from '@/lib/board/drawing'

export function DrawingTools({active,disabled,onToggle,onAdd}:{active:boolean;disabled:boolean;onToggle:()=>void;onAdd:(points:DrawPoint[])=>void}) {
  const [source,setSource]=useState(''),[error,setError]=useState('')
  return <div className="re-board-drawing-tools"><button className="bui-button" disabled={disabled} aria-pressed={active} onClick={onToggle}>{active?<MousePointer2 size={14}/>:<Pencil size={14}/>} {active?'Cancel drawing':'Draw stroke'}</button>
    <span>{active?'Draw one stroke on the canvas, then return to selection. Escape cancels.':'Mouse, touch or pen · one stroke per item · no pressure sensitivity.'}</span>
    <details><summary>Draw with coordinates (keyboard alternative)</summary><fieldset disabled={disabled||active}><label>Board points<textarea className="bui-field" aria-label="New drawing points" placeholder={'80, 80\n120, 140\n200, 90'} rows={3} value={source} onChange={event=>setSource(event.target.value)}/></label><p>Enter X, Y board coordinates, one pair per line. Points join in order. One point creates a dot.</p><button className="bui-button" onClick={()=>{try{onAdd(parseDrawingPoints(source));setError('')}catch(e){setError(e instanceof Error?e.message:'Invalid drawing points.')}}}>Add drawing from points</button>{error&&<p role="alert">{error}</p>}</fieldset></details>
  </div>
}

type Gesture={id:number;points:DrawPoint[];element:SVGSVGElement}
/** A temporary SVG path tracks the pointer. Only release changes the draft. */
export function BoardDrawSurface({width,height,zoom,disabled,onStroke,onCancel}:{width:number;height:number;zoom:number;disabled:boolean;onStroke:(points:DrawPoint[])=>void;onCancel:()=>void}) {
  const path=useRef<SVGPathElement>(null),gesture=useRef<Gesture|undefined>(undefined),latest=useRef({onStroke,onCancel})
  latest.current={onStroke,onCancel}
  function clear() {
    const current=gesture.current;gesture.current=undefined
    path.current?.setAttribute('d','')
    if(current)try{if(current.element.hasPointerCapture(current.id))current.element.releasePointerCapture(current.id)}catch{/* pointer already cancelled */}
  }
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();clear();latest.current.onCancel()}};window.addEventListener('keydown',escape,true);window.addEventListener('blur',clear);return()=>{window.removeEventListener('keydown',escape,true);window.removeEventListener('blur',clear);clear()}},[])
  useEffect(()=>{if(disabled)clear();return clear},[disabled,zoom,width,height])
  function point(event:PointerEvent<SVGSVGElement>):DrawPoint {
    const box=event.currentTarget.getBoundingClientRect()
    return {x:Math.max(0,Math.min(width,(event.clientX-box.left)/zoom)),y:Math.max(0,Math.min(height,(event.clientY-box.top)/zoom))}
  }
  function track(event:PointerEvent<SVGSVGElement>,force=false) {
    const current=gesture.current;if(!current||event.pointerId!==current.id)return
    const next=point(event),last=current.points[current.points.length-1]
    if((next.x!==last.x||next.y!==last.y)&&(force||Math.hypot(next.x-last.x,next.y-last.y)>=1))current.points.push(next)
    path.current?.setAttribute('d',drawingPath(current.points))
  }
  return <svg className="re-board-draw-surface" width={width} height={height} aria-label="Freehand drawing surface" role="img"
    onPointerDown={event=>{if(disabled||gesture.current||event.button!==0||!event.isPrimary)return;event.preventDefault();gesture.current={id:event.pointerId,points:[point(event)],element:event.currentTarget};event.currentTarget.setPointerCapture(event.pointerId);path.current?.setAttribute('d',drawingPath(gesture.current.points))}}
    onPointerMove={event=>track(event)} onPointerUp={event=>{if(!gesture.current||event.pointerId!==gesture.current.id)return;track(event,true);const points=gesture.current.points;clear();if(!disabled)latest.current.onStroke(points)}}
    onPointerCancel={event=>{if(event.pointerId===gesture.current?.id)clear()}} onLostPointerCapture={event=>{if(event.pointerId===gesture.current?.id)clear()}}><path ref={path} d=""/></svg>
}
