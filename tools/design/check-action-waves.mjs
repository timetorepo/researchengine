import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from './node_modules/playwright-core/index.mjs'
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true })
await mkdir('.cache/action-waves', { recursive: true })
const base = 'http://127.0.0.1:5173'
async function open() {
 const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
 await p.addInitScript(() => { if (!localStorage.getItem('action-wave-seed')) { localStorage.setItem('action-wave-seed','1'); localStorage.setItem('intro.logo.seen','1'); localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,theme:'dark',reduceMotion:false,workspaceLayout:'focused',updates:{autoCheck:false}}},version:0})) } })
 await p.route('**/api/**', r => r.fulfill({json:{}}))
 await p.goto(`${base}/#/settings`)
 return p
}
async function coding(p) { await p.getByRole('button',{name:'Coding',exact:true}).click(); await p.getByRole('spinbutton',{name:'Seconds',exact:true}).waitFor() }
async function save(p, value) { await p.getByRole('spinbutton',{name:'Seconds',exact:true}).fill(String(value)); await p.getByRole('button',{name:'Save',exact:true}).click() }
async function savedValue(p) { return p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');return useStore.getState().settings.coding.commandTimeoutSec}) }
try {
 const p = await open(), errors=[]
 p.on('pageerror',e=>errors.push(e.message))
 await coding(p); await save(p,70)
 assert.equal(await savedValue(p),70)
 assert.equal(await p.locator('[data-distortion-wave]').count(),0)
 assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').some(e=>/ReceiptWave/.test(e.name))),false)
 await p.getByRole('button',{name:'Appearance',exact:true}).click()
 const layout=p.getByRole('region',{name:'Workspace layout',exact:true})
 const toggle=layout.getByRole('switch',{name:'Action confirmation waves',exact:true})
 await toggle.click()
 await layout.getByRole('button',{name:/^Overview/}).click()
 await layout.locator('[data-distortion-wave]').waitFor()
 await layout.getByRole('status').filter({hasText:'Layout applied.'}).waitFor()
 await p.screenshot({path:'.cache/action-waves/layout.png'})
 assert.equal(await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');return useStore.getState().settings.workspaceLayout}),'overview')
 await coding(p); await save(p,80)
 const receipt=p.locator('[data-action-receipt]')
 await receipt.locator('[data-distortion-wave]').waitFor()
 await receipt.getByRole('status').filter({hasText:'Changes saved locally.'}).waitFor()
 assert.equal(await p.getByRole('button',{name:'Save',exact:true}).evaluate(e=>e===document.activeElement),true)
 await p.screenshot({path:'.cache/action-waves/coding.png'})
 assert.equal(await savedValue(p),80)

 await p.emulateMedia({reducedMotion:'reduce'})
 await receipt.locator('[data-distortion-wave]').waitFor({state:'detached'})
 await save(p,90); assert.equal(await savedValue(p),90); assert.equal(await receipt.locator('[data-distortion-wave]').count(),0)
 await p.emulateMedia({reducedMotion:'no-preference'})
 assert.equal(await receipt.locator('[data-distortion-wave]').count(),0,'Do not replay on motion preference change')
 await p.reload(); await coding(p); assert.equal(await savedValue(p),90)
 await p.setViewportSize({width:390,height:844}); await save(p,100)
 await receipt.getByRole('status').filter({hasText:'Changes saved locally.'}).waitFor()
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await p.screenshot({path:'.cache/action-waves/narrow.png'})
 await receipt.locator('[data-distortion-wave]').waitFor()
 await receipt.locator('[data-distortion-wave]').evaluate(root=>root.dispatchEvent(new Event('webglcontextlost',{bubbles:true,cancelable:true})))
 await receipt.getByText('Wave unavailable. Saving is unaffected.',{exact:true}).waitFor()
 assert.equal(await savedValue(p),100)
 await p.getByRole('spinbutton',{name:'Seconds',exact:true}).fill('999'); await p.getByRole('button',{name:'Save',exact:true}).click({force:true}); assert.equal(await savedValue(p),100)
 assert.equal(await receipt.locator('[data-distortion-wave]').count(),0)
 // Actual asynchronous Board save succeeds; a stale writer must not produce a receipt.
 await p.setViewportSize({width:1440,height:1000})
 await p.getByRole('button',{name:'Close settings',exact:true}).click()
 await p.goto(`${base}/#/board`)
 await p.getByRole('button',{name:'Create your first board',exact:true}).click()
 await p.getByRole('textbox',{name:'Board title',exact:true}).fill('Private board text is never captured')
 await p.getByRole('button',{name:'Save revision',exact:true}).click()
 await p.getByRole('status').filter({hasText:'Saved revision 2'}).waitFor()
 await p.locator('[data-action-receipt] [data-distortion-wave]').waitFor()
 const id=await p.evaluate(()=>location.hash.split('/').at(-1))
 await p.evaluate(async id=>{const {openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts');const db=await openBoardStore(boardDatabaseName('re.data.main'));const doc=await db.load(id);await db.save({...doc,title:'Other window'},doc.revision);db.close()},id)
 await p.getByRole('textbox',{name:'Board title',exact:true}).fill('Stale draft')
 await p.getByRole('button',{name:'Save revision',exact:true}).click()
 await p.getByRole('alert').filter({hasText:'another window'}).waitFor()
 assert.equal(await p.locator('[data-action-receipt] [data-distortion-wave]').count(),0)
 assert.equal(await p.getByRole('textbox',{name:'Board title',exact:true}).inputValue(),'Stale draft')
 assert.deepEqual(errors,[])
 await p.close()
 // Rejected optional renderer module must not prevent a real save.
 const failure=await open(); await failure.route('**/ReceiptWave.tsx*',r=>r.abort())
 await failure.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,actionConfirmationWaves:true}}))})
 await coding(failure); await save(failure,110)
 await failure.getByText('Wave unavailable. Saving is unaffected.',{exact:true}).waitFor()
 assert.equal(await savedValue(failure),110)
 await failure.close()
 const noGPU = await open()
 await noGPU.evaluate(async()=>{
   const original=HTMLCanvasElement.prototype.getContext
   HTMLCanvasElement.prototype.getContext=function(type,...args){ if(type==='webgl2'||type==='webgl')return null;return original.call(this,type,...args) }
   const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,actionConfirmationWaves:true}}))
 })
 await coding(noGPU); await save(noGPU,120)
 await noGPU.getByText('Wave unavailable. Saving is unaffected.',{exact:true}).waitFor()
 assert.equal(await savedValue(noGPU),120)
 await noGPU.close()
 console.log('PASS action waves: default-off lazy loading, real Coding save, live focus, preset persistence, saved opt-in, reactive reduced motion/no replay, invalid draft, narrow layout, asynchronous Board save/stale-writer failure, rejected renderer fallback')
} finally { await browser.close() }
