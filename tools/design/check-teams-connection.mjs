import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {createHash,randomBytes} from 'node:crypto'
import {chromium} from './node_modules/playwright-core/index.mjs'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 await mkdir('.cache/teams',{recursive:true})
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[]
 p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}))
 const token=randomBytes(32).toString('base64url'),team='test-team',origin='https://team.test',digest=createHash('sha256').update(team+'\0'+token).digest('hex')
 let mode='ok',posts=[],sequence=1,operationMode='ok',stateRole='Editor'
 const boards=[{id:'shared-evidence',revision:1,title:'Shared evidence Board',items:[{id:'note-one',kind:'note',text:'Shared note',x:0,y:0,width:200,height:120}]}]
 const operations=[]
 await p.route('https://team.test/**',async r=>{requests.push(r.request().url());if(r.request().url().endsWith('/attachments')){await r.fulfill({json:{attachmentId:'b'.repeat(64)}});return}if(r.request().url().includes('/attachments/')){await r.fulfill({contentType:'application/octet-stream',body:'test untrusted file bytes'});return}if(mode==='fail'){await r.abort();return}if(r.request().url().endsWith('/presence')){await r.fulfill({json:{observedAt:Date.now(),members:[{member:'test-member',expiresAt:Date.now()+30000}]}});return}if(r.request().url().endsWith('/operations')){const op=r.request().postDataJSON().operation;operations.push(op);if(operationMode==='reject'){await r.fulfill({status:403,json:{error:'forbidden'}});return}posts.push({...op.payload,actor:op.actor,sequence:++sequence});if(operationMode==='uncertain'){await r.abort();return}await r.fulfill({json:{operationId:op.id,receipt:{sequence,digest:'a'.repeat(64)}}});return}await r.fulfill({json:r.request().url().endsWith('/redeem')?{credential:token,digest,expiresAt:Date.now()+600000,receipt:{sequence:1,digest:'a'.repeat(64)},member:'test-member',role:'Editor'}:{state:{schemaVersion:1,sequence,boards,posts,requiredAttachments:[]},member:'test-member',role:stateRole}})})
 await p.goto('http://127.0.0.1:5173/#/teams')
 const page=p.getByRole('region',{name:'Teams connection'})
 await page.getByRole('heading',{name:'Teams',exact:true}).waitFor()
 async function review(){await p.getByRole('textbox',{name:'Team HTTPS origin'}).fill(origin);await p.getByRole('textbox',{name:'Team ID',exact:true}).fill(team);await p.getByRole('textbox',{name:'Team invitation'}).fill(randomBytes(32).toString('base64url'));await p.getByRole('button',{name:'Review connection',exact:true}).click()}
 await review();assert.equal(requests.length,0)
 const redeem=p.getByRole('button',{name:'Redeem invitation and connect',exact:true})
 assert.equal(await redeem.isDisabled(),true)
 await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await redeem.click()
 await p.getByText(/Last read: revision sequence 1/).waitFor();assert.equal(requests.length,2)
 // Opt-in observer must never send a write or overwrite an unsent composer.
 const monitor=p.getByRole('region',{name:'Live Team update awareness'}),watch=monitor.getByRole('checkbox',{name:'Watch shared state while this page is visible',exact:true})
 assert.equal(await watch.isChecked(),false)
 await p.getByRole('button',{name:'Load / refresh shared posts',exact:true}).click()
 await p.getByRole('textbox',{name:'Shared BackChat post text'}).fill('Unsent monitoring draft')
 await p.getByRole('checkbox',{name:/I reviewed this exact text/}).check()
 const beforeObserve=operations.length
 sequence=2
 await watch.check();await monitor.getByText(/Observed host sequence 2/).waitFor()
 await p.getByRole('region',{name:'Teams BackChat'}).getByText(/Newer shared state observed/).waitFor()
 assert.equal(await p.getByRole('textbox',{name:'Shared BackChat post text'}).inputValue(),'Unsent monitoring draft')
 assert.equal(await p.getByRole('checkbox',{name:/I reviewed this exact text/}).isChecked(),false)
 assert.equal(await p.getByRole('button',{name:'Send shared post',exact:true}).isDisabled(),true)
 assert.equal(operations.length,beforeObserve)
 const presence=monitor.getByRole('checkbox',{name:'Also share my temporary member presence with this Team',exact:true});assert.equal(requests.filter(url=>url.endsWith('/presence')).length,0);await presence.check();await monitor.getByText(/Last observed members announcing presence: test-member/).waitFor();assert.equal(requests.filter(url=>url.endsWith('/presence')).length,1)
 await watch.uncheck();assert.equal(await presence.isChecked(),false)
 await p.getByRole('textbox',{name:'Shared BackChat post text'}).fill('')
 // A failed watch is stopped, not retried/reconnected automatically.
 mode='fail';await watch.check();await monitor.getByText(/Stopped after a failed/).waitFor();assert.equal(await watch.isChecked(),false)
 mode='ok'
 const backchat=p.getByRole('region',{name:'Teams BackChat'}),send=backchat.getByRole('button',{name:'Send shared post',exact:true}),load=backchat.getByRole('button',{name:'Load / refresh shared posts',exact:true})
 assert.equal(await send.isDisabled(),true);await load.click();await backchat.getByText('No shared posts in this snapshot.').waitFor()
 const text=backchat.getByRole('textbox',{name:'Shared BackChat post text'}),share=backchat.getByRole('checkbox',{name:/I reviewed this exact text/})
 await text.fill('Shared evidence <script>not markup</script>\nQualification preserved.');assert.equal(await send.isDisabled(),true);await share.check();await text.fill('Changed text');assert.equal(await share.isChecked(),false)
 await share.check();await backchat.getByRole('combobox',{name:'BackChat Board reference',exact:true}).selectOption('shared-evidence');assert.equal(await share.isChecked(),false);await backchat.getByRole('combobox',{name:'BackChat item reference',exact:true}).selectOption('note-one');await backchat.getByRole('button',{name:'Add reviewed Board reference',exact:true}).click();await share.check();await send.click();await backchat.getByText(/Host acknowledged the post/).waitFor();assert.deepEqual(operations[0].payload.links,[{boardId:'shared-evidence',revision:1,itemId:'note-one'}]);assert.equal(operations.length,1);assert.equal(await text.inputValue(),'');await load.click();await backchat.getByText('Changed text',{exact:true}).waitFor()
 operationMode='reject';await text.fill('Retained rejected draft');await share.check();await send.click();await backchat.getByText(/Host rejected the send/).waitFor();assert.equal(await text.inputValue(),'Retained rejected draft');await load.click();await backchat.getByText(/Shared posts loaded/).waitFor()
 await backchat.getByRole('combobox',{name:'BackChat Board reference',exact:true}).selectOption('shared-evidence');await backchat.getByRole('button',{name:'Add reviewed Board reference',exact:true}).click();boards[0].revision=2;await load.click();await backchat.getByRole('alert').filter({hasText:'stale or unavailable'}).waitFor();await share.check();assert.equal(await send.isDisabled(),true);await backchat.getByRole('button',{name:'Remove Board reference 1',exact:true}).click();await backchat.getByRole('combobox',{name:'BackChat Board reference',exact:true}).selectOption('shared-evidence');await backchat.getByRole('button',{name:'Add reviewed Board reference',exact:true}).click()
 const upload=backchat.getByRole('button',{name:'Upload reviewed attachment',exact:true});await backchat.getByLabel('BackChat attachment file',{exact:true}).setInputFiles({name:'reviewed.txt',mimeType:'text/plain',buffer:Buffer.from('test untrusted file bytes')});assert.equal(await upload.isDisabled(),true);await backchat.getByRole('checkbox',{name:/I reviewed this file and consent/}).check();await upload.click();await backchat.getByText(/File uploaded. Review the attachment ID/).waitFor();assert.equal(await share.isChecked(),false)
 operationMode='uncertain';await share.check();await send.click();await backchat.getByText(/Send outcome is uncertain/).waitFor();assert.equal(await send.isDisabled(),true);assert.equal(operations.length,3)
 const recovery=backchat.locator('details').filter({hasText:'Encrypted BackChat draft recovery'});await recovery.locator('summary').click();await recovery.getByRole('textbox',{name:'Draft file passphrase',exact:true}).fill('test encrypted backchat passphrase');await recovery.getByRole('textbox',{name:'Confirm draft file passphrase',exact:true}).fill('test encrypted backchat passphrase');const chatDownload=p.waitForEvent('download');await recovery.getByRole('button',{name:'Export encrypted BackChat draft',exact:true}).click();const chatFile=await (await chatDownload).path();await recovery.getByText(/Encrypted draft download requested/).waitFor()
 await load.click();await backchat.getByText(/exact pending post/).waitFor();
 await recovery.getByLabel('Import encrypted BackChat draft',{exact:true}).setInputFiles(chatFile);await recovery.getByText(/metadata is unauthenticated/).waitFor();const beforeRestore=requests.length;await recovery.getByRole('textbox',{name:'Draft file passphrase',exact:true}).fill('incorrect test passphrase');await recovery.getByRole('checkbox',{name:/I verified this host, team and member/}).check();await recovery.getByRole('button',{name:'Unlock and restore BackChat draft',exact:true}).click();await recovery.getByText(/Encrypted draft action failed/).waitFor();assert.equal(requests.length,beforeRestore)
 await recovery.getByRole('textbox',{name:'Draft file passphrase',exact:true}).fill('test encrypted backchat passphrase');await recovery.getByRole('checkbox',{name:/I verified this host, team and member/}).check();await recovery.getByRole('button',{name:'Unlock and restore BackChat draft',exact:true}).click();await recovery.getByText(/Draft restored locally/).waitFor();assert.equal(requests.length,beforeRestore);assert.equal(await send.isDisabled(),true);await load.click();await backchat.getByText(/exact pending post/).waitFor();assert.equal(operations.length,3);assert.equal(await text.inputValue(),'')
 assert.deepEqual(operations[2].payload.attachments,['b'.repeat(64)]);const attachmentDownload=p.waitForEvent('download');await backchat.getByRole('button',{name:'Download attachment bbbbbbbbbbbb',exact:true}).click();await attachmentDownload;await backchat.getByText(/Download requested, not proof of saving/).waitFor()
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:1000});await p.screenshot({path:`.cache/teams/backchat-${width}.png`,fullPage:true});assert.equal(await page.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`Connected page containment ${width}`)}
 await p.setViewportSize({width:1440,height:1000})
 await p.getByRole('textbox',{name:'Export passphrase',exact:true}).fill('browser test portable passphrase')
 await p.getByRole('textbox',{name:'Confirm export passphrase',exact:true}).fill('browser test portable passphrase')
 const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Export encrypted credential',exact:true}).click();const download=await downloaded,file=await download.path()
 await p.getByRole('button',{name:'Disconnect',exact:true}).click()
 const afterPosts=requests.length
 await p.getByLabel('Import Team credential',{exact:true}).setInputFiles(file)
 await p.getByText(/File metadata loaded/).waitFor();assert.equal(requests.length,afterPosts)
 await p.getByRole('textbox',{name:'Credential passphrase',exact:true}).fill('wrong passphrase test')
 await p.getByRole('button',{name:'Review connection',exact:true}).click();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await p.getByRole('button',{name:'Unlock and connect',exact:true}).click()
 await p.getByRole('alert').waitFor();assert.equal(requests.length,afterPosts)
 await p.getByLabel('Import Team credential',{exact:true}).setInputFiles(file);await p.getByText(/File metadata loaded/).waitFor()
 await p.getByRole('textbox',{name:'Credential passphrase',exact:true}).fill('browser test portable passphrase');await p.getByRole('button',{name:'Review connection',exact:true}).click();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await p.getByRole('button',{name:'Unlock and connect',exact:true}).click();await p.getByText(/Last read: revision sequence/).waitFor();assert.equal(requests.length,afterPosts+1)
 stateRole='Viewer';await load.click();await backchat.getByText(/Shared posts loaded/).waitFor();await text.fill('Viewer must not send');await share.check();assert.equal(await send.isDisabled(),true);assert.equal(operations.length,3)
 await p.getByRole('button',{name:'Refresh shared state',exact:true}).click();await p.getByRole('button',{name:'Refresh shared state',exact:true}).waitFor({state:'visible'});await p.getByRole('button',{name:'Disconnect',exact:true}).click()
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:1000});await p.screenshot({path:`.cache/teams/connection-${width}.png`,fullPage:true});assert.equal(await page.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`No page overflow at ${width}`)}
 await review();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();mode='fail';const before=requests.length;await redeem.click();await p.getByRole('alert').waitFor();assert.equal(requests.length,before+1,'No automatic retry after uncertain redeem')
 await p.reload();await page.getByRole('heading',{name:'Teams',exact:true}).waitFor();assert.equal(await p.getByRole('textbox',{name:'Team invitation'}).inputValue(),'')
 assert.deepEqual(errors,[])
 console.log('PASS Teams browser: opt-in serialized live awareness, separately consented ephemeral presence, preserved composer and consent invalidation, failed-watch stop/no retry; explicit binary attachment upload/post/download and encrypted pending-reference recovery; reviewed Board/item links, consent reset and stale reference refusal without silent upgrade; encrypted BackChat pending export/import/wrong-pass/no-network/restored reconciliation without resend; BackChat consent reset/ACK/rejected draft/uncertain commit reconciliation without resend/Viewer gating and connected 1440/390/320 containment; routed page, explicit review/trust gating, mock redeem/read, encrypted download/import/wrong-pass/no-network, unlock/read/refresh/disconnect, 1440/390/320 page containment, uncertain redemption no auto-retry, reload clears memory; screenshots .cache/teams. Browser emulation, no live host/provider.')
}finally{await browser.close()}
