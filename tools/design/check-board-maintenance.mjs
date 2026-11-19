import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let accept=true
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>accept?d.accept():d.dismiss())
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/board')
 const result=await p.evaluate(async()=>{
  const {openBoardStore,newBoard,freezeBoardWrites}=await import('/src/lib/board/storage.ts');const check=(ok,label)=>{if(!ok)throw new Error(label)},reject=async(fn)=>{try{await fn();return false}catch{return true}}
  const name='maintenance-'+crypto.randomUUID(),db=await openBoardStore(name),guest=await openBoardStore(name+'-guest')
  const base=newBoard('Retained originals'),file=id=>({id,name:id+'.png',blob:new Blob([id.repeat(3)])}),item=id=>({id:'card',kind:'image',x:0,y:0,width:200,height:150,text:id,attachmentId:id})
  let board=await db.save({...base,items:[item('A')]},0,[file('A')]);board=await db.save({...board,items:[item('B')]},1,[file('B')]);board=await db.save({...board,items:[item('C')]},2,[file('C')])
  const other=await db.save({...newBoard('Prefix neighbour'),id:board.id+'-neighbour',items:[item('A')]},0,[file('A')]);await guest.save({...base,items:[item('A')]},0,[file('A')])
  check(await reject(()=>db.maintain(board.id,2,'cleanup')),'stale cleanup must fail');check(!!await db.attachment(board.id,'A'),'stale cleanup changed blobs')
  const clean=await db.maintain(board.id,3,'cleanup');check(clean.files===1&&clean.bytes===3,'cleanup counts');check(!await db.attachment(board.id,'A')&&!!await db.attachment(board.id,'B')&&!!await db.attachment(board.id,'C'),'retention current+previous');check((await db.previous(board.id)).revision===2,'previous changed')
  board=await db.save(board,3);check((await db.maintain(board.id,4,'cleanup')).files===1,'old previous can be collected');check(!await db.attachment(board.id,'B'),'old original retained unnecessarily')
  // Inject malformed orphan after a valid orphan: a late sweep failure must roll back earlier cursor deletes.
  board=await db.save(board,4,[file('a-good'),file('z-bad')])
  await new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const raw=req.result,tx=raw.transaction('attachments','readwrite');tx.objectStore('attachments').put({id:[board.id,'z-bad'],name:'bad',blob:'not a Blob'});tx.oncomplete=()=>{raw.close();resolve()};tx.onabort=()=>reject(tx.error)}})
  check(await reject(()=>db.maintain(board.id,5,'cleanup')),'corrupt blob must abort');check(!!await db.attachment(board.id,'a-good'),'cleanup did not roll back cursor deletes');check((await db.load(board.id)).revision===5,'failed cleanup changed document')
  await new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const raw=req.result,tx=raw.transaction('attachments','readwrite');tx.objectStore('attachments').put({...file('z-bad'),id:[board.id,'z-bad']});tx.oncomplete=()=>{raw.close();resolve()};tx.onabort=()=>reject(tx.error)}})
  check(await reject(()=>db.maintain(board.id,4,'delete')),'stale delete must fail')
  const removed=await db.maintain(board.id,5,'delete');check(removed.files===3,'delete all originals count');check(!await db.load(board.id)&&!await db.previous(board.id)&&!await db.attachment(board.id,'C'),'delete not complete');check(!!await db.attachment(other.id,'A')&&!!await guest.attachment(base.id,'A'),'scope leak')
  check(await reject(()=>db.save(board,5)),'stale editor resurrected board');check(await reject(()=>db.maintain(board.id,5,'delete')),'repeat delete claimed success')
  const race=await db.save(newBoard('Race'),0),settled=await Promise.allSettled([db.maintain(race.id,1,'delete'),db.save({...race,title:'Other writer'},1)])
  check(settled.filter(x=>x.status==='fulfilled').length===1,'race must have exactly one winner');check(!await db.load(race.id),'delete-first stale save resurrected board')
  const race2=await db.save(newBoard('Save first'),0),secondRace=await Promise.allSettled([db.save({...race2,title:'Updated'},1),db.maintain(race2.id,1,'delete')]);check(secondRace.filter(x=>x.status==='fulfilled').length===1&&(await db.load(race2.id)).revision===2,'stale delete removed concurrent save')
  db.close();guest.close();await new Promise(resolve=>{indexedDB.deleteDatabase(name).onsuccess=resolve});await new Promise(resolve=>{indexedDB.deleteDatabase(name+'-guest').onsuccess=resolve})
  return {clean,removed,atomic:true,scoped:true,stale:true,race:true}
 });assert.deepEqual(result.clean,{files:1,bytes:3});assert.equal(result.removed.files,3)
 // User-facing cancellation, unsaved guard, no-op cleanup, editor deletion and list stale protection.
 await p.getByRole('button',{name:'New board',exact:true}).click();await p.waitForURL('**/#/board/*');const id=p.url().split('/').pop();await p.getByText('Board storage and deletion',{exact:true}).click()
 const cleanup=p.getByRole('button',{name:'Clean unused originals',exact:true}),del=p.getByRole('button',{name:'Delete board Untitled board',exact:true})
 accept=false;await del.click();assert.equal(await p.getByRole('heading',{name:'Board deleted',exact:true}).count(),0);accept=true
 await p.getByRole('button',{name:'Note',exact:true}).click();assert.equal(await cleanup.isDisabled(),true);assert.equal(await del.isDisabled(),true)
 await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.getByRole('status').filter({hasText:'Saved revision 2'}).waitFor();await cleanup.click();await p.getByRole('status').filter({hasText:'Removed 0 unused originals'}).waitFor()
 await p.screenshot({path:'.cache/board-maintenance-desktop.png',animations:'disabled'})
 await del.click();await p.getByRole('heading',{name:'Board deleted',exact:true}).waitFor();assert.equal(await p.evaluate(id=>sessionStorage.getItem('re.data.main:board-draft:'+id),id),null);await p.getByRole('link',{name:'All boards',exact:true}).click();await p.getByRole('heading',{name:'Your thinking, in one place',exact:true}).waitFor()
 await p.getByRole('button',{name:'New board',exact:true}).click();await p.waitForURL('**/#/board/*');const second=p.url().split('/').pop();await p.getByRole('textbox',{name:'Board title',exact:true}).fill('Unsaved tab title');await p.getByRole('link',{name:'All boards',exact:true}).click()
 await p.evaluate(async id=>{const {openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts');const store=await openBoardStore(boardDatabaseName('re.data.main')),value=await store.load(id);await store.save({...value,title:'Other window'},value.revision);store.close()},second)
 await p.getByRole('button',{name:'Delete board Untitled board',exact:true}).click();await p.getByRole('alert').filter({hasText:'another window'}).waitFor();assert.equal(await p.getByRole('link',{name:/Untitled board/}).count(),1)
 await p.reload();await p.getByRole('button',{name:'Delete board Other window',exact:true}).waitFor();await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'.cache/board-maintenance-narrow.png',animations:'disabled'});await p.getByRole('button',{name:'Delete board Other window',exact:true}).click();await p.getByRole('heading',{name:'Your thinking, in one place',exact:true}).waitFor();assert.equal(await p.evaluate(id=>sessionStorage.getItem('re.data.main:board-draft:'+id),second),null)
 const frozen=await p.evaluate(async()=>{const {openBoardStore,newBoard,freezeBoardWrites}=await import('/src/lib/board/storage.ts'),store=await openBoardStore('freeze-maintenance-'+crypto.randomUUID());const board=await store.save(newBoard(),0);freezeBoardWrites();try{await store.maintain(board.id,1,'delete');return false}catch{return !!await store.load(board.id)}finally{store.close()}});assert.equal(frozen,true)
 assert.deepEqual(errors,[])
 console.log('PASS scoped transactional board deletion/cleanup, current+previous retention and age-out, exact counts, cursor failure rollback, stale/racing writers/no resurrection, namespace/prefix isolation, confirmation cancellation, dirty guard, list/editor deletion and current-tab recovery cleanup, narrow layout, wipe freeze; no page errors')
}finally{await browser.close()}
