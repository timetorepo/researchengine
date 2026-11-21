import assert from 'node:assert/strict'
import {watchTeam,type WatchSnapshot} from '../../shared/teams/watch'
const snapshot=(sequence:number)=>({state:{sequence},member:'m',role:'Editor'} as WatchSnapshot)
const settle=()=>new Promise(resolve=>setImmediate(resolve))
// Deterministic scheduler: no elapsed-time sleeps or network requests.
const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout
let timers=new Map<number,()=>void>(),next=0
;(globalThis as any).setTimeout=(fn:()=>void)=>{timers.set(++next,fn);return next}
;(globalThis as any).clearTimeout=(id:number)=>timers.delete(id)
async function tick(){const entry=timers.entries().next().value;assert.ok(entry);timers.delete(entry[0]);entry[1]();await settle()}
try{
 let reads=0,visible=false,scoped=true,reason='',seen:number[]=[],pending:((v:WatchSnapshot)=>void)|undefined,signal:AbortSignal|undefined
 const stop=watchTeam({read:s=>{reads++;signal=s;return new Promise(resolve=>pending=resolve)},visible:()=>visible,scoped:()=>scoped,onSnapshot:s=>seen.push(s.state.sequence),onStop:r=>reason=r})
 assert.equal(reads,0);visible=true;await tick();assert.equal(reads,1);assert.equal(timers.size,0,'no overlapping requests or timer while read pending')
 pending!(snapshot(2));await settle();assert.deepEqual(seen,[2]);assert.equal(timers.size,1)
 await tick();assert.equal(reads,2);pending!(snapshot(1));await settle();assert.equal(reason,'failed');assert.equal(timers.size,0);assert.deepEqual(seen,[2]);stop()
 reason='';const stop2=watchTeam({read:async()=>{throw new Error('revoked')},visible:()=>true,scoped:()=>true,onSnapshot:()=>assert.fail(),onStop:r=>reason=r});await settle();assert.equal(reason,'failed');assert.equal(timers.size,0);stop2()
 const stop3=watchTeam({read:s=>{signal=s;return new Promise(resolve=>pending=resolve)},visible:()=>true,scoped:()=>scoped,onSnapshot:()=>assert.fail('late result applied'),onStop:()=>{}});stop3();assert.equal(signal!.aborted,true);pending!(snapshot(9));await settle();assert.equal(timers.size,0)
 reason='';const stop4=watchTeam({read:async()=>snapshot(9),visible:()=>false,scoped:()=>scoped,onSnapshot:()=>assert.fail(),onStop:r=>reason=r});scoped=false;await tick();assert.equal(reason,'scope');assert.equal(timers.size,0);stop4()
 console.log('PASS Teams watch: opt-in caller lifecycle, hidden pause, serialized reads, monotonic sequence, failure stop/no retry, abort/late-result suppression, namespace/privacy-scope stop. No writes or reconnect path.')
}finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear}
