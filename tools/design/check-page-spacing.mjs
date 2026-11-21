import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
const stage=process.env.SPACING_STAGE??'after',dir=`.cache/page-spacing/${stage}`
await mkdir(dir,{recursive:true})
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');if(!localStorage.getItem('spacing-seed')){localStorage.setItem('spacing-seed','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{chats:[{id:'spacing-one',title:'Research notes '+ 'long-title-'.repeat(30),kind:'research',createdAt:1,updatedAt:1,messages:[]},{id:'spacing-two',title:'Implementation review',kind:'coding',createdAt:1,updatedAt:1,messages:[]}],settings:{onboarded:true,theme:'dark',reduceMotion:true,homeWelcomeCard:false,workspaceLayout:'focused',updates:{autoCheck:false}}},version:0}))}})
 await p.route('**/api/**',r=>r.fulfill({json:{}}))
 await p.goto('http://127.0.0.1:5173/#/')
 const boardId=await p.evaluate(async()=>{const {openBoardStore,boardDatabaseName,newBoard}=await import('/src/lib/board/storage.ts');const db=await openBoardStore(boardDatabaseName('re.data.main'));const b=newBoard('Research board with a very long title '+ 'context-'.repeat(20));await db.save({...b,items:[{id:'note-spacing',kind:'note',text:'Evidence note\nA detailed observation.',x:40,y:40,width:240,height:160}]},0);db.close();return b.id})
 const routes=[['home','/'],['chats','/chats'],['library','/library'],['marketplace','/marketplace'],['board','/board'],['board-editor',`/board/${boardId}`],['agents','/multi-agent'],['settings','/settings']]
 for(const width of [1440,390,320]) {
  await p.setViewportSize({width,height:1000})
  for(const [name,route] of routes){
   await p.goto(`http://127.0.0.1:5173/#${route}`)
   if(name==='settings')await p.evaluate(async()=>{const {useUI}=await import('/src/stores/useUI.ts');useUI.setState({settingsTab:'appearance'})})
   if(name==='board-editor')await p.getByRole('textbox',{name:'Board title',exact:true}).waitFor()
   if(name==='agents')await p.getByRole('textbox',{name:'MultiAgent task',exact:true}).fill('Compare evidence '+ 'longword'.repeat(35))
   await p.waitForTimeout(450)
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
   if(stage==='after')assert.equal(overflow,false,`${name} at ${width}: document overflow`)
   await p.screenshot({path:`${dir}/${name}-${width}.png`,animations:'disabled'})
   if(stage==='after'){
    const escaped=await p.locator('.re-page-content, .re-multi-setup, .bui-settings-content').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().width>0&&e.scrollWidth>e.clientWidth+2).map(e=>e.className))
    assert.deepEqual(escaped,[],`${name} at ${width}: content overflow`)
   }
   if(name==='settings')await p.getByRole('button',{name:'Close settings',exact:true}).click()
  }
 }
 // Text/layout stress probe, not physical browser-zoom certification.
 await p.setViewportSize({width:1280,height:1000});await p.goto('http://127.0.0.1:5173/#/multi-agent');await p.getByRole('textbox',{name:'MultiAgent task',exact:true}).waitFor();await p.evaluate(()=>document.documentElement.style.zoom='2')
 if(stage==='after')assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% CSS zoom stress probe')
 await p.screenshot({path:`${dir}/agents-css-zoom-200.png`,animations:'disabled'})
 assert.deepEqual(errors,[])
 console.log(`PASS ${stage}: 8 pages captured at 1440/390/320, long titles/tasks; ${stage==='after'?'document and content horizontal bounds; ':''}200% CSS zoom stress probe. Canvas has intentional internal pan. No provider calls.`)
} finally {await browser.close()}
