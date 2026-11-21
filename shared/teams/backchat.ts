/** Portable BackChat projection validation. No storage, network or private-chat imports. */
export type SharedPost = {id:string;threadId:string;actor:string;sequence:number;text:string;attachments:string[];links:{boardId:string;revision:number;itemId?:string}[]}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)
const record=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)
export type SharedLink=SharedPost['links'][number]
export function validateSharedLinks(value:unknown):asserts value is SharedLink[]{
 if(!Array.isArray(value)||value.length>64)throw new Error('Invalid shared post links')
 const seen=new Set<string>()
 for(const link of value){
  if(!record(link)||Object.keys(link).some(k=>!['boardId','revision','itemId'].includes(k))||!id(link.boardId)||!Number.isSafeInteger(link.revision)||link.revision<1||('itemId'in link&&!id(link.itemId)))throw new Error('Invalid shared post link')
  const key=JSON.stringify([link.boardId,link.revision,link.itemId??null]);if(seen.has(key))throw new Error('Duplicate shared post link');seen.add(key)
 }
}
export function sharedPosts(value:unknown,sequence:number):SharedPost[]{
 if(!Array.isArray(value))throw new Error('Invalid shared posts')
 const seen=new Set<string>();let previous=0
 for(const post of value){
  if(!record(post)||Object.keys(post).sort().join(',')!=='actor,attachments,id,links,sequence,text,threadId'||!id(post.id)||seen.has(post.id)||!id(post.threadId)||!id(post.actor)||!Number.isSafeInteger(post.sequence)||post.sequence<=previous||post.sequence>sequence||typeof post.text!=='string'||!Array.isArray(post.attachments)||post.attachments.some((v:unknown)=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))||new Set(post.attachments).size!==post.attachments.length||!Array.isArray(post.links))throw new Error('Invalid shared posts')
  for(const link of post.links)if(!record(link)||Object.keys(link).some(k=>!['boardId','revision','itemId'].includes(k))||!id(link.boardId)||!Number.isSafeInteger(link.revision)||link.revision<1||('itemId'in link&&!id(link.itemId)))throw new Error('Invalid shared post link')
  seen.add(post.id);previous=post.sequence
 }
 return structuredClone(value)
}
