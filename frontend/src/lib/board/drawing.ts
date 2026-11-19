import type { BoardItem } from './storage'
export type DrawPoint={x:number;y:number}
/** Persist unit-box points so resize scales the stroke while moves keep the same path. */
export function strokeItem(points:DrawPoint[]):BoardItem {
  if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0))throw new Error('Drawing needs at least one finite, non-negative point.')
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for(const point of points){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y)}
  const width=Math.max(160,maxX-minX+12),height=Math.max(120,maxY-minY+12)
  const x=Math.max(0,minX-(width-(maxX-minX))/2),y=Math.max(0,minY-(height-(maxY-minY))/2)
  const normalized=points.map(p=>({x:(p.x-x)/width,y:(p.y-y)/height}))
  if(![x,y,width,height].every(Number.isFinite)||normalized.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Drawing coordinates exceed the supported numeric range.')
  return {id:crypto.randomUUID(),kind:'drawing',text:'',x,y,width,height,points:normalized,pointSpace:'unit'}
}
export function drawingPath(points:DrawPoint[]) {
  if(!points.length)return ''
  return `M ${points[0].x} ${points[0].y} `+(points.length===1?`L ${points[0].x} ${points[0].y}`:points.slice(1).map(p=>`L ${p.x} ${p.y}`).join(' '))
}
export function parseDrawingPoints(text:string):DrawPoint[] {
  if(!text.trim())throw new Error('Enter at least one point as X, Y on each line.')
  return text.trim().split(/\r?\n/).map((line,index)=>{
    const parts=line.trim().split(/[,\s]+/),x=Number(parts[0]),y=Number(parts[1])
    if(parts.length!==2||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0)throw new Error(`Line ${index+1}: use two finite, non-negative coordinates, such as 80, 120.`)
    return {x,y}
  })
}
