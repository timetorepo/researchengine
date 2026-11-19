import { useId } from 'react'
import type { BoardItem } from '@/lib/board/storage'
import { connectorPath } from '@/lib/board/connectors'

export function BoardConnectors({items,selected,onSelect}:{items:BoardItem[];selected?:string;onSelect:(id:string)=>void}) {
  const marker=useId().replace(/:/g,'')
  return <svg className="re-board-connectors" aria-label="Board connections"><defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
    {items.filter(item=>item.kind==='connector').map(item=>{const route=connectorPath(item,items);if(!route)return null
      return <g key={item.id} id={`board-card-${item.id}`} data-connector={item.id} data-selected={item.id===selected}>
        <path className="re-board-connector-line" d={route.d} markerEnd={`url(#${marker})`} aria-hidden="true"/>
        <path className="re-board-connector-hit" d={route.d} role="button" tabIndex={0} aria-pressed={item.id===selected} aria-label={`Select connector: ${item.text||'Unlabelled connection'}`} onClick={()=>onSelect(item.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(item.id)}}}/>
        <text x={route.x} y={route.y} textAnchor="middle" aria-hidden="true">{item.text.split('\n')[0].slice(0,80)}</text>
      </g>
    })}
  </svg>
}
