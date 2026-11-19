import type { BoardItem } from './storage'
type Point={x:number;y:number}
function boundary(item:BoardItem,dx:number,dy:number):Point {
  const rx=item.width/2,ry=item.height/2,cx=item.x+rx,cy=item.y+ry
  const scale=item.kind==='shape'&&item.shape==='ellipse'?1/Math.hypot(dx/rx,dy/ry)
    :item.kind==='shape'&&item.shape==='diamond'?1/(Math.abs(dx)/rx+Math.abs(dy)/ry)
    :1/Math.max(Math.abs(dx)/rx,Math.abs(dy)/ry)
  return {x:cx+dx*scale,y:cy+dy*scale}
}
/** Straight centre-directed boundary anchors, not obstacle-avoiding routing. */
export function connectorPath(item:BoardItem,items:BoardItem[]) {
  const from=items.find(value=>value.id===item.fromId&&value.kind!=='connector'),to=items.find(value=>value.id===item.toId&&value.kind!=='connector')
  if(!from||!to||from.id===to.id)return undefined
  const dx=to.x+to.width/2-from.x-from.width/2,dy=to.y+to.height/2-from.y-from.height/2
  if(Math.abs(dx)+Math.abs(dy)<0.001){
    const a=boundary(from,1,0),b=boundary(to,0,-1)
    return {d:`M ${a.x} ${a.y} C ${a.x+80} ${a.y} ${b.x} ${b.y-80} ${b.x} ${b.y}`,x:a.x+32,y:b.y-20}
  }
  const a=boundary(from,dx,dy),b=boundary(to,-dx,-dy)
  return {d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,x:(a.x+b.x)/2,y:(a.y+b.y)/2-8}
}
/** Temporary SVG updates share exactly the same route calculation as committed rendering. */
export function previewConnectors(items:BoardItem[],changes:BoardItem[]=[]) {
  const updates=new Map(changes.map(item=>[item.id,item])),projected=items.map(item=>updates.get(item.id)??item)
  for(const item of items)if(item.kind==='connector'){
    const group=document.getElementById(`board-card-${item.id}`),route=connectorPath(item,projected)
    if(!group||!route)continue
    for(const path of group.querySelectorAll('path'))path.setAttribute('d',route.d)
    const text=group.querySelector('text');if(text){text.setAttribute('x',String(route.x));text.setAttribute('y',String(route.y))}
  }
}
/** Removing an endpoint removes its incident connectors but retains frame contents. */
export function removeBoardItem(items:BoardItem[],id:string):BoardItem[] {
  const removed=new Set(items.filter(item=>item.id===id||(item.kind==='connector'&&(item.fromId===id||item.toId===id))).map(item=>item.id))
  return items.filter(item=>!removed.has(item.id)).map(item=>({...item,parentId:item.parentId&&removed.has(item.parentId)?undefined:item.parentId,fromId:item.fromId&&removed.has(item.fromId)?undefined:item.fromId,toId:item.toId&&removed.has(item.toId)?undefined:item.toId}))
}
