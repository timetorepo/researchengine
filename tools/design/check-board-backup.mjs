import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
function pdfFixture(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>']
 for(const text of ['First source page with a selectable research observation.','Second source page with a different finding to cite.','']){
  const contents=objects.length+2;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 9 0 R >> >> /Contents ${contents} 0 R >>`)
  const stream=text?`BT /F1 16 Tf 40 420 Td (${text}) Tj ET`:'';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
 }
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const x=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return Buffer.from(pdf)
}
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[]
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5173/'))external.push(r.url())})
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/board')
 await p.getByRole('button',{name:'New board',exact:true}).click();await p.waitForURL('**/#/board/*');const originalId=p.url().split('/').pop()
 await p.getByRole('textbox',{name:'Board title',exact:true}).fill('Full backup study')
 await p.getByRole('button',{name:'Note',exact:true}).click();await p.getByRole('textbox',{name:'Item text',exact:true}).fill('Saved note')
 const png=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=24;c.getContext('2d').fillRect(0,0,32,24);return c.toDataURL().split(',')[1]}),'base64'), pdf=pdfFixture()
 await p.getByLabel('Import and save Board files',{exact:true}).setInputFiles([{name:'test.png',mimeType:'image/png',buffer:png},{name:'test.pdf',mimeType:'application/pdf',buffer:pdf}]);await p.getByRole('status').filter({hasText:'Saved revision 2'}).waitFor()
 const outline=p.getByRole('complementary',{name:'Board outline'})
 await outline.getByRole('button',{name:'test.pdf',exact:true}).click();await p.getByRole('spinbutton',{name:'Linked PDF page',exact:true}).fill('2')
 await p.getByRole('textbox',{name:'Item text',exact:true}).fill('Unsaved annotation in backup')
 const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Download full backup',exact:true}).click();const download=await dl;assert.match(download.suggestedFilename(),/\.reboard$/)
 const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);const bytes=Buffer.concat(chunks)
 const input=p.getByLabel('Import Board backup as new board',{exact:true});await input.setInputFiles({name:'copy.reboard',mimeType:'application/octet-stream',buffer:bytes});await p.waitForURL(url=>url.hash.startsWith('#/board/')&&!url.hash.endsWith(originalId));const copyId=p.url().split('/').pop();assert.notEqual(copyId,originalId)
 await outline.getByRole('button',{name:'Unsaved annotation in backup',exact:true}).click();await p.getByRole('img',{name:'PDF page 2 preview',exact:true}).waitFor({state:'visible'})
 const result=await p.evaluate(async({originalId,copyId})=>{
  const {openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts');const db=await openBoardStore(boardDatabaseName('re.data.main'))
  const a=await db.load(originalId),b=await db.load(copyId);const original=await db.attachment(a.id,a.items[2].attachmentId),copy=await db.attachment(b.id,b.items[2].attachmentId)
  const value={count:(await db.list()).length,oldRevision:a.revision,newRevision:b.revision,oldText:a.items[2].text,newText:b.items[2].text,page:b.items[2].source.page,fresh:b.items.every((i,n)=>i.id!==a.items[n].id),freshAttachment:b.items[2].attachmentId!==a.items[2].attachmentId,bytes:Array.from(new Uint8Array(await copy.blob.arrayBuffer())),sameBytes:await original.blob.text()===await copy.blob.text()};db.close();return value
 },{originalId,copyId})
 assert.equal(result.count,2);assert.equal(result.oldRevision,2);assert.equal(result.newRevision,1);assert.equal(result.oldText,'test.pdf');assert.equal(result.newText,'Unsaved annotation in backup');assert.equal(result.page,2);assert.ok(result.fresh&&result.freshAttachment&&result.sameBytes);assert.ok(Buffer.from(result.bytes).equals(pdf))
 await p.screenshot({path:'.cache/board-backup-desktop.png',animations:'disabled'})
 // Corrupt payload must fail before any database write.
 const corrupt=Buffer.from(bytes);corrupt[corrupt.length-20]^=1
 await input.setInputFiles({name:'bad.reboard',mimeType:'application/octet-stream',buffer:corrupt});await p.getByRole('alert').filter({hasText:'integrity check failed'}).waitFor()
 await input.setInputFiles({name:'truncated.reboard',mimeType:'application/octet-stream',buffer:bytes.subarray(0,bytes.length-10)});await p.getByRole('alert').filter({hasText:'Truncated'}).waitFor()
 // Adversarial manifest, content and cancellation probes exercise the same production parser.
 const checks=await p.evaluate(async base64=>{
  const {exportBoardBackup,importBoardBackup}=await import('/src/lib/board/backup.ts');const {newBoard,openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts')
  const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const size=new DataView(data.buffer).getUint32(8);const manifest=JSON.parse(new TextDecoder().decode(data.slice(12,12+size))),payload=data.slice(12+size)
  const pack=(m,body=payload)=>{const json=new TextEncoder().encode(JSON.stringify(m)),prefix=data.slice(0,12);new DataView(prefix.buffer).setUint32(8,json.length);return new Blob([prefix,json,body])}
  const reject=async(blob)=>{try{await importBoardBackup(blob);return false}catch{return true}}
  const results=[]
  let m=structuredClone(manifest);m.version=99;results.push(await reject(pack(m)))
  m=structuredClone(manifest);m.attachments.push(m.attachments[0]);results.push(await reject(pack(m)))
  m=structuredClone(manifest);m.attachments.pop();results.push(await reject(pack(m)))
  m=structuredClone(manifest);m.document.items[2].source.page=999;results.push(await reject(pack(m)))
  results.push(await reject(pack(manifest,new Uint8Array([...payload,0]))))
  results.push(await reject(new Blob(['{}'])))
  // Valid hash cannot make an unsupported original trusted.
  const html=new Blob(['<script>alert(1)</script>']),digest=await crypto.subtle.digest('SHA-256',await html.arrayBuffer()),sha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
  m=structuredClone(manifest);m.document.items=m.document.items.filter(i=>i.kind==='image');m.attachments=[{...m.attachments[0],name:'fake.png',size:html.size,sha256:sha}];results.push(await reject(pack(m,html)))
  const abort=new AbortController();abort.abort();try{await importBoardBackup(new Blob([data]),abort.signal);results.push(false)}catch{results.push(true)}
  try{await exportBoardBackup({...newBoard(),items:[{id:'n',kind:'image',x:0,y:0,width:200,height:200,text:'',attachmentId:'missing'}]},async()=>undefined);results.push(false)}catch{results.push(true)}
  const empty=await exportBoardBackup(newBoard('Empty'),async()=>undefined);results.push((await importBoardBackup(empty)).document.title==='Empty')
  const db=await openBoardStore(boardDatabaseName('re.data.main'));const count=(await db.list()).length;db.close();return {results,count}
 },bytes.toString('base64'))
 assert.ok(checks.results.every(Boolean),JSON.stringify(checks));assert.equal(checks.count,2)
 // Deterministically cancel while a real image decode is held; no partial board/originals saved.
 await p.evaluate(()=>{window.__bitmap=createImageBitmap;window.createImageBitmap=async(...args)=>{await new Promise(resolve=>window.__releaseBitmap=resolve);return window.__bitmap(...args)}})
 await input.setInputFiles({name:'cancel.reboard',mimeType:'application/octet-stream',buffer:bytes});await p.waitForFunction(()=>typeof window.__releaseBitmap==='function');await p.getByRole('button',{name:'Cancel backup operation',exact:true}).click();await p.evaluate(()=>window.__releaseBitmap());await p.getByRole('status').filter({hasText:'Cancelled · no imported board saved'}).waitFor();await p.evaluate(()=>{window.createImageBitmap=window.__bitmap})
 const isolation=await p.evaluate(async()=>{const {openBoardStore,boardDatabaseName}=await import('/src/lib/board/storage.ts');const main=await openBoardStore(boardDatabaseName('re.data.main')),guest=await openBoardStore(boardDatabaseName('re.data.guest'));const result={main:(await main.list()).length,guest:(await guest.list()).length};main.close();guest.close();return result});assert.deepEqual(isolation,{main:2,guest:0})
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Download full backup',exact:true}).scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'.cache/board-backup-narrow.png',animations:'disabled'})
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 console.log('PASS backup UI download/new-board import with unsaved annotations and byte-exact image/PDF originals, fresh IDs/page persistence, corruption/truncation/version/duplicate/missing/trailing-byte/content rejection, abort and missing-original export, empty roundtrip, cancelled decode rollback, narrow layout; no external requests/page errors')
}finally{await browser.close()}
