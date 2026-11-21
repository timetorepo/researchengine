/** Read-only, serialized snapshot observation. Never submits/reconnects/retries failures. */
import type {TeamClient} from './client'
export type WatchSnapshot=Awaited<ReturnType<TeamClient['read']>>
export function watchTeam(options:{read:(signal:AbortSignal)=>Promise<WatchSnapshot>;scoped:()=>boolean;visible:()=>boolean;onSnapshot:(snapshot:WatchSnapshot)=>void;onStop:(reason:'failed'|'scope')=>void;intervalMs?:number}){
 const interval=options.intervalMs??5000
 if(!Number.isFinite(interval)||interval<1000)throw new Error('Invalid watch interval')
 let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,active:AbortController|undefined,last=-1
 function stop(){stopped=true;if(timer!==undefined)clearTimeout(timer);active?.abort()}
 async function tick(){
  if(stopped)return
  if(!options.scoped()){stop();options.onStop('scope');return}
  if(!options.visible()){timer=setTimeout(()=>void tick(),interval);return}
  const abort=new AbortController();active=abort
  try{
   const snapshot=await options.read(abort.signal)
   if(stopped||abort.signal.aborted)return
   if(!options.scoped()){stop();options.onStop('scope');return}
   if(snapshot.state.sequence<last)throw new Error('Regressing snapshot')
   last=snapshot.state.sequence;options.onSnapshot(snapshot)
  }catch{if(!stopped){stop();options.onStop('failed')}return}
  finally{if(active===abort)active=undefined}
  if(!stopped)timer=setTimeout(()=>void tick(),interval)
 }
 void tick()
 return stop
}
