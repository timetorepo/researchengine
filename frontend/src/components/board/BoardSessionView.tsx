import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen } from '@/lib/board/storage'
import { assertSessionBudget } from '@/lib/board/session'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { streamToCallback, usageOfError } from '@/lib/providers/stream'
import { shieldOutbound } from '@/lib/privacy/shield'
import { assertBudget, recordTokens } from '@/lib/usage/guard'
import { BoardMarkdown } from './BoardMarkdown'
import './board.css'

export function BoardSessionView({chatId}:{chatId:string}) {
  const chat=useStore(state=>state.chats.find(value=>value.id===chatId)),snapshot=chat?.boardSnapshot
  const [followup,setFollowup]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[namespace]=useState(activeNamespace)
  const controller=useRef<AbortController|undefined>(undefined)
  useEffect(()=>()=>controller.current?.abort(),[])
  useEffect(()=>setConsent(false),[followup,chat?.messages.length])
  if(!chat||!snapshot)return <section className="re-board-page"><p>This snapshot session is unavailable.</p></section>
  const first=!chat.messages.some(message=>message.role==='user'),retry=!first&&!followup.trim()
  const history=chat.messages.filter(message=>(message.role==='user'||message.role==='assistant')&&!message.error&&!message.stopped&&message.content).map(({role,content})=>({role,content}))
  const prompt=first?snapshot.prompt:followup
  const requestMessages=prompt.trim()?[...history,{role:'user',content:prompt}]:history
  let estimate=0,budgetError=''
  try{estimate=assertSessionBudget(snapshot.system,requestMessages,snapshot.inputBudget,snapshot.outputBudget)}catch(e){budgetError=e instanceof Error?e.message:'Invalid context budget.'}
  const canRetry=retry&&!!(chat.messages[chat.messages.length-1]?.error||chat.messages[chat.messages.length-1]?.stopped)
  async function send(){
    if(!snapshot||!consent||controller.current||budgetError||(!first&&!followup.trim()&&!canRetry))return
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');let assistantId='',accounted=false
    const scoped=()=>activeNamespace()===namespace&&!boardWritesFrozen()&&!!useStore.getState().chats.find(value=>value.id===chatId)
    try{
      if(!scoped())throw new Error('Workspace changed or was wiped. Reload before sending.')
      const settings=useStore.getState().settings,meta=providerById(snapshot.providerId),configuration=settings.providers[snapshot.providerId]
      if(!meta||meta.kind==='decision'||!(settings.addedProviders??[]).includes(snapshot.providerId)||!settings.providerModels[snapshot.providerId]?.includes(snapshot.model))throw new Error('The explicitly selected model is no longer configured. No substitute was used. Create a new snapshot after configuring it.')
      if((configuration?.baseUrl||meta.baseUrl).replace(/\/$/,'')!==snapshot.endpoint)throw new Error('The configured provider endpoint changed after review. Create a new snapshot; no request was sent.')
      for(const text of [snapshot.system,...requestMessages.map(message=>message.content)])if(shieldOutbound(text).text!==text)throw new Error('Privacy Shield would redact this request. Sending is blocked rather than silently changing the reviewed context. Remove sensitive content and prepare a new snapshot.')
      assertBudget();const apiKey=await usableKey(configuration?.apiKey)
      if(meta.needsKey&&!apiKey)throw new Error('The selected provider has no usable key. No fallback was used.')
      if(abort.signal.aborted||!scoped())throw new Error('Request cancelled before sending.')
      if(prompt.trim())useStore.getState().addMessage(chatId,{id:crypto.randomUUID(),role:'user',content:prompt,createdAt:Date.now()})
      assistantId=crypto.randomUUID();useStore.getState().addMessage(chatId,{id:assistantId,role:'assistant',content:'',createdAt:Date.now(),provider:meta.name,model:snapshot.model})
      setFollowup('');setConsent(false)
      const result=await streamToCallback({providerId:snapshot.providerId,model:snapshot.model,apiKey,baseUrl:snapshot.endpoint,system:snapshot.system,exactSystem:true,proxyOllama:true,messages:requestMessages,maxTokens:snapshot.outputBudget,temperature:0.3,timeoutMs:(settings.providerTimeouts?.[snapshot.providerId]??45)*1000,signal:abort.signal},chunk=>{if(scoped())useStore.getState().appendToken(chatId,assistantId,chunk)})
      if(scoped()){recordTokens(result.usage.total);accounted=true;useStore.getState().updateMessage(chatId,assistantId,{usage:result.usage,...(result.toolCalls.length?{error:'The provider requested tools, but tools are disabled for this session. No tool was executed.'}:{})})}
    }catch(e){
      if(scoped()){const usage=usageOfError(e);if(usage&&!accounted)recordTokens(usage.total);const message=abort.signal.aborted?'Stopped. Partial response retained; provider charges may still apply.':e instanceof Error?e.message:'Provider request failed.';setError(message);if(assistantId)useStore.getState().updateMessage(chatId,assistantId,{error:message,stopped:abort.signal.aborted,usage})}
    }finally{if(controller.current===abort)controller.current=undefined;setBusy(false)}
  }
  return <section className="re-board-session-view" aria-label="Board snapshot session"><header><h1>{chat.title}</h1><p>Pinned model: {providerById(snapshot.providerId)?.name??snapshot.providerId} · {snapshot.model}</p><p>Endpoint: {snapshot.endpoint}</p><p>Independent {snapshot.draft?'draft':'saved'} Board snapshot · revision {snapshot.revision}. Later Board edits/deletion do not update or erase this copied text.</p><p>Snapshot created {snapshot.createdAt}. Stored with this browser profile’s chats; browser data clearing can remove it. Board backups do not include these separate sessions.</p><Link to={`/board/${snapshot.boardId}`}>Open source Board</Link></header>
    <p>No automatic routing, demo, web search, tools, memory injection, image vision or history compression. Failed/stopped assistant responses are retained locally but excluded from future requests. Provider fees and data policies apply.</p>
    <div className="re-board-session-transcript">{chat.messages.map(message=><article key={message.id} aria-label={`${message.role} message`}><strong>{message.role==='user'?'You':'Assistant'}</strong>{message.role==='user'?<details><summary>Request text</summary><pre>{message.content}</pre></details>:<BoardMarkdown text={message.content}/>} {message.error&&<p role="alert">{message.error}</p>}{message.usage&&<p>{message.usage.reported?'Provider-reported':'Estimated'} usage: {message.usage.total.toLocaleString()} tokens.</p>}</article>)}</div>
    {!first&&<label>Follow-up<textarea className="bui-field" aria-label="Snapshot session follow-up" disabled={busy} rows={3} value={followup} onChange={event=>{setFollowup(event.target.value);setError('')}}/></label>}
    <p>{snapshot.includedIds.length} snapshot items / {snapshot.excludedIds.length} excluded · estimated input {estimate.toLocaleString()} / {snapshot.inputBudget.toLocaleString()} tokens · maximum output {snapshot.outputBudget.toLocaleString()}. Estimates use characters ÷ 4, not the provider tokenizer; actual model limits may differ. Full context is sent or blocked, never shortened.</p>
    <details><summary>Review exact next request</summary><pre>{JSON.stringify({provider:snapshot.providerId,endpoint:snapshot.endpoint,model:snapshot.model,system:snapshot.system,messages:requestMessages,maxTokens:snapshot.outputBudget,temperature:0.3},null,2)}</pre></details>
    <label className="re-board-send-consent"><input type="checkbox" disabled={busy} checked={consent} onChange={event=>setConsent(event.target.checked)}/> I confirm this context and model may be sent to the configured provider endpoint, and charges may apply.</label>
    {budgetError&&<p role="alert">{budgetError}</p>}{error&&<p role="alert">{error}</p>}
    <div>{busy?<button className="bui-button" onClick={()=>controller.current?.abort()}>Stop snapshot request</button>:<button className="bui-button" disabled={!consent||!!budgetError||(!first&&!followup.trim()&&!canRetry)} onClick={()=>void send()}>{first?'Send confirmed snapshot':canRetry?'Retry reviewed request':'Send reviewed follow-up'}</button>}</div>
  </section>
}
