/** Atomic encrypted single-head lanes per browser namespace/destination/member/kind.
 * No automatic decrypt/dispatch. One tab cannot overwrite another tab's head. */
import {boardWritesFrozen} from '@/lib/board/storage'
import type {TeamEndpoint} from '../../../../shared/teams/client'
import type {ContentKind} from '../../../../shared/teams/outbox'
export type OutboxScope=TeamEndpoint&{namespace:string;member:string;kind:ContentKind}
export type PendingRecord={key:string;id:string;bytes:Uint8Array}
export const outboxDatabase=(namespace:string)=>`re-teams-outbox-v1:${namespace}`
const key=(scope:OutboxScope)=>JSON.stringify([scope.origin,scope.team,scope.member,scope.kind])
async function open(scope:OutboxScope){
 if(boardWritesFrozen())throw new Error('Storage writes are frozen')
 return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(outboxDatabase(scope.namespace),1);request.onupgradeneeded=()=>request.result.createObjectStore('pending',{keyPath:'key'});request.onerror=()=>reject(new Error('Outbox unavailable'));request.onblocked=()=>reject(new Error('Outbox blocked'));request.onsuccess=()=>{if(boardWritesFrozen()){request.result.close();reject(new Error('Storage frozen'));return}request.result.onversionchange=()=>request.result.close();resolve(request.result)}})
}
export async function readPending(scope:OutboxScope):Promise<PendingRecord|undefined>{
 const db=await open(scope)
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('pending','readonly'),request=tx.objectStore('pending').get(key(scope));let result:PendingRecord|undefined;request.onsuccess=()=>{result=request.result;if(result&&(result.key!==key(scope)||!/^[A-Za-z0-9_-]{1,128}$/.test(result.id)||!(result.bytes instanceof Uint8Array)||!result.bytes.length||result.bytes.length>100000))tx.abort()};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(new Error('Outbox read aborted'));tx.onerror=()=>{}})}finally{db.close()}
}
export async function storePending(scope:OutboxScope,id:string,bytes:Uint8Array){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!bytes.length||bytes.length>100000)throw new Error('Invalid outbox envelope')
 const db=await open(scope)
 try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('pending','readwrite',{durability:'strict'});tx.objectStore('pending').add({key:key(scope),id,bytes:bytes.slice()});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error('Pending lane occupied or storage failed; nothing dispatched'));tx.onerror=()=>{}})}finally{db.close()}
}
export async function removePending(scope:OutboxScope,id:string){
 const db=await open(scope)
 try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('pending','readwrite',{durability:'strict'}),store=tx.objectStore('pending'),request=store.get(key(scope));request.onsuccess=()=>{if(request.result){if(request.result.id!==id){tx.abort();return}store.delete(key(scope))}};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error('Outbox identity changed or cleanup failed'));tx.onerror=()=>{}})}finally{db.close()}
}
