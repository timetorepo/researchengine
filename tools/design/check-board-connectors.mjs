import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('dialog',d=>d.accept())
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/board');await p.getByRole('button',{name:'New board',exact:true}).click();await p.waitForURL('**/#/board/*');const id=p.url().split('/').pop()
 const add=p.getByRole('button',{name:'Connector',exact:true}),text=p.getByRole('textbox',{name:'Item text',exact:true}),outline=p.getByRole('complementary',{name:'Board outline'})
 assert.equal(await add.isDisabled(),true)
 await p.getByRole('button',{name:'Note',exact:true}).click();await text.fill('Evidence');assert.equal(await add.isDisabled(),true)
 const fromId=await p.locator('[data-board-item][data-selected=true]').getAttribute('data-board-item')
 await p.getByRole('button',{name:'Shape',exact:true}).click();await text.fill('Finding');await p.getByRole('combobox',{name:'Shape type',exact:true}).selectOption('ellipse')
 const toId=await p.locator('[data-board-item][data-selected=true]').getAttribute('data-board-item')
 await outline.getByRole('button',{name:'Evidence',exact:true}).click();await add.click()
 const label=p.getByRole('textbox',{name:'Connection label',exact:true}),from=p.getByRole('combobox',{name:'Connection from',exact:true}),to=p.getByRole('combobox',{name:'Connection to',exact:true})
 assert.equal(await from.inputValue(),fromId);assert.equal(await to.inputValue(),toId);assert.equal(await from.locator(`option[value="${toId}"]`).count(),0)
 await label.fill('Supports finding');const line=p.locator('.re-board-connector-line'),hit=p.getByRole('button',{name:'Select connector: Supports finding',exact:true}),route=()=>line.getAttribute('d');const initial=await route();assert.match(initial,/^M /)
 assert.equal(await p.getByRole('spinbutton',{name:'X position',exact:true}).count(),0)
 await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.getByRole('status').filter({hasText:'Saved revision 2'}).waitFor();await p.screenshot({path:'.cache/board-connectors-pair.png',animations:'disabled'})
 await outline.getByRole('button',{name:'Evidence',exact:true}).click();const history=await p.locator('.re-board-body').getAttribute('data-history')
 const drag=async(cancel)=>{const h=p.getByRole('button',{name:'Move note card',exact:true});await h.scrollIntoViewIfNeeded();const b=await h.boundingBox();await p.mouse.move(b.x+16,b.y+16);await p.mouse.down();await p.mouse.move(b.x+36,b.y+46,{steps:8});assert.notEqual(await route(),initial);assert.equal(await p.locator('.re-board-body').getAttribute('data-history'),history);if(cancel)await p.keyboard.press('Escape');await p.mouse.up()}
 await drag(true);assert.equal(await route(),initial);await drag(false);assert.notEqual(await route(),initial);await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await route(),initial);assert.equal(await p.getByRole('button',{name:'Undo board edit'}).isDisabled(),true)
 // Arrow keys and resize both update boundary anchors; canvas scale does not change board coordinates.
 await p.getByRole('button',{name:'Resize note card',exact:true}).focus();await p.keyboard.press('Shift+ArrowRight');assert.notEqual(await route(),initial);await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await route(),initial)
 await p.getByRole('button',{name:'Zoom in',exact:true}).click();assert.equal(await route(),initial)
 await hit.focus();await p.keyboard.press('Enter');await label.waitFor();assert.equal(await hit.getAttribute('aria-pressed'),'true')
 await p.getByRole('button',{name:'Frame',exact:true}).click();await text.fill('Review frame');const frameId=await p.locator('[data-board-item][data-selected=true]').getAttribute('data-board-item')
 await outline.getByRole('button',{name:'Evidence',exact:true}).click();await p.getByRole('combobox',{name:'Parent frame',exact:true}).selectOption(frameId)
 await outline.getByRole('button',{name:'Review frame',exact:true}).click()
 const frameHandle=p.getByRole('button',{name:'Move frame card',exact:true});await frameHandle.scrollIntoViewIfNeeded();const fb=await frameHandle.boundingBox();const beforeGroup=await route();await p.mouse.move(fb.x+16,fb.y+16);await p.mouse.down();await p.mouse.move(fb.x+36,fb.y+36,{steps:5});assert.notEqual(await route(),beforeGroup);await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await route(),beforeGroup)
 await outline.getByRole('button',{name:'Supports finding',exact:true}).click();await to.selectOption(frameId);assert.notEqual(await route(),initial)
 await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.getByRole('status').filter({hasText:'Saved revision 3'}).waitFor();await p.reload();await outline.getByRole('button',{name:'Supports finding',exact:true}).click();assert.equal(await to.inputValue(),frameId)
 await p.screenshot({path:'.cache/board-connectors-desktop.png',animations:'disabled'})
 const model=await p.evaluate(async id=>{
  const {openBoardStore,boardDatabaseName,validateBoard,newBoard}=await import('/src/lib/board/storage.ts'),{connectorPath}=await import('/src/lib/board/connectors.ts'),{exportBoardBackup,importBoardBackup}=await import('/src/lib/board/backup.ts')
  const db=await openBoardStore(boardDatabaseName('re.data.main')),board=await db.load(id);db.close();const copy=await importBoardBackup(await exportBoardBackup(board,async()=>undefined)),connector=copy.document.items.find(i=>i.kind==='connector')
  const base={x:0,y:0,width:200,height:100,text:''},a={...base,id:'a',kind:'shape',shape:'diamond'},b={...base,id:'b',kind:'shape',shape:'ellipse',x:400},c={...base,id:'c',kind:'connector',fromId:'a',toId:'b'}
  const reject=items=>{try{validateBoard({...newBoard(),items});return false}catch{return true}}
  return {copy:!!connectorPath(connector,copy.document.items),fresh:connector.fromId!==board.items.find(i=>i.kind==='connector').fromId,anchors:connectorPath(c,[a,b,c]).d,overlap:connectorPath(c,[a,{...b,x:0},c]).d,missing:connectorPath({...c,toId:undefined},[a,b,c])===undefined,self:reject([a,{...c,toId:'a'}]),connectorEndpoint:reject([a,c,{...c,id:'d',fromId:'c',toId:'a'}])}
 },id)
 assert.equal(model.copy,true);assert.equal(model.fresh,true);assert.equal(model.anchors,'M 200 50 L 400 50');assert.match(model.overlap,/ C /);assert.equal(model.missing,true);assert.equal(model.self,true);assert.equal(model.connectorEndpoint,true)
 // Deleting endpoint removes connector in the same undoable operation; unrelated items survive.
 await outline.getByRole('button',{name:'Evidence',exact:true}).click();await p.getByRole('button',{name:'Remove item',exact:true}).click();assert.equal(await line.count(),0);assert.equal(await outline.getByRole('listitem').count(),2);await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await line.count(),1);assert.equal(await outline.getByRole('listitem').count(),4)
 await p.emulateMedia({forcedColors:'active'});await hit.focus();assert.notEqual(await line.evaluate(e=>getComputedStyle(e).stroke),'none')
 await p.setViewportSize({width:390,height:844});await outline.getByRole('button',{name:'Supports finding',exact:true}).click();await to.scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'.cache/board-connectors-narrow.png',animations:'disabled'})
 assert.deepEqual(errors,[])
 console.log('PASS directed connector create/endpoint editing/labels, self/connector exclusion, live endpoint and frame-move preview with Escape/undo, resize/zoom anchors, keyboard selection, save/reload, fresh-ID backup, shape/overlap routing, endpoint cascade deletion/undo, narrow/forced-colour checks; no console/page errors')
}finally{await browser.close()}
