import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
await mkdir('.cache/board-summary',{recursive:true})
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[]
 let mode='ok',release,heldStarted
 p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');if(!localStorage.getItem('summary-seed')){localStorage.setItem('summary-seed','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,theme:'dark',updates:{autoCheck:false},addedProviders:['ollama'],providerModels:{ollama:['summary:test']},providers:{ollama:{baseUrl:'http://127.0.0.1:11434'}}}},version:0}))}})
 await p.route('**/api/**',async r=>{
  if(new URL(r.request().url()).pathname!=='/api/chat'){await r.fulfill({json:{}});return}
  const body=r.request().postDataJSON();requests.push(body)
  if(mode==='hold')await new Promise(resolve=>{release=resolve;heldStarted?.()})
  if(mode==='http'){await r.fulfill({status:429,json:{error:'Mock summary refusal'}});return}
  const isSummary=body.system.startsWith('Create a concise, lossy evidence brief')
  const ids=isSummary?JSON.parse(body.messages[0].content).sources.map(s=>s.id):[]
  const text=!isSummary?'Analysis of reviewed briefs.':mode==='malformed'?'incomplete JSON':JSON.stringify({summaries:ids.filter((_,i)=>mode!=='missing'||i===0).map(id=>({id,text:`Brief qualification for [board:${id}].`}))})
  const delta=mode==='tools'?{tool_calls:[{index:0,id:'tool-refusal',type:'function',function:{name:'forbidden_tool',arguments:'{}'}}]}:{content:text}
  await r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta}]})+'\n\ndata: '+JSON.stringify({choices:[],usage:{prompt_tokens:80,completion_tokens:20,total_tokens:100}})+'\n\ndata: [DONE]\n\n'}).catch(()=>{})
 })
 await p.goto('http://127.0.0.1:5173/#/board')
 const boardId=await p.evaluate(async()=>{const {openBoardStore,newBoard,boardDatabaseName}=await import('/src/lib/board/storage.ts');const db=await openBoardStore(boardDatabaseName('re.data.main'));const board=newBoard('Summary fidelity');await db.save({...board,items:[{id:'a',kind:'note',text:'Evidence A\nORIGINAL_A_SENTINEL '+ 'Evidence and qualifications. '.repeat(180),x:20,y:20,width:240,height:180},{id:'b',kind:'reference',text:'Evidence B\nORIGINAL_B_SENTINEL Caveat: uncertain sample.',source:{url:'https://example.test/evidence'},x:300,y:20,width:240,height:180},{id:'excluded',kind:'note',text:'Excluded note\nPRIVATE_EXCLUDED_SENTINEL',x:20,y:250,width:240,height:180}]},0);db.close();return board.id})
 const setup=p.locator('#board-session-setup'),dialog=p.getByRole('dialog',{name:'Board summary preparation',exact:true}),summary=p.getByRole('region',{name:'Board summary preparation',exact:true})
 const sendConsent=summary.getByRole('checkbox',{name:/I consent to send the selected original text/}),generate=summary.getByRole('button',{name:'Generate consented summary',exact:true}),reviewConsent=summary.getByRole('checkbox',{name:/I compared each brief/}),accept=summary.getByRole('button',{name:'Use reviewed summary context',exact:true})
 async function open(){
  await p.goto(`http://127.0.0.1:5173/#/board/${boardId}`)
  await p.getByRole('complementary',{name:'Board outline'}).getByRole('button',{name:'Evidence A',exact:true}).click()
  await p.getByRole('button',{name:'Board to session',exact:true}).click()
  await setup.getByRole('button',{name:'Include whole Board',exact:true}).click()
  await setup.getByRole('checkbox',{name:'note · Excluded note',exact:true}).uncheck()
  await setup.getByRole('combobox',{name:'Board session model',exact:true}).selectOption(JSON.stringify(['ollama','summary:test']))
  await setup.getByRole('textbox',{name:'Board session task',exact:true}).fill('Compare the evidence with caveats.')
  await setup.getByRole('button',{name:'Prepare exact snapshot',exact:true}).click()
  await setup.getByRole('status').filter({hasText:'Ready: 2 included / 1 excluded'}).waitFor()
  await setup.getByRole('checkbox',{name:/I reviewed the included/}).check()
  await setup.getByRole('button',{name:'Prepare optional AI summary',exact:true}).click()
  await dialog.waitFor()
 }
 async function generateValid(){mode='ok';await sendConsent.check();await generate.click();await summary.getByRole('status').filter({hasText:'Summary draft ready for fidelity review.'}).waitFor()}
 await open();assert.equal(requests.length,0);assert.equal(await generate.isDisabled(),true)
 await summary.getByRole('spinbutton',{name:'Summary input budget',exact:true}).fill('1');await summary.getByRole('alert').filter({hasText:'nothing was truncated'}).waitFor();assert.equal(await generate.isDisabled(),true)
 await summary.getByRole('spinbutton',{name:'Summary input budget',exact:true}).fill('8000')
 await sendConsent.check();await summary.getByRole('spinbutton',{name:'Summary maximum output tokens',exact:true}).fill('400');assert.equal(await sendConsent.isChecked(),false)
 await generateValid();assert.equal(requests.length,1);assert.equal(requests[0].maxTokens,400);assert.equal(requests[0].model,'summary:test');assert.equal(requests[0].tools,undefined)
 assert.ok(JSON.stringify(requests[0]).includes('ORIGINAL_A_SENTINEL')&&JSON.stringify(requests[0]).includes('ORIGINAL_B_SENTINEL')&&!JSON.stringify(requests[0]).includes('PRIVATE_EXCLUDED_SENTINEL'))
 assert.equal(await accept.isDisabled(),true)
 await summary.getByRole('textbox',{name:'Summary brief 1',exact:true}).fill('Wrong citation [board:excluded]')
 await summary.getByRole('alert').filter({hasText:'outside the reviewed selection'}).waitFor();assert.equal(await reviewConsent.isDisabled(),true)
 await summary.getByRole('textbox',{name:'Summary brief 1',exact:true}).fill('User corrected qualification [board:a].')
 await reviewConsent.check();await summary.getByRole('textbox',{name:'Summary brief 1',exact:true}).fill('User corrected qualification and uncertainty [board:a].');assert.equal(await reviewConsent.isChecked(),false)
 await summary.getByRole('textbox',{name:'Summary brief 2',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:'.cache/board-summary/fidelity-desktop.png',animations:'disabled'})
 await p.setViewportSize({width:320,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await summary.evaluate(e=>e.scrollWidth>e.clientWidth+2),false);await p.screenshot({path:'.cache/board-summary/fidelity-320.png',animations:'disabled'});await p.setViewportSize({width:1440,height:1000})
 await reviewConsent.check()
 await p.evaluate(async()=>{const {writeLockSession}=await import('/src/lib/security/lock.ts');writeLockSession('guest')})
 await accept.click();await summary.getByRole('alert').filter({hasText:'Workspace changed or was wiped'}).waitFor();assert.equal(requests.length,1)
 await p.evaluate(async()=>{const {clearLockSession}=await import('/src/lib/security/lock.ts');clearLockSession()})
 await accept.click();await dialog.waitFor({state:'detached'})
 assert.equal(await setup.getByRole('button',{name:'Create snapshot session',exact:true}).isDisabled(),true)
 await setup.getByRole('checkbox',{name:/I reviewed the included/}).check();await setup.getByRole('button',{name:'Create snapshot session',exact:true}).click();await p.waitForURL('**/#/chat/*')
 const chatId=p.url().split('/').pop()
 const stored=await p.evaluate(async id=>{const {useStore}=await import('/src/stores/useStore.ts');return useStore.getState().chats.find(c=>c.id===id).boardSnapshot},chatId)
 assert.equal(stored.contextMode,'summary');assert.equal(stored.summary.usage.total,100);assert.ok(stored.summary.originalPrompt.includes('ORIGINAL_A_SENTINEL'));assert.ok(stored.summary.rawResponse.includes('Brief qualification'));assert.ok(stored.summary.reviewedItems[0].text.includes('User corrected'))
 assert.ok(!stored.prompt.includes('ORIGINAL_A_SENTINEL')&&!stored.prompt.includes('ORIGINAL_B_SENTINEL'));assert.ok(stored.prompt.includes('https://example.test/evidence'))
 assert.equal(requests.length,1)
 await p.getByRole('checkbox',{name:/I confirm this context and model/}).check();await p.getByRole('button',{name:'Send confirmed snapshot',exact:true}).click();await p.getByText('Analysis of reviewed briefs.',{exact:true}).waitFor()
 assert.equal(requests.length,2);assert.equal(requests[1].system,stored.system);assert.equal(requests[1].messages[0].content,stored.prompt)
 assert.ok(!JSON.stringify(requests[1]).includes('ORIGINAL_A_SENTINEL')&&!JSON.stringify(requests[1]).includes('ORIGINAL_B_SENTINEL'))
 await p.reload();await p.getByRole('region',{name:'Board snapshot session'}).waitFor();assert.equal(requests.length,2);await p.getByText('Local summary provenance and original evidence audit',{exact:true}).click();await p.screenshot({path:'.cache/board-summary/session-audit.png',animations:'disabled'})
 // Invalid/failed/tool responses never enable acceptance and do not trigger retries.
 await open();const beforeFailures=requests.length
 for(const [failure,message]of [['missing','exactly one brief'],['malformed','complete summary JSON'],['tools','requested tools'],['http','Mock summary refusal']]){
  mode=failure;await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:message}).waitFor();assert.equal(await accept.count(),0)
 }
 assert.equal(requests.length,beforeFailures+4)
 // Endpoint/model changes are rejected before request dispatch.
 const beforeBlocked=requests.length
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,providers:{...s.settings.providers,ollama:{baseUrl:'http://other.invalid'}}}}))})
 await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:'endpoint changed'}).waitFor();assert.equal(requests.length,beforeBlocked)
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,providers:{...s.settings.providers,ollama:{baseUrl:'http://127.0.0.1:11434'}},providerModels:{ollama:[]}}}))})
 await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:'no longer configured'}).waitFor();assert.equal(requests.length,beforeBlocked)
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,providerModels:{ollama:['summary:test']},dailyTokenBudget:1}}))})
 await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:'Daily token budget reached'}).waitFor();assert.equal(requests.length,beforeBlocked)
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,dailyTokenBudget:0}}))})
 await p.evaluate(async()=>{const {writeLockSession}=await import('/src/lib/security/lock.ts');writeLockSession('guest')})
 await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:'Workspace changed or was wiped'}).waitFor();assert.equal(requests.length,beforeBlocked)
 await p.evaluate(async()=>{const {clearLockSession}=await import('/src/lib/security/lock.ts');clearLockSession()})
 mode='hold';const started=new Promise(resolve=>{heldStarted=resolve});await sendConsent.check();await generate.click();await summary.getByRole('button',{name:'Stop summary generation',exact:true}).waitFor();await started;await summary.getByRole('button',{name:'Stop summary generation',exact:true}).click();await summary.getByRole('alert').filter({hasText:'Stopped. Partial output cannot be used'}).waitFor();if(release)release();assert.equal(await accept.count(),0)
 // Closing a dialog aborts and returns focus; original context is still usable.
 await p.getByRole('button',{name:'Close board summary preparation',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await setup.getByRole('button',{name:'Prepare optional AI summary',exact:true}).evaluate(e=>e===document.activeElement),true)
 assert.equal(await setup.getByRole('button',{name:'Restore original evidence context',exact:true}).count(),0)
 mode='ok';await setup.getByRole('button',{name:'Prepare optional AI summary',exact:true}).click();await generateValid();await reviewConsent.check();await accept.click()
 await setup.getByRole('button',{name:'Restore original evidence context',exact:true}).click();assert.equal(await setup.getByRole('button',{name:'Prepare optional AI summary',exact:true}).count(),1)
 assert.equal(await setup.getByRole('button',{name:'Create snapshot session',exact:true}).isDisabled(),true)
 // A new reviewed summary can seed agents; local raw audit is retained but not assigned.
 await setup.getByRole('checkbox',{name:/I reviewed the included/}).check();await setup.getByRole('button',{name:'Prepare optional AI summary',exact:true}).click();await generateValid();await reviewConsent.check();await accept.click();await setup.getByRole('checkbox',{name:/I reviewed the included/}).check();await setup.getByRole('button',{name:'Configure agents with this evidence',exact:true}).click()
 const agents=p.getByRole('region',{name:'MultiAgent setup',exact:true})
 for(const role of ['Leader','Specialist','Reviewer'])await agents.getByRole('combobox',{name:role+' model',exact:true}).selectOption(JSON.stringify(['ollama','summary:test']))
 await agents.getByRole('checkbox',{name:/I reviewed the task/}).check();const beforeAgents=requests.length;await agents.getByRole('button',{name:'Create MultiAgent run',exact:true}).click();await p.waitForURL('**/#/chat/*')
 const evidence=await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');const state=useStore.getState();return state.chats.find(c=>c.id===state.activeChatId).multiAgent.config.evidence})
 assert.ok(evidence.summaryAudit.originalPrompt.includes('ORIGINAL_A_SENTINEL'));assert.ok(!JSON.stringify(evidence.sources).includes('ORIGINAL_A_SENTINEL'));assert.equal(requests.length,beforeAgents)
 // Synthetic secret-like text must block rather than be silently redacted or summarized.
 await p.evaluate(async id=>{const {openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts');const db=await openBoardStore(boardDatabaseName('re.data.main'));const b=await db.load(id);await db.save({...b,items:b.items.map(item=>item.id==='a'?{...item,text:'Evidence A\n'+'sk-'+'x'.repeat(24)}:item)},b.revision);db.close()},boardId)
 await open();await sendConsent.check();await generate.click();await summary.getByRole('alert').filter({hasText:'Privacy Shield would change'}).waitFor();assert.equal(requests.length,beforeAgents)
 const privacy=await p.evaluate(async()=>{
  const {reviewedOutboundWouldChange}=await import('/src/lib/privacy/shield.ts');const {useStore}=await import('/src/stores/useStore.ts')
  const encoded=JSON.stringify({content:JSON.stringify({text:'Evidence\n'+'sk-'+'x'.repeat(24)})})
  const blocked=reviewedOutboundWouldChange(encoded),safe=!reviewedOutboundWouldChange(JSON.stringify({text:'Ordinary evidence with qualifications'}))
  let nested={text:'ordinary'};for(let i=0;i<70;i++)nested={child:nested};const deep=reviewedOutboundWouldChange(JSON.stringify(nested))
  const old=useStore.getState().settings.privacyMode;useStore.setState(s=>({settings:{...s.settings,privacyMode:'none'}}));const off=!reviewedOutboundWouldChange(encoded);useStore.setState(s=>({settings:{...s.settings,privacyMode:old}}));return {blocked,safe,deep,off}
 });assert.deepEqual(privacy,{blocked:true,safe:true,deep:true,off:true})
 assert.deepEqual(errors,[])
 console.log('PASS Board summary: explicit charge consent, exact selected originals only, budgets, editable fidelity review/reset, 320px modal, separate acceptance/create/send consent, original audit vs derived payload, reload, invalid/missing/tool/refused responses, endpoint/model/privacy/daily-budget blocks, Stop/no auto retry, focus return, original restore, scoped agent audit; mocked providers only')
} finally {await browser.close()}
