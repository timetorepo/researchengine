import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try {
 const p=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');if(!localStorage.getItem('re.data.main:research-engine-v1'))localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,typeface:'work-sans',reduceMotion:false,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/')
 await p.waitForFunction(()=>document.documentElement.dataset.typeface==='work-sans')
 await p.goto('http://127.0.0.1:5173/#/settings');await p.getByRole('searchbox',{name:'Find a settings category'}).fill('typeface');await p.getByRole('button',{name:'Typeface Appearance',exact:true}).click();await p.getByRole('button',{name:/^SN Pro Aa/}).click()
 const font=await p.evaluate(async()=>{await document.fonts.load('400 14px "SN Pro"');await document.fonts.load('italic 600 14px "SN Pro"');return {normal:document.fonts.check('400 14px "SN Pro"'),italic:document.fonts.check('italic 600 14px "SN Pro"')}});assert.deepEqual(font,{normal:true,italic:true})
 await p.waitForFunction(()=>document.documentElement.dataset.typeface==='sn-pro');await p.reload();await p.waitForFunction(()=>document.documentElement.dataset.typeface==='sn-pro');await p.goto('http://127.0.0.1:5173/')
 await p.evaluate(async()=>{
  const r=await import('/node_modules/.vite/deps/react.js');const React=r.default??r;const c=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=c.createRoot??c.default.createRoot
  const {ActivityTrace,activityEntries}=await import('/src/components/chat/ActivityTrace.tsx');const {ToolTraceChips}=await import('/src/components/chat/ToolUI.tsx')
  const host=document.createElement('section');host.id='trace-test';host.style='position:fixed;inset:0;z-index:99999;background:var(--bg);padding:24px;overflow:auto';document.body.append(host)
  const activities=['queued','running','waiting','completed','failed','blocked','cancelled'].map((status,index)=>({id:String(index),tool:index===4?'read_an_extremely_long_resource_name_without_spaces_that_must_wrap_in_a_narrow_window':'read_file',status,resource:'/workspace/sources/paper.pdf',startedAt:1000,...(index===3?{endedAt:2500}:index===4?{endedAt:900}:{})}))
  const legacy=Array.from({length:12},(_,index)=>({tool:'search_web',label:index===11?"Bird's-eye graph: Sources":`Historical step ${index+1}`,status:index===11?'confirm':'ok'}))
  const entries=activityEntries(activities,legacy);if(entries.length!==7||entries[3].seconds!==1.5||entries[4].seconds!==undefined)throw new Error('Activity normalization mismatch')
  window.__traceGraphCount=0
  createRoot(host).render(React.createElement('div',{style:{maxWidth:800,margin:'0 auto'}},
   React.createElement('h1',null,'Synthetic activity fixture — not a live AI run'),React.createElement('p',null,'SN Pro comparison: 0123456789 · Il1 O0 · sources → notes'),
   React.createElement('div',{id:'modern'},React.createElement(ToolTraceChips,{msg:{id:'fixture',role:'assistant',content:'',createdAt:0,toolActivity:activities,toolTrace:legacy,thinking:'PRIVATE_REASONING_FIXTURE',rawOutput:'RAW_OUTPUT_FIXTURE'}})),
   React.createElement('div',{id:'legacy'},React.createElement(ActivityTrace,{legacy,onOpenGraph:()=>window.__traceGraphCount++}))))
 })
 const modern=p.locator('#modern');await modern.locator('[data-slot=trace]').waitFor();assert.equal(await modern.locator('[data-slot=trace-collapsible]').count(),7);assert.equal(await p.locator('#legacy [data-slot=trace-collapsible]').count(),12);assert.equal(await modern.getByText('1.5s',{exact:true}).count(),1)
 assert.equal(await p.getByText('PRIVATE_REASONING_FIXTURE',{exact:true}).count(),0);assert.equal(await p.getByText('RAW_OUTPUT_FIXTURE',{exact:true}).count(),0)
 const failed=modern.locator('[data-activity-status=failed]');const trigger=failed.locator('[data-slot=trace-collapsible-trigger]');assert.equal(await trigger.getAttribute('aria-expanded'),'true');await trigger.focus();await p.keyboard.press('Space');assert.equal(await trigger.getAttribute('aria-expanded'),'false');await p.keyboard.press('Enter');assert.equal(await trigger.getAttribute('aria-expanded'),'true');await failed.getByText('Duration not recorded.',{exact:true}).waitFor()
 await p.getByRole('button',{name:'Open graph',exact:true}).click();assert.equal(await p.evaluate(()=>window.__traceGraphCount),1)
 await p.locator('#trace-test').evaluate(el=>el.scrollTop=0)
 await p.screenshot({path:'.cache/trace-sn-pro-desktop.png',animations:'disabled'})
 await p.setViewportSize({width:390,height:1000});assert.equal(await p.locator('#trace-test').evaluate(el=>el.scrollWidth>el.clientWidth),false);await p.locator('#trace-test').evaluate(el=>el.scrollTop=0);await p.screenshot({path:'.cache/trace-sn-pro-narrow.png',animations:'disabled'})
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await modern.locator('.re-trace-spinner').evaluate(el=>getComputedStyle(el).animationName),'none')
 await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,reduceMotion:true}}))});await p.waitForFunction(()=>document.documentElement.classList.contains('reduce-motion'));assert.equal(await modern.locator('.re-trace-spinner').evaluate(el=>getComputedStyle(el).animationName),'none')
 await p.emulateMedia({forcedColors:'active'});await p.keyboard.press('Tab');await trigger.focus();assert.equal(await trigger.evaluate(el=>getComputedStyle(el).outlineStyle),'solid')
 for(const name of ['graphite','paper']) {
  const svg=await readFile(`design/marketing/tag/researchengine-tag-${name}.svg`,'utf8');assert.ok(!svg.includes('<text'));assert.ok(!svg.includes('<image'));assert.ok(!svg.includes('®'))
  const art=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});await art.setContent('<style>html,body{margin:0;padding:0}</style>'+svg);await art.screenshot({path:`design/marketing/tag/researchengine-tag-${name}.png`});await art.close()
 }
 assert.deepEqual(errors,[])
 console.log('PASS actual SortUI modern/legacy trace, all statuses, complete history, recorded/unknown durations, keyboard disclosure, graph action, narrow wrapping, reduced motion/forced-colour focus, SN Pro normal/italic and saved preference; rendered both outlined tag PNGs')
}finally{await browser.close()}
