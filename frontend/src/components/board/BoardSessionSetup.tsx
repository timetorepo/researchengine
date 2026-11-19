import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/stores/useStore'
import { providerById } from '@/lib/providers/registry'
import { activeNamespace } from '@/lib/security/lock'
import { boardWritesFrozen, type BoardDocument, type openBoardStore } from '@/lib/board/storage'
import { approximateTokens, prepareBoardSnapshot, type BoardSnapshot } from '@/lib/board/session'

export function BoardSessionSetup({board,dirty,disabled,store,namespace}:{board:BoardDocument;dirty:boolean;disabled:boolean;store:Awaited<ReturnType<typeof openBoardStore>>;namespace:string}) {
  const settings=useStore(state=>state.settings),navigate=useNavigate()
  const [model,setModel]=useState(''),[intent,setIntent]=useState('Summary'),[task,setTask]=useState(''),[excluded,setExcluded]=useState<string[]>([]),[pdfText,setPdfText]=useState(true),[input,setInput]=useState(8000),[output,setOutput]=useState(1500),[prepared,setPrepared]=useState<BoardSnapshot>(),[consent,setConsent]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const controller=useRef<AbortController|undefined>(undefined)
  const models=(settings.addedProviders??[]).flatMap(id=>{const provider=providerById(id);return provider&&provider.kind!=='decision'&&(!provider.needsKey||settings.providers[id]?.apiKey)?(settings.providerModels[id]??[]).filter(name=>!(settings.hiddenModels??[]).includes(`${id}:${name}`)).map(name=>({value:JSON.stringify([id,name]),label:`${provider.name} · ${name}`})):[]})
  useEffect(()=>{controller.current?.abort();setPrepared(undefined);setConsent(false)},[board,model,intent,task,excluded,pdfText,input,output,disabled])
  useEffect(()=>()=>controller.current?.abort(),[])
  async function prepare(){
    if(disabled||busy||!models.some(value=>value.value===model))return
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setPrepared(undefined)
    try{const [providerId,chosen]=JSON.parse(model);const snapshot=await prepareBoardSnapshot({board,draft:dirty,ids:board.items.filter(item=>!excluded.includes(item.id)).map(item=>item.id),providerId,endpoint:settings.providers[providerId]?.baseUrl||providerById(providerId)!.baseUrl,model:chosen,intent,task,inputBudget:input,outputBudget:output,pdfText,load:id=>store.attachment(board.id,id),signal:abort.signal});if(!abort.signal.aborted)setPrepared(snapshot)}catch(e){setError(e instanceof Error?e.message:'Snapshot preparation failed.')}finally{if(controller.current===abort)controller.current=undefined;setBusy(false)}
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
      <label>Output intent<select className="bui-field" aria-label="Board output intent" value={intent} onChange={event=>setIntent(event.target.value)}>{['Summary','Research brief','Outline','Compare evidence','Action plan'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Task<textarea className="bui-field" aria-label="Board session task" rows={3} value={task} onChange={event=>setTask(event.target.value)}/></label>
      <div className="re-board-position"><label>Input budget (estimated tokens)<input className="bui-field" aria-label="Snapshot input budget" type="number" min={1} value={input} onChange={event=>setInput(event.target.value===''?0:event.target.valueAsNumber)}/></label><label>Maximum output tokens<input className="bui-field" aria-label="Snapshot output budget" type="number" min={1} value={output} onChange={event=>setOutput(event.target.value===''?0:event.target.valueAsNumber)}/></label></div>
      <p>Estimate uses characters ÷ 4, not a model tokenizer. Input and output must fit your model’s actual context window; provider limits are not verified. Oversized input is blocked, never shortened.</p>
      <label><input type="checkbox" checked={pdfText} onChange={event=>setPdfText(event.target.checked)}/> Include selectable text from linked PDF pages (no OCR)</label>
      <fieldset className="re-board-session-items"><legend>Included items — uncheck to exclude</legend>{board.items.map((item,index)=><label key={item.id}><input type="checkbox" checked={!excluded.includes(item.id)} onChange={event=>setExcluded(value=>event.target.checked?value.filter(id=>id!==item.id):[...value,item.id])}/>{item.kind} · {item.text.split('\n')[0]||`Untitled ${index+1}`}</label>)}</fieldset>
      <button className="bui-button" disabled={!model||!task.trim()||!board.items.length} onClick={()=>void prepare()}>Prepare exact snapshot</button>
    </fieldset>
    {busy&&<p role="status">Preparing selected sources… <button className="bui-button" onClick={()=>controller.current?.abort()}>Cancel snapshot preparation</button></p>}
    {error&&<p role="alert">{error}</p>}
    {prepared&&<div><p role="status">Model: {prepared.providerId} · {prepared.model} · endpoint {prepared.endpoint}. Ready: {prepared.includedIds.length} included / {prepared.excludedIds.length} excluded · approximately {approximateTokens(prepared.system+prepared.prompt).toLocaleString()} input tokens · {prepared.draft?'unsaved draft':'saved revision'} {prepared.revision}.</p><details><summary>Review exact system instructions and snapshot text</summary><pre>{prepared.system+'\n\n'+prepared.prompt}</pre></details><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I reviewed the included/excluded context and chosen model. Create an independent local session; sending will require a separate confirmation.</label><button className="bui-button" disabled={!consent||disabled} onClick={create}>Create snapshot session</button></div>}
  </details>
}
