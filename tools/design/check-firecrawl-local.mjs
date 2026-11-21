import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from './node_modules/playwright-core/index.mjs'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];let fail=false
 p.on('pageerror',e=>errors.push(e.message))
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',async r=>{const url=new URL(r.request().url());if(url.pathname==='/api/library/search'){await r.fulfill({json:{hits:[{id:'fixture',kind:'source',title:'Local scraper fixture',url:'https://example.test/article',source:'Example'}],pending:[],sources:[],notes:[]}});return}if(url.pathname==='/api/library/read'){requests.push(url.searchParams.get('engine')??'default');if(fail){await r.fulfill({status:502,json:{error:'Firecrawl Local unavailable; no cloud fallback.'}});return}await r.fulfill({json:{ok:true,via:url.searchParams.has('engine')?'firecrawl-local':'html',url:'https://example.test/article',title:'Local scraper fixture',wordCount:8,minutes:1,blocks:[{type:'paragraph',text:url.searchParams.has('engine')?'LOCAL_UNTRUSTED <script>not executable</script>':'Default reader fixture'}],outline:[],images:[]}});return}await r.fulfill({json:{}})})
 await p.goto('http://127.0.0.1:5173/#/library')
 await p.getByRole('button',{name:'Search Library',exact:true}).click();const input=p.getByRole('textbox',{name:'Search Library',exact:true});await input.fill('fixture');await input.press('Enter');await p.getByRole('button',{name:'Local scraper fixture',exact:true}).click()
 const viewer=p.locator('[data-ui="source-viewer"]');await viewer.getByText('Default reader fixture',{exact:true}).waitFor();assert.deepEqual(requests,['default'])
 await viewer.getByRole('button',{name:'Scrape with Firecrawl Local',exact:true}).click();await viewer.getByText('LOCAL_UNTRUSTED <script>not executable</script>',{exact:true}).waitFor();assert.deepEqual(requests,['default','firecrawl-local']);assert.equal(await viewer.locator('script').count(),0);await viewer.getByText('Firecrawl Local · cloud disabled',{exact:true}).waitFor()
 await mkdir('.cache/firecrawl-local',{recursive:true});for(const width of [1440,390,320]){await p.setViewportSize({width,height:1000});await p.screenshot({path:`.cache/firecrawl-local/reader-${width}.png`});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)}
 fail=true;await viewer.getByRole('button',{name:'Scrape with Firecrawl Local',exact:true}).click();await viewer.getByText(/Firecrawl Local unavailable; no cloud fallback/).first().waitFor();assert.deepEqual(requests,['default','firecrawl-local','firecrawl-local']);assert.deepEqual(errors,[])
 console.log('PASS Firecrawl Local viewer: default reader unchanged, explicit local-engine request, labelled provenance, plain text untrusted output, explicit failure/no fallback, 1440/390/320 document containment. Mock transport only.')
}finally{await browser.close()}
