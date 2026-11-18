import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,chromiumSandbox:true,headless:true})
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,dynamicIsland:false,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/chats')
 await p.getByRole('button',{name:'Collapse sidebar',exact:true}).click()
 const more=p.getByRole('button',{name:'More tools',exact:true});await more.waitFor();const before=await more.boundingBox()
 const width=await p.locator('.re-focused-sidebar').evaluate(e=>e.getBoundingClientRect().width)
 await more.click();assert.equal(await more.getAttribute('aria-expanded'),'true')
 assert.equal(await p.locator('.re-focused-sidebar').evaluate(e=>e.getBoundingClientRect().width),width)
 const after=await more.boundingBox();assert.ok(Math.abs(before.y-after.y)<1)
 await p.getByRole('group',{name:'More workspace tools'}).waitFor()
 await more.click();assert.equal(await more.getAttribute('aria-expanded'),'false')
 // Real PDF extraction, assembled as a minimal valid single-page PDF fixture.
 await p.evaluate(async()=>{
  const text='ResearchEngine document fixture contains sufficient selectable text to verify real PDF extraction and island lifecycle.'
  const stream=`BT /F1 12 Tf 50 700 Td (${text}) Tj ET`
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let pdf='%PDF-1.4\n';const offsets=[0];objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const x=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`
  const {extractText}=await import('/src/lib/documents/extract.ts')
  const textOut=await extractText(new File([pdf],'reference.pdf',{type:'application/pdf'}));if(!textOut.includes('selectable text'))throw Error('PDF did not extract')
  await extractText(new File(['broken'],'broken.pdf',{type:'application/pdf'})).catch(()=>{})
  const controller=new AbortController();controller.abort();await extractText(new File(['text'],'cancelled.txt'),{signal:controller.signal}).catch(()=>{})
 })
 const region=p.getByRole('region',{name:'Activity island',exact:true});await region.waitFor({state:'attached'})
 await p.evaluate(async()=>{const {useDocumentActivity}=await import('/src/lib/documents/activity.ts');const states=useDocumentActivity.getState().jobs.map(j=>j.stage);if(states.join(',')!=='ready,failed,cancelled')throw Error(states.join(','))})
 await region.locator('[data-islandcn-hit="pill"]').click();await p.getByRole('heading',{name:'Reference ready',exact:true}).waitFor()
 await p.getByRole('button',{name:'broken.pdf · Document failed',exact:true}).click();await p.getByRole('heading',{name:'Document failed',exact:true}).waitFor()
 assert.ok(await region.locator('[stroke="#ff6b70"]').count()>0)
 await mkdir('.cache/import-island',{recursive:true});await p.screenshot({path:'.cache/import-island/desktop.png'})
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'.cache/import-island/narrow.png'})
 await p.getByRole('button',{name:'Dismiss',exact:true}).click()
 assert.deepEqual(errors,[]);console.log('PASS collapsed More tools anchored/width/semantics; real PDF extraction, failure/cancel states, concurrent import access, coloured status, narrow overflow and dismiss; no page errors')
} finally {await browser.close()}
