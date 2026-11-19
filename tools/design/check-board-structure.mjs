import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('dialog',d=>d.accept())
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/board');await p.getByRole('button',{name:'New board',exact:true}).click();await p.waitForURL('**/#/board/*');const id=p.url().split('/').pop()
 const text=p.getByRole('textbox',{name:'Item text',exact:true}),outline=p.getByRole('complementary',{name:'Board outline'}),x=p.getByRole('spinbutton',{name:'X position',exact:true}),member=p.getByRole('combobox',{name:'Parent frame',exact:true})
 await p.getByRole('button',{name:'Note',exact:true}).click();await text.fill('Member note')
 await p.getByRole('button',{name:'Frame',exact:true}).click();await text.fill('Research frame');const frameId=await p.locator('.re-board-card[data-selected=true]').getAttribute('data-board-item')
 await outline.getByRole('button',{name:'Member note',exact:true}).click();await member.selectOption(frameId)
 await p.getByRole('button',{name:'Shape',exact:true}).click();await text.fill('Decision');await member.selectOption(frameId)
 const shape=p.getByRole('combobox',{name:'Shape type',exact:true});await shape.selectOption('ellipse');assert.equal(await p.locator('.re-board-shape-outline ellipse').count(),1);await shape.selectOption('diamond');assert.equal(await p.locator('.re-board-shape-outline polygon').count(),1)
 await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await shape.inputValue(),'ellipse');await p.getByRole('button',{name:'Redo board edit'}).click();assert.equal(await shape.inputValue(),'diamond')
 await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.getByRole('status').filter({hasText:'Saved revision 2'}).waitFor()
 await outline.getByRole('button',{name:'Research frame',exact:true}).click();assert.equal(await member.locator('option').count(),1)
 const frame=p.locator(`[data-board-item="${frameId}"]`), note=p.locator('[data-kind=note]'), history=()=>p.locator('.re-board-body').getAttribute('data-history')
 const positions=()=>Promise.all([frame.evaluate(e=>Number.parseFloat(e.style.left)),note.evaluate(e=>Number.parseFloat(e.style.left))])
 const drag=async(dx,dy,cancel=false)=>{const h=p.getByRole('button',{name:'Move frame card',exact:true});await h.scrollIntoViewIfNeeded();const b=await h.boundingBox();await p.mouse.move(b.x+16,b.y+16);await p.mouse.down();await p.mouse.move(b.x+16+dx,b.y+16+dy,{steps:10});assert.equal(await note.evaluate(e=>e.style.transform!==''),true);if(cancel)await p.keyboard.press('Escape');await p.mouse.up()}
 const before=await history();await drag(40,30,true);assert.deepEqual(await positions(),[320,40]);assert.equal(await history(),before);assert.equal(await note.evaluate(e=>e.style.transform),'')
 await drag(40,30);assert.deepEqual(await positions(),[360,80]);await p.getByRole('button',{name:'Undo board edit'}).click();assert.deepEqual(await positions(),[320,40]);assert.equal(await p.getByRole('button',{name:'Undo board edit'}).isDisabled(),true)
 // Clamp whole membership tree without changing relative offsets, including explicit members outside frame bounds.
 await x.fill('0');assert.deepEqual(await positions(),[280,0]);await p.getByRole('button',{name:'Undo board edit'}).click();assert.deepEqual(await positions(),[320,40])
 await p.getByRole('button',{name:'Move frame card',exact:true}).focus();await p.keyboard.press('Shift+ArrowRight');assert.deepEqual(await positions(),[330,50]);await p.getByRole('button',{name:'Undo board edit'}).click();assert.deepEqual(await positions(),[320,40])
 const width=p.getByRole('spinbutton',{name:'Card width',exact:true});await width.fill('700');assert.deepEqual(await positions(),[320,40]);assert.equal(await note.evaluate(e=>Number.parseFloat(e.style.width)),250)
 await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.getByRole('status').filter({hasText:'Saved revision 3'}).waitFor();await p.reload();await outline.getByRole('button',{name:'Decision',exact:true}).click();assert.equal(await shape.inputValue(),'diamond');assert.equal(await member.inputValue(),frameId)
 await p.screenshot({path:'.cache/board-structure-desktop.png',animations:'disabled'})
 const model=await p.evaluate(async id=>{
  const {newBoard,openBoardStore,boardDatabaseName,validateBoard}=await import('/src/lib/board/storage.ts'),{frameOptions,editGeometry}=await import('/src/lib/board/structure.ts'),{exportBoardBackup,importBoardBackup}=await import('/src/lib/board/backup.ts')
  const item=(id,kind,x,parentId)=>({id,kind,x,y:20,width:200,height:160,text:id,parentId})
  const items=[item('outer','frame',20),item('inner','frame',40,'outer'),item('child','shape',60,'inner')];const moved=editGeometry(items,'outer',{x:50,y:40,width:200,height:160})
  const reject=doc=>{try{validateBoard(doc);return false}catch{return true}}
  const db=await openBoardStore(boardDatabaseName('re.data.main')),saved=await db.load(id);const copy=await importBoardBackup(await exportBoardBackup(saved,async()=>undefined));db.close();const f=copy.document.items.find(i=>i.kind==='frame'),s=copy.document.items.find(i=>i.kind==='shape')
  return {xs:moved.map(i=>i.x),ys:moved.map(i=>i.y),options:frameOptions(items,items[0]).length,childOptions:frameOptions(items,items[2]).length,cycle:reject({...newBoard(),items:[{...items[0],parentId:'inner'},items[1]]}),invalidShape:reject({...newBoard(),items:[{...items[2],parentId:undefined,shape:'triangle'}]}),copyShape:s.shape,copyParent:s.parentId===f.id,fresh:f.id!==saved.items.find(i=>i.kind==='frame').id}
 },id)
 assert.deepEqual(model,{xs:[50,70,90],ys:[40,40,40],options:0,childOptions:2,cycle:true,invalidShape:true,copyShape:'diamond',copyParent:true,fresh:true})
 await outline.getByRole('button',{name:'Research frame',exact:true}).click();await p.getByRole('button',{name:'Remove item',exact:true}).click();assert.equal(await p.locator('[data-kind=frame]').count(),0);await outline.getByRole('button',{name:'Member note',exact:true}).click();assert.equal(await member.inputValue(),'');assert.equal(await outline.getByRole('listitem').count(),2)
 await p.getByRole('button',{name:'Undo board edit'}).click();await outline.getByRole('button',{name:'Member note',exact:true}).click();assert.equal(await member.inputValue(),frameId)
 await p.setViewportSize({width:390,height:844});await member.scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'.cache/board-structure-narrow.png',animations:'disabled'})
 await p.emulateMedia({forcedColors:'active'});await outline.getByRole('button',{name:'Decision',exact:true}).click();assert.equal(await p.locator('.re-board-shape-outline polygon').evaluate(e=>getComputedStyle(e).stroke!=='none'),true)
 assert.deepEqual(errors,[])
 console.log('PASS shape variants/undo/save, explicit frame membership and cycle exclusion, live group preview/cancel/one-step undo, group origin clamp, resize without scaling, nested translation, schema validation, fresh-ID backup links, frame removal retaining members, narrow/forced-colour rendering; no console/page errors')
}finally{await browser.close()}
