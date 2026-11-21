/** Conservative three-way whole-item merge, never a network write. */
import {validateSharedBoardItems,type TeamBoard,type TeamItem} from './board'
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(value)??'undefined'
export function mergeSharedBoard(base:TeamBoard,ours:TeamBoard,theirs:TeamBoard):{board?:TeamBoard;conflicts:string[]}{
 if(base.id!==ours.id||base.id!==theirs.id||ours.revision!==base.revision||theirs.revision<base.revision)return{conflicts:['Board identity or base revision differs']}
 const conflicts:string[]=[]
 const choose=<T>(path:string,b:T,o:T,t:T):T=>{if(canonical(o)===canonical(t))return t;if(canonical(o)===canonical(b))return t;if(canonical(t)===canonical(b))return o;conflicts.push(path);return t}
 const title=choose('title',base.title,ours.title,theirs.title),maps=[base,ours,theirs].map(board=>new Map(board.items.map(item=>[item.id,item])))
 const items:TeamItem[]=[]
 for(const id of new Set([...theirs.items,...ours.items,...base.items].map(i=>i.id))){const item=choose(`item:${id}`,maps[0].get(id),maps[1].get(id),maps[2].get(id));if(item)items.push(structuredClone(item))}
 if(conflicts.length)return{conflicts}
 try{validateSharedBoardItems(items)}catch{return{conflicts:['Merged item relationships/geometry are invalid; resolve manually']}}
 return{board:{id:theirs.id,revision:theirs.revision,title,items},conflicts:[]}
}
