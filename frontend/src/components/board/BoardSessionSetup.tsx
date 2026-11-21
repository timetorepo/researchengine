import { BoardOverlay } from '@/components/ui/boardui/Overlay'
import { lazy, Suspense } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { providerById } from '@/lib/providers/registry'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen, type BoardDocument, type openBoardStore } from '@/lib/board/storage'
import { approximateTokens, prepareBoardSnapshot, type BoardSnapshot } from '@/lib/board/session'

const BoardSummarySetup=lazy(()=>import('./BoardSummarySetup'))

const MultiAgentSetup=lazy(()=>import('@/components/chat/MultiAgentWorkspace').then(module=>({default:module.MultiAgentSetup})))

export function BoardSessionSetup({board,dirty,disabled,store,namespace,selected}:{board:BoardDocument;dirty:boolean;disabled:boolean;store:Awaited<ReturnType<typeof openBoardStore>>;namespace:string;selected?:string}) {
  const settings=useStore(state=>state.settings),navigate=useNavigate()
  const [agents,setAgents]=useState(false),[summaryOpen,setSummaryOpen]=useState(false),[original,setOriginal]=useState<BoardSnapshot>()
  const [included,setIncluded]=useState<string[]>(selected?[selected]:[]),[contextMode,setContextMode]=useState<'compact'|'full'>('compact')
  const [model,setModel]=useState(''),[intent,setIntent]=useState('Summary'),[task,setTask]=useState(''),[pdfText,setPdfText]=useState(true),[input,setInput]=useState(8000),[output,setOutput]=useState(1500),[prepared,setPrepared]=useState<BoardSnapshot>(),[consent,setConsent]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const controller=useRef<AbortController|undefined>(undefined)
  const models=(settings.addedProviders??[]).flatMap(id=>{const provider=providerById(id);return provider&&provider.kind!=='decision'&&(!provider.needsKey||settings.providers[id]?.apiKey)?(settings.providerModels[id]??[]).filter(name=>!(settings.hiddenModels??[]).includes(`${id}:${name}`)).map(name=>({value:JSON.stringify([id,name]),label:`${provider.name} · ${name}`})):[]})
  useEffect(()=>{setIncluded(selected?[selected]:[])},[selected])
  useEffect(()=>{controller.current?.abort();setPrepared(undefined);setConsent(false);setAgents(false);setSummaryOpen(false);setOriginal(undefined)},[board,model,intent,task,included,contextMode,pdfText,input,output,disabled])
  useEffect(()=>()=>controller.current?.abort(),[])
  async function prepare(){
    if(disabled||busy||!models.some(value=>value.value===model))return
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setPrepared(undefined);setOriginal(undefined)
    try{const [providerId,chosen]=JSON.parse(model);const snapshot=await prepareBoardSnapshot({board,draft:dirty,ids:included.filter(id=>board.items.some(item=>item.id===id)),contextMode,providerId,endpoint:settings.providers[providerId]?.baseUrl||providerById(providerId)!.baseUrl,model:chosen,intent,task,inputBudget:input,outputBudget:output,pdfText,load:id=>store.attachment(board.id,id),signal:abort.signal});if(!abort.signal.aborted)setPrepared(snapshot)}catch(e){setError(e instanceof Error?e.message:'Snapshot preparation failed.')}finally{if(controller.current===abort)controller.current=undefined;setBusy(false)}
  }
  function openSummary(){
    if(!prepared||!consent||disabled||busy||prepared.summary)return
    if(boardWritesFrozen()||activeNamespace()!==namespace){setError('Workspace changed or was wiped. Reload before summarizing.');return}
    setSummaryOpen(true)
  }
  function configureAgents(){
    if(!prepared||!consent||disabled||busy)return
    if(boardWritesFrozen()||activeNamespace()!==namespace){setError('Workspace changed or was wiped. Reload before configuring agents.');return}
    setAgents(true)
  }
  function create(){
    if(!prepared||!consent||disabled||busy)return
    if(boardWritesFrozen()||activeNamespace()!==namespace){setError('Workspace changed or was wiped. Reload before creating a session.');return}
    if(!models.some(value=>value.value===model)){setError('The chosen model is no longer configured. Choose it again.');return}
    const chatId=crypto.randomUUID(),now=Date.now()
    useStore.getState().set(state=>({chats:[{id:chatId,title:`Board · ${prepared.boardTitle}`,createdAt:now,updatedAt:now,kind:'research',messages:[],boardSnapshot:structuredClone(prepared)},...state.chats],activeChatId:chatId}))
    navigate(`/chat/${chatId}`)
  }
  return <details id="board-session-setup" className="re-board-session-setup"><summary>Start a session from this Board</summary><p>Create an independent text snapshot, not a live link. Choose a model first; no AI request is made while preparing or creating the session. Image pixels, original files and visual drawing interpretation are excluded. PDF text is optional and limited to linked pages.</p>
    <fieldset disabled={disabled||busy}><label>Model (required)<select className="bui-field" aria-label="Board session model" value={model} onChange={event=>setModel(event.target.value)}><option value="">Choose explicitly…</option>{models.map(value=><option key={value.value} value={value.value}>{value.label}</option>)}</select></label>{!models.length&&<p>Configure a provider and fetch its models in Settings first. No demo or automatic model fallback.</p>}
      <label>Context format<select className="bui-field" aria-label="Board context format" value={contextMode} onChange={event=>setContextMode(event.target.value as 'compact'|'full')}><option value="compact">Compact evidence (recommended for agents)</option><option value="full">Full item metadata and geometry</option></select></label>
      <p>Compact preserves selected text and source/page references, stores exact duplicate text once, and omits layout coordinates and drawing points. This is not an AI summary and makes no provider call.</p>
      <label>Output intent<select className="bui-field" aria-label="Board output intent" value={intent} onChange={event=>setIntent(event.target.value)}>{['Summary','Research brief','Outline','Compare evidence','Action plan'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Task<textarea className="bui-field" aria-label="Board session task" rows={3} value={task} onChange={event=>setTask(event.target.value)}/></label>
      <div className="re-board-position"><label>Input budget (estimated tokens)<input className="bui-field" aria-label="Snapshot input budget" type="number" min={1} value={input} onChange={event=>setInput(event.target.value===''?0:event.target.valueAsNumber)}/></label><label>Maximum output tokens<input className="bui-field" aria-label="Snapshot output budget" type="number" min={1} value={output} onChange={event=>setOutput(event.target.value===''?0:event.target.valueAsNumber)}/></label></div>
      <p>Estimate uses characters ÷ 4, not a model tokenizer. Input and output must fit your model’s actual context window; provider limits are not verified. Oversized input is blocked, never shortened.</p>
      <label><input type="checkbox" checked={pdfText} onChange={event=>setPdfText(event.target.checked)}/> Include selectable text from linked PDF pages (no OCR)</label>
      <div className="re-board-context-actions"><button className="bui-button" disabled={!selected} onClick={()=>setIncluded(selected?[selected]:[])}>Use selected item only</button><button className="bui-button" onClick={()=>setIncluded(board.items.map(item=>item.id))}>Include whole Board</button><button className="bui-button" onClick={()=>setIncluded([])}>Clear selection</button></div>
      <p>{included.filter(id=>board.items.some(item=>item.id===id)).length} of {board.items.length} items selected. Default: the selected item only, not its frame members or the entire Board. Add relevant evidence below.</p>
      <fieldset className="re-board-session-items"><legend>Included items — uncheck to exclude</legend>{board.items.map((item,index)=><label key={item.id}><input type="checkbox" checked={included.includes(item.id)} onChange={event=>setIncluded(value=>event.target.checked?[...new Set([...value,item.id])]:value.filter(id=>id!==item.id))}/>{item.kind} · {item.text.split('\n')[0]||`Untitled ${index+1}`}</label>)}</fieldset>
      <button className="bui-button" disabled={!model||!task.trim()||!included.some(id=>board.items.some(item=>item.id===id))} onClick={()=>void prepare()}>Prepare exact snapshot</button>
    </fieldset>
    {busy&&<p role="status">Preparing selected sources… <button className="bui-button" onClick={()=>controller.current?.abort()}>Cancel snapshot preparation</button></p>}
    {error&&<p role="alert">{error}</p>}
    {prepared&&<div><p role="status">Model: {prepared.providerId} · {prepared.model} · endpoint {prepared.endpoint}. Ready: {prepared.includedIds.length} included / {prepared.excludedIds.length} excluded · approximately {approximateTokens(prepared.system+prepared.prompt).toLocaleString()} input tokens · {prepared.draft?'unsaved draft':'saved revision'} {prepared.revision}.</p><p>{prepared.contextMode==='summary'?'Reviewed AI summary':prepared.contextMode==='compact'?'Compact evidence':'Full item metadata'} · estimated selected-context input: {prepared.preparedInputEstimate?.toLocaleString()} tokens versus {prepared.fullInputEstimate?.toLocaleString()} with full metadata. Estimates include the task/system, not output or future follow-ups. No guaranteed billing reduction.</p>{prepared.summary&&<p>Using lossy, user-reviewed AI briefs, not original text. Summary generation {prepared.summary.usage.reported?'reported':'estimated'} usage: {prepared.summary.usage.total.toLocaleString()} tokens; this cost is additional to later requests.</p>}{original&&<button className="bui-button" disabled={disabled} onClick={()=>{setPrepared(original);setOriginal(undefined);setConsent(false);setAgents(false)}}>Restore original evidence context</button>}<details><summary>Review exact system instructions and snapshot text</summary><pre>{prepared.system+'\n\n'+prepared.prompt}</pre></details><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I reviewed the included/excluded context and chosen model. Create an independent local session; sending will require a separate confirmation.</label><button className="bui-button" disabled={!consent||disabled} onClick={create}>Create snapshot session</button>{!prepared.summary&&<button className="bui-button" disabled={!consent||disabled||!prepared.agentSources?.length} onClick={openSummary}>Prepare optional AI summary</button>}{summaryOpen&&<BoardOverlay open onClose={()=>setSummaryOpen(false)} title="Board summary preparation"><Suspense fallback={<p role="status">Loading summary preparation…</p>}><BoardSummarySetup source={prepared} namespace={namespace} onAccept={snapshot=>{setOriginal(prepared);setPrepared(snapshot);setConsent(false);setSummaryOpen(false);setAgents(false)}}/></Suspense></BoardOverlay>}<button className="bui-button" disabled={!consent||disabled||!prepared.agentSources?.length} onClick={configureAgents}>Configure agents with this evidence</button>{agents&&prepared.agentSources&&<BoardOverlay open onClose={()=>setAgents(false)} title="Board agent setup"><Suspense fallback={<p role="status">Loading agent setup…</p>}><MultiAgentSetup seed={task} boardSources={prepared.agentSources} boardSummary={prepared.summary} evidenceNamespace={namespace} onCancel={()=>setAgents(false)}/></Suspense></BoardOverlay>}</div>}
  </details>
}
