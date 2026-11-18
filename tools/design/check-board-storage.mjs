import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try {
 const p=await browser.newPage()
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,experimentalTabBar:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/')
 const nav=p.getByTestId('floating-navigation');await nav.getByRole('link',{name:'Home',exact:true}).waitFor();assert.equal(await nav.locator('.lg-tab-bar').count(),0)
 await p.setViewportSize({width:390,height:844});assert.ok((await nav.boundingBox()).width<=390)
 const coding=nav.getByRole('link',{name:'Coding',exact:true});await coding.focus();await p.keyboard.press('Enter');await p.waitForURL('**/#/code');await p.getByRole('navigation',{name:'Coding sections'}).getByRole('link',{name:'Projects',exact:true}).waitFor()
 await p.emulateMedia({forcedColors:'active'});assert.equal(await nav.locator('.lg-tab-bar').count(),0)
 const result=await p.evaluate(async()=>{
  const {newBoard,openBoardStore,validateBoard}=await import('/src/lib/board/storage.ts')
  const check=(ok,message)=>{if(!ok)throw new Error(message)}
  const rejects=async(fn,message)=>{let failed=false;try{await fn()}catch{failed=true}check(failed,message)}
  const name='test-board-'+crypto.randomUUID();let store=await openBoardStore(name);const board=newBoard('Research sources');const id=board.id
  board.items.push({id:crypto.randomUUID(),kind:'pdf',x:0,y:0,width:200,height:150,text:'Source page',attachmentId:'source',source:{page:3}})
  const first=await store.save(board,0,[{id:'source',name:'source.pdf',blob:new Blob(['test PDF bytes'],{type:'application/pdf'})}]);check(first.revision===1,'revision');check(board.revision===0,'caller mutated')
  store.close();store=await openBoardStore(name);check((await store.load(id)).items[0].source.page===3,'reload provenance');check(await (await store.attachment(id,'source')).blob.text()==='test PDF bytes','blob persistence')
  const changed={...first,title:'Second title'};const second=await store.save(changed,1);check(second.revision===2,'second revision');check((await store.previous(id)).title==='Research sources','recovery snapshot')
  await rejects(()=>store.save(changed,1),'stale revision accepted');check((await store.load(id)).revision===2,'stale save mutated board')
  const missing=structuredClone(second);missing.items.push({id:'missing',kind:'image',x:20,y:20,width:50,height:50,text:'Missing',attachmentId:'absent'})
  await rejects(()=>store.save(missing,2,[{id:'orphan',name:'orphan',blob:new Blob(['orphan'])}]),'missing attachment accepted');check(!(await store.attachment(id,'orphan')),'aborted blob leaked');check((await store.load(id)).revision===2,'aborted revision committed');check((await store.previous(id)).revision===1,'failed save replaced recovery snapshot')
  await rejects(()=>store.save(second,2,[{id:'source',name:'replace',blob:new Blob(['replaced'])}]),'immutable attachment replaced')
  const other=newBoard();other.items=structuredClone(first.items);await rejects(()=>store.save(other,0),'cross-board attachment resolved')
  await rejects(()=>Promise.resolve(validateBoard({...second,schemaVersion:2})),'unknown schema accepted');await rejects(()=>Promise.resolve(validateBoard({...second,items:[second.items[0],second.items[0]]})),'duplicate IDs accepted')
  const cycle=structuredClone(second);const node={id:'parent',kind:'frame',x:0,y:0,width:300,height:300,text:'Frame',parentId:cycle.items[0].id};cycle.items[0].parentId=node.id;cycle.items.push(node);await rejects(()=>Promise.resolve(validateBoard(cycle)),'group cycle accepted')
  check((await store.list()).some(entry=>entry.id===id&&entry.revision===2),'list metadata')
  const peer=await openBoardStore(name);const outcomes=await Promise.allSettled([store.save({...second,title:'A'},2),peer.save({...second,title:'B'},2)]);check(outcomes.filter(x=>x.status==='fulfilled').length===1,'concurrent conflict failed');check((await store.load(id)).revision===3,'concurrent revision wrong');peer.close()
  const latest=await store.load(id),previous=await store.previous(id);const restored=await store.save({...previous,revision:latest.revision},latest.revision);check(restored.revision===4&&restored.title===previous.title,'explicit restore failed');check((await store.previous(id)).revision===3,'restore lost latest recovery');store.close()
  await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=resolve;req.onerror=()=>reject(req.error)})
  return 'PASS Board schema/revisions, reopen persistence, PDF provenance, atomic blob rollback, attachment immutability/isolation, previous snapshot, stale/concurrent writers; static navigation keyboard/routes/narrow/forced colours'
 });console.log(result)
}finally{await browser.close()}
