import type { BoardSummaryAudit } from '@/lib/board/summary'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { streamToCallback, usageOfError } from '@/lib/providers/stream'
import { assertBudget, recordTokens } from '@/lib/usage/guard'
import { reviewedOutboundWouldChange } from '@/lib/privacy/shield'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen } from '@/lib/board/storage'
import { agentStageInput, executeMultiAgent, validateMultiAgent, checkedAgentUsage, AgentStageError, type AgentModel, type MultiAgentConfig, type AgentStage, type AgentEvidence } from '@/lib/agents/multiAgent'
import { Trace, TraceLine, TraceTitle, TraceDescription } from '@/components/ui/sortui/trace'
import { BoardMarkdown } from '@/components/board/BoardMarkdown'
import '@/components/board/board.css'
import './multi-agent.css'

export function MultiAgentSetup({seed='',onCancel,boardSources,evidenceNamespace,boardSummary}:{seed?:string;onCancel?:()=>void;boardSources?:AgentEvidence['sources'];evidenceNamespace?:string;boardSummary?:BoardSummaryAudit}) {
  const settings=useStore(state=>state.settings),navigate=useNavigate(),[namespace]=useState(activeNamespace)
  const [task,setTask]=useState(seed),[leader,setLeader]=useState(''),[specialist,setSpecialist]=useState(''),[reviewer,setReviewer]=useState(''),[jobs,setJobs]=useState(['Assess the evidence and identify unsupported claims.','Develop an alternative interpretation and identify risks.']),[maxCalls,setMaxCalls]=useState(5),[concurrency,setConcurrency]=useState(2),[budget,setBudget]=useState(30000),[input,setInput]=useState(8000),[output,setOutput]=useState(1000),[consent,setConsent]=useState(false),[error,setError]=useState('')
  const [sourceAssignments,setSourceAssignments]=useState<string[][]>(()=>[boardSources?.map(source=>source.id)??[],[]])
  const options=(settings.addedProviders??[]).flatMap(id=>{const meta=providerById(id);return meta&&meta.kind!=='decision'&&(!meta.needsKey||settings.providers[id]?.apiKey)?(settings.providerModels[id]??[]).filter(model=>!(settings.hiddenModels??[]).includes(`${id}:${model}`)).map(model=>({value:JSON.stringify([id,model]),label:`${meta.name} · ${model}`})):[]})
  const resolve=(value:string):AgentModel=>{if(!options.some(option=>option.value===value))throw new Error('Explicitly choose configured models for every role.');const [providerId,model]=JSON.parse(value);return {providerId,model,endpoint:(settings.providers[providerId]?.baseUrl||providerById(providerId)!.baseUrl).replace(/\/$/,'')}}
  useEffect(()=>setConsent(false),[task,leader,specialist,reviewer,jobs,maxCalls,concurrency,budget,input,output,sourceAssignments,boardSources,boardSummary])
  function create(){try{
    if(boardSources&&evidenceNamespace!==namespace)throw new Error('Board evidence belongs to a different workspace. Reload and prepare it again.')
    if(!consent||activeNamespace()!==namespace||boardWritesFrozen())throw new Error('Confirm the plan in an active workspace first.')
    const config:MultiAgentConfig={leader:resolve(leader),specialist:resolve(specialist),reviewer:resolve(reviewer),specialistJobs:[...jobs],...(boardSources?{evidence:{...(boardSummary?{summaryAudit:structuredClone(boardSummary)}:{}),sources:structuredClone(boardSources),specialistSourceIds:sourceAssignments.slice(0,jobs.length).map(ids=>[...ids])}}:{}),maxCalls,concurrency,tokenBudget:budget,inputBudget:input,outputBudget:output};validateMultiAgent(config,task)
    const id=crypto.randomUUID(),now=Date.now();useStore.getState().set(state=>({chats:[{id,title:`MultiAgent · ${task.slice(0,60)}`,kind:'research',createdAt:now,updatedAt:now,messages:[{id:crypto.randomUUID(),role:'user',content:task,createdAt:now}],multiAgent:{version:1,config,prompt:task,stages:[],status:'ready'}},...state.chats],activeChatId:id}));navigate(`/chat/${id}`)
  }catch(e){setError(e instanceof Error?e.message:'Could not create run.')}}
  return <section className="re-multi-setup" aria-label="MultiAgent setup"><h1>MultiAgent</h1><p>A fixed, bounded workflow: leader plan → one or two specialist work products → reviewer disagreements → leader final answer. No recursion, tools, search, file/Board writes or automatic patches. This does not change native model effort settings.</p>
    <label>Task<textarea className="bui-field" aria-label="MultiAgent task" rows={4} value={task} onChange={event=>setTask(event.target.value)}/></label>
    <div className="re-multi-models">{([{label:'Leader',value:leader,set:setLeader},{label:'Specialist',value:specialist,set:setSpecialist},{label:'Reviewer',value:reviewer,set:setReviewer}]).map(role=><label key={role.label}>{role.label} model<select className="bui-field" aria-label={`${role.label} model`} value={role.value} onChange={event=>role.set(event.target.value)}><option value="">Choose explicitly…</option>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>
    {!options.length&&<p>Configure providers and fetch their models in Settings. No demo, default model or automatic substitution is used.</p>}
    <div className="re-multi-jobs">{jobs.map((job,index)=><label key={index}>Specialist {index+1} brief<textarea className="bui-field" aria-label={`Specialist ${index+1} brief`} rows={2} value={job} onChange={event=>setJobs(value=>value.map((old,i)=>i===index?event.target.value:old))}/></label>)}</div>
    {boardSources&&<fieldset className="re-multi-evidence"><legend>Board evidence per specialist</legend><p>Only assigned evidence goes to each specialist. The leader plan gets the task only; the reviewer and final leader get public work products, not the original Board. No images, files or geometry are sent. {boardSummary?'These are lossy AI briefs reviewed by the user, not original source text.':'These are selected original texts, not an AI summary.'}</p>{jobs.map((_,index)=><fieldset key={index}><legend>Specialist {index+1} sources ({sourceAssignments[index]?.length??0})</legend><p>Task + assigned evidence: approximately {Math.ceil(agentStageInput(task,[],{sources:boardSources,specialistSourceIds:sourceAssignments},index).length/4).toLocaleString()} input tokens before system instructions and the future leader plan. Characters ÷ 4, not exact billing.</p>{boardSources.map(source=><label key={source.id}><input type="checkbox" checked={sourceAssignments[index]?.includes(source.id)??false} onChange={event=>setSourceAssignments(value=>value.map((ids,i)=>i!==index?ids:event.target.checked?[...new Set([...ids,source.id])]:ids.filter(id=>id!==source.id)))}/>{source.label}</label>)}</fieldset>)}<details><summary>Review exact available Board evidence</summary>{boardSources.map(source=><div key={source.id}><strong>{source.label}</strong><pre>{source.content}</pre></div>)}</details></fieldset>}
    {boardSummary&&<details><summary>Local summary generation and original evidence audit (not sent to agents)</summary><pre>{JSON.stringify(boardSummary,null,2)}</pre></details>}
    <button className="bui-button" onClick={()=>setJobs(value=>value.length===2?[value[0]]:[...value,'Check alternative interpretations and risks.'])}>{jobs.length===2?'Use one specialist':'Add second specialist'}</button>
    <div className="re-multi-budgets">{[{label:'Maximum calls',value:maxCalls,set:setMaxCalls,max:5},{label:'Concurrency',value:concurrency,set:setConcurrency,max:2},{label:'Run token budget',value:budget,set:setBudget},{label:'Per-call input budget',value:input,set:setInput},{label:'Per-call output maximum',value:output,set:setOutput}].map(field=><label key={field.label}>{field.label}<input className="bui-field" aria-label={field.label} type="number" min={1} max={field.max} value={field.value} onChange={event=>field.set(event.target.value===''?0:event.target.valueAsNumber)}/></label>)}</div>
    <p>{jobs.length+3} planned calls, at most {maxCalls}; at most {concurrency} simultaneous calls. Input estimates use characters ÷ 4; the run budget reserves estimated input plus requested maximum output before each call. Reported usage can differ, so this is not a guaranteed monetary or exact-token cap. No context/output is silently clipped; a stage that cannot fit is blocked.</p>
    <p>Only the task and recorded public deliverables are shared between these providers. No original chat history, attachments, Board snapshot or memories are copied automatically. When Board evidence is explicitly provided above, only the reviewed per-specialist assignments are sent to specialists. Review any copied text here. Role outputs and usage are saved with the new chat; older Council chats/settings are retained.</p>
    <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I reviewed the task, role models and budgets. Create a separate local run; execution requires another confirmation.</label>
    {error&&<p role="alert">{error}</p>}<div className="re-multi-actions"><button className="bui-button" disabled={!consent} onClick={create}>Create MultiAgent run</button>{onCancel&&<button className="bui-button" onClick={onCancel}>Close MultiAgent setup</button>}</div>
  </section>
}

export function MultiAgentRunView({chatId}:{chatId:string}) {
  const chat=useStore(state=>state.chats.find(value=>value.id===chatId)),run=chat?.multiAgent
  const [namespace]=useState(activeNamespace),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),controller=useRef<AbortController|undefined>(undefined)
  useEffect(()=>()=>controller.current?.abort(),[])
  const scoped=()=>activeNamespace()===namespace&&!boardWritesFrozen()&&!!useStore.getState().chats.find(value=>value.id===chatId)
  function update(patch:Partial<NonNullable<typeof run>>){if(scoped())useStore.getState().set(state=>({chats:state.chats.map(value=>value.id===chatId&&value.multiAgent?{...value,multiAgent:{...value.multiAgent,...patch},updatedAt:Date.now()}:value)}))}
  async function execute(){
    if(!run||run.status!=='ready'||!consent||controller.current||!scoped())return
    const abort=new AbortController();controller.current=abort;setBusy(true);setConsent(false);update({status:'running'})
    try{
      const stages=await executeMultiAgent(run.config,run.prompt,async(stage,maxTokens,signal)=>{
        let text='';try{
          if(!scoped()||signal.aborted)throw new Error('Run cancelled or workspace changed.')
          const settings=useStore.getState().settings,model=stage.model,meta=providerById(model.providerId),config=settings.providers[model.providerId]
          if(!meta||meta.kind==='decision'||!(settings.addedProviders??[]).includes(model.providerId)||!settings.providerModels[model.providerId]?.includes(model.model)||(config?.baseUrl||meta.baseUrl).replace(/\/$/,'')!==model.endpoint)throw new Error('A chosen model/endpoint is unavailable or changed. No substitute was used.')
          for(const value of [stage.system,stage.input])if(reviewedOutboundWouldChange(value))throw new Error('Privacy Shield would change this stage. Run blocked instead of silently redacting task or deliverables.')
          assertBudget();const apiKey=await usableKey(config?.apiKey);if(meta.needsKey&&!apiKey)throw new Error('Chosen provider key is unavailable.')
          if(signal.aborted||!scoped())throw new Error('Run cancelled before sending.')
          const result=await streamToCallback({providerId:model.providerId,model:model.model,apiKey,baseUrl:model.endpoint,system:stage.system,exactSystem:true,proxyOllama:true,messages:[{role:'user',content:stage.input}],temperature:0.3,maxTokens,signal,timeoutMs:(settings.providerTimeouts?.[model.providerId]??45)*1000},chunk=>{text+=chunk})
          checkedAgentUsage(result.usage);if(scoped())recordTokens(result.usage.total)
          if(result.toolCalls.length)throw new AgentStageError('Model requested tools; tools are disabled and none were executed.',text,result.usage)
          return {text,usage:result.usage}
        }catch(e){let usage=e instanceof AgentStageError?e.usage:usageOfError(e);try{if(usage)checkedAgentUsage(usage)}catch{usage=undefined;e=new Error('Invalid provider usage; remaining stages were stopped.')}if(scoped()&&usage&&!(e instanceof AgentStageError))recordTokens(usage.total);throw new AgentStageError(e instanceof Error?e.message:'Provider stage failed.',text,usage)}
      },stages=>update({stages}),abort.signal)
      if(scoped()){update({stages,status:'completed'});useStore.getState().addMessage(chatId,{id:crypto.randomUUID(),role:'assistant',content:stages[stages.length-1].text,createdAt:Date.now(),model:run.config.leader.model,provider:providerById(run.config.leader.providerId)?.name})}
    }catch(e){update({status:abort.signal.aborted?'cancelled':'failed',error:abort.signal.aborted?'Stopped. Completed/partial work is retained; charges may still apply.':e instanceof Error?e.message:'MultiAgent failed.'})}
    finally{controller.current=undefined;setBusy(false)}
  }
  if(!run||!chat)return <p>MultiAgent run unavailable.</p>
  const total=run.stages.reduce((sum,stage)=>sum+(stage.usage?.total??0),0)
  return <section className="re-multi-run" aria-label="MultiAgent run"><h1>{chat.title}</h1><p>State: {run.status==='running'&&!busy?'interrupted (not resumed automatically)':run.status} · {run.stages.filter(stage=>stage.startedAt!==undefined).length}/{run.config.maxCalls} stage attempts · recorded usage {total.toLocaleString()} tokens ({run.stages.some(stage=>stage.usage&&!stage.usage.reported)?'includes estimates':'reported counts where available'}).</p>
    <p>Attempts without usage: {run.stages.filter(stage=>stage.startedAt!==undefined&&!stage.usage).length}. Totals may be incomplete; a preflight failure is not necessarily a billable request.</p><p>No tools or patches. Provider-native effort stays separate; no private chain-of-thought is requested or displayed. Full recorded work products, not hidden reasoning, are shown below. Failed work never becomes a fabricated final answer.</p>
    <details><summary>Review fixed task and run configuration</summary><pre>{JSON.stringify({task:run.prompt,...run.config},null,2)}</pre></details>
    <Trace>{run.stages.map(stage=><StageResult key={stage.id} stage={stage}/>)}</Trace>
    {run.error&&<p role="alert">{run.error}</p>}
    {run.config.evidence?.summaryAudit&&<div><p>Assigned evidence uses reviewed, lossy AI briefs. Additional summary-generation usage: {run.config.evidence.summaryAudit.usage.total.toLocaleString()} tokens ({run.config.evidence.summaryAudit.usage.reported?'reported':'estimated'}). Not included in the stage usage above.</p><details><summary>Local summary audit (not sent to agents)</summary><pre>{JSON.stringify(run.config.evidence.summaryAudit,null,2)}</pre></details></div>}
    {run.status==='ready'&&<><p>The selected providers may receive the task and other roles’ public work products. {run.config.specialistJobs.length+3} stages are planned. Charges may apply; no automatic retry or fallback. Budget exhaustion stops the remaining workflow.</p><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I confirm this bounded run and cross-role context sharing.</label><button className="bui-button" disabled={!consent||busy} onClick={()=>void execute()}>Execute confirmed MultiAgent run</button></>}
    {busy&&<button className="bui-button" onClick={()=>controller.current?.abort()}>Stop all agents</button>}
    <div className="re-multi-actions"><Link to="/multi-agent">Configure another run</Link><Link to="/chats">All chats</Link></div>
  </section>
}
function StageResult({stage}:{stage:AgentStage}) {
  return <div className="re-multi-stage" data-agent-stage={stage.id} data-status={stage.status}><TraceLine status={stage.status==='running'?'running':stage.status==='failed'||stage.status==='blocked'?'error':stage.status==='queued'?'pending':undefined}><TraceTitle>{stage.label}</TraceTitle><TraceDescription>{stage.status}{stage.startedAt!==undefined&&stage.endedAt!==undefined?` · ${((stage.endedAt-stage.startedAt)/1000).toFixed(1)}s`:''}</TraceDescription></TraceLine><p>{stage.model.providerId} · {stage.model.model}</p>{stage.error&&<p role="alert">{stage.error}</p>}{stage.usage&&<p>{stage.usage.reported?'Provider-reported':'Estimated'} usage: {stage.usage.total} tokens</p>}<details><summary>Public result and exact stage request</summary><BoardMarkdown text={stage.text}/><pre>{stage.system+'\n\n'+stage.input}</pre></details></div>
}
