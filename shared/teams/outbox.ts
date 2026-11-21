/** Exact content-operation custody. No credentials, IO or dispatch. */
import type {ClientOperation,TeamEndpoint} from './client'
import {sealBoardDraft,unlockBoardDraft} from './board-draft'
import {sealBackChatDraft,unlockBackChatDraft} from './backchat-draft'
export type ContentKind=ClientOperation['kind']
function fields(value:any,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(','))throw new Error('Invalid outbox fields')}
export async function sealPending(scope:TeamEndpoint,member:string,operation:ClientOperation,password:string){
 fields(operation,['id','actor','kind','payload'])
 if(operation.actor!==member||!/^[A-Za-z0-9_-]{1,128}$/.test(operation.id))throw new Error('Invalid outbox actor/identity')
 const p=operation.payload as any
 if(operation.kind==='team.board.replace.v1'){
  fields(p,['boardId','expectedRevision','title','items'])
  return sealBoardDraft(scope,{member,operationId:operation.id,board:{id:p.boardId,revision:p.expectedRevision,title:p.title,items:p.items}},password)
 }
 if(operation.kind!=='team.backchat.post.v1')throw new Error('Invalid outbox kind')
 fields(p,['id','threadId','text','attachments','links'])
 return sealBackChatDraft(scope,{member,text:p.text,threadId:p.threadId,attachments:p.attachments,links:p.links,pending:{operationId:operation.id,postId:p.id}},password)
}
export async function unlockPending(scope:TeamEndpoint,member:string,kind:ContentKind,bytes:Uint8Array,password:string):Promise<ClientOperation>{
 if(kind==='team.board.replace.v1'){
  const value=await unlockBoardDraft(bytes,password,scope,member)
  if(!value.operationId)throw new Error('Missing operation identity')
  return{id:value.operationId,actor:member,kind,payload:{boardId:value.board.id,expectedRevision:value.board.revision,title:value.board.title,items:value.board.items}}
 }
 if(kind!=='team.backchat.post.v1')throw new Error('Invalid outbox kind')
 const value=await unlockBackChatDraft(bytes,password,scope,member)
 if(!value.pending)throw new Error('Missing operation identity')
 return{id:value.pending.operationId,actor:member,kind,payload:{id:value.pending.postId,threadId:value.threadId,text:value.text,attachments:value.attachments??[],links:value.links??[]}}
}
