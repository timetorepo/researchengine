import type { BoardItem } from './storage'
import type { CardGeometry } from './geometry'

/** Explicit membership, not geometric containment. Validated documents have no cycles. */
export function frameContents(items:BoardItem[],id:string):BoardItem[] {
  const included=new Set([id]);let changed=true
  while(changed){changed=false;for(const item of items)if(item.parentId&&included.has(item.parentId)&&!included.has(item.id)){included.add(item.id);changed=true}}
  return items.filter(item=>included.has(item.id))
}
export function frameOptions(items:BoardItem[],item:BoardItem) {
  const excluded=new Set(frameContents(items,item.id).map(value=>value.id))
  return items.filter(value=>value.kind==='frame'&&!excluded.has(value.id))
}
/** A frame move translates its full membership tree; resizing never scales contents. */
export function editGeometry(items:BoardItem[],id:string,next:CardGeometry):BoardItem[] {
  const current=items.find(item=>item.id===id);if(!current)return items
  if(current.x===next.x&&current.y===next.y&&current.width===next.width&&current.height===next.height)return items
  const group=current.kind==='frame'?frameContents(items,id):[current]
  const dx=Math.max(next.x-current.x,-Math.max(0,group.reduce((min,item)=>Math.min(min,item.x),Infinity)))
  const dy=Math.max(next.y-current.y,-Math.max(0,group.reduce((min,item)=>Math.min(min,item.y),Infinity)))
  const ids=new Set(group.map(item=>item.id))
  return items.map(item=>item.id===id?{...item,...next,x:current.x+dx,y:current.y+dy}:ids.has(item.id)?{...item,x:item.x+dx,y:item.y+dy}:item)
}
