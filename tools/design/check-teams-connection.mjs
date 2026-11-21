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
 let mode='ok'
 await p.route('https://team.test/**',async r=>{requests.push(r.request().url());if(mode==='fail'){await r.abort();return}await r.fulfill({json:r.request().url().endsWith('/redeem')?{credential:token,digest,expiresAt:Date.now()+600000,receipt:{sequence:1,digest:'a'.repeat(64)},member:'test-member',role:'Editor'}:{state:{schemaVersion:1,sequence:1,boards:[],posts:[],requiredAttachments:[]},member:'test-member',role:'Editor'}})})
 await p.goto('http://127.0.0.1:5173/#/teams')
 const page=p.getByRole('region',{name:'Teams connection'})
 await page.getByRole('heading',{name:'Teams',exact:true}).waitFor()
 async function review(){await p.getByRole('textbox',{name:'Team HTTPS origin'}).fill(origin);await p.getByRole('textbox',{name:'Team ID',exact:true}).fill(team);await p.getByRole('textbox',{name:'Team invitation'}).fill(randomBytes(32).toString('base64url'));await p.getByRole('button',{name:'Review connection',exact:true}).click()}
 await review();assert.equal(requests.length,0)
 const redeem=p.getByRole('button',{name:'Redeem invitation and connect',exact:true})
 assert.equal(await redeem.isDisabled(),true)
 await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await redeem.click()
 await p.getByText(/Last read: revision sequence 1/).waitFor();assert.equal(requests.length,2)
 await p.getByRole('textbox',{name:'Export passphrase',exact:true}).fill('browser test portable passphrase')
 await p.getByRole('textbox',{name:'Confirm export passphrase',exact:true}).fill('browser test portable passphrase')
 const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Export encrypted credential',exact:true}).click();const download=await downloaded,file=await download.path()
 await p.getByRole('button',{name:'Disconnect',exact:true}).click()
 await p.getByLabel('Import Team credential',{exact:true}).setInputFiles(file)
 await p.getByText(/File metadata loaded/).waitFor();assert.equal(requests.length,2)
 await p.getByRole('textbox',{name:'Credential passphrase',exact:true}).fill('wrong passphrase test')
 await p.getByRole('button',{name:'Review connection',exact:true}).click();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await p.getByRole('button',{name:'Unlock and connect',exact:true}).click()
 await p.getByRole('alert').waitFor();assert.equal(requests.length,2)
 await p.getByLabel('Import Team credential',{exact:true}).setInputFiles(file);await p.getByText(/File metadata loaded/).waitFor()
 await p.getByRole('textbox',{name:'Credential passphrase',exact:true}).fill('browser test portable passphrase');await p.getByRole('button',{name:'Review connection',exact:true}).click();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();await p.getByRole('button',{name:'Unlock and connect',exact:true}).click();await p.getByText(/Last read: revision sequence 1/).waitFor();assert.equal(requests.length,3)
 await p.getByRole('button',{name:'Refresh shared state',exact:true}).click();await p.getByRole('button',{name:'Refresh shared state',exact:true}).waitFor({state:'visible'});await p.getByRole('button',{name:'Disconnect',exact:true}).click()
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:1000});await p.screenshot({path:`.cache/teams/connection-${width}.png`,fullPage:true});assert.equal(await page.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`No page overflow at ${width}`)}
 await review();await p.getByRole('checkbox',{name:/I verified the exact host/}).check();mode='fail';const before=requests.length;await redeem.click();await p.getByRole('alert').waitFor();assert.equal(requests.length,before+1,'No automatic retry after uncertain redeem')
 await p.reload();await page.getByRole('heading',{name:'Teams',exact:true}).waitFor();assert.equal(await p.getByRole('textbox',{name:'Team invitation'}).inputValue(),'')
 assert.deepEqual(errors,[])
 console.log('PASS Teams browser: routed page, explicit review/trust gating, mock redeem/read, encrypted download/import/wrong-pass/no-network, unlock/read/refresh/disconnect, 1440/390/320 page containment, uncertain redemption no auto-retry, reload clears memory; screenshots .cache/teams. Browser emulation, no live host/provider.')
}finally{await browser.close()}
