import {useEffect,useRef,useState} from 'react'
import type {TeamClient} from '@/lib/teams/client'
import {watchTeam} from '../../../../shared/teams/watch'
/** Explicit opt-in reads and separately consented leases; never applies a draft. */
export function TeamLiveMonitor({client,isScoped,onSequence}:{client:TeamClient;isScoped:()=>boolean;onSequence:(sequence:number)=>void}){
 const [announce,setAnnounce]=useState(false),[members,setMembers]=useState<string[]>([])
 const [enabled,setEnabled]=useState(false),[status,setStatus]=useState('Off. No background Team reads.'),[checked,setChecked]=useState<string>()
 const scope=useRef(isScoped),notify=useRef(onSequence);scope.current=isScoped;notify.current=onSequence
 useEffect(()=>{
  if(!enabled)return
  setStatus('Checking shared state; local drafts and unresolved operations will not be changed.')
  const stop=watchTeam({read:async signal=>{const snapshot=await client.read(signal);if(announce&&!signal.aborted&&scope.current()){const presence=await client.presence(true,signal);if(!signal.aborted&&scope.current())setMembers(presence.members.map(m=>m.member))};return snapshot},scoped:()=>scope.current(),visible:()=>document.visibilityState==='visible'&&navigator.onLine,onSnapshot:snapshot=>{notify.current(snapshot.state.sequence);setChecked(new Date().toISOString());setStatus(`Observed host sequence ${snapshot.state.sequence} · current role ${snapshot.role}. Load/refresh each shared view to review changes; drafts were not replaced.`)},onStop:reason=>{setEnabled(false);setAnnounce(false);setMembers([]);setStatus(reason==='scope'?'Stopped because the private workspace changed.':'Stopped after a failed or regressing read. Snapshots may be stale. Check host/session and explicitly enable again; no reconnect or resend occurred.')}})
  return stop
 },[client,enabled,announce])
 return <section className="re-teams-card" aria-label="Live Team update awareness"><h2>Live update awareness</h2><label><input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);if(!event.target.checked){setAnnounce(false);setMembers([])}}}/>Watch shared state while this page is visible</label><label><input type="checkbox" disabled={!enabled} checked={announce} onChange={event=>{setAnnounce(event.target.checked);setMembers([])}}/>Also share my temporary member presence with this Team</label>{announce&&<p>Last observed members announcing presence: {members.join(', ')||'none observed yet'}. Leases expire within 30 seconds of the last heartbeat; this list may be stale and is not proof of active editing. Stopping, hiding, going offline or leaving stops heartbeats, not immediate deletion.</p>}<p>Opt-in read every five seconds after the previous read completes. Paused in hidden tabs or while the browser reports offline. This reveals your active reads to the host. Presence announcements are separately opt-in and memory-only on the host. No cursors, automatic merge, publishing, delivery or reconnect.</p><p role="status">{status}{!enabled&&checked?' Monitoring is off.':''}{checked?` Last successful observation: ${checked}.`:''}</p></section>
}
