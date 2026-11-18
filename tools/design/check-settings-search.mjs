import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,chromiumSandbox:true,headless:true})
try {
 const p=await browser.newPage({viewport:{width:1280,height:900}})
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/settings')
 const search=p.getByRole('searchbox',{name:'Find a settings category'})
 await search.fill('dynamic island');await p.getByRole('button',{name:'Dynamic Island Appearance',exact:true}).click()
 const control=p.getByRole('switch',{name:'Dynamic Island',exact:true});await control.waitFor();await p.locator('.re-setting-search-target').waitFor()
 await search.fill('keyboard');assert.ok(await p.getByLabel('Settings search results').getByRole('button').count()>0)
 await search.fill('dynmic island');await p.getByText('Do you mean',{exact:false}).waitFor();await p.getByRole('button',{name:'Dynamic Island',exact:true}).click()
 await p.getByRole('button',{name:'Dynamic Island Appearance',exact:true}).waitFor()
 await search.fill('zzzxxyy');await p.getByText('No matching settings.',{exact:true}).waitFor();assert.equal(await p.getByText('Do you mean',{exact:false}).count(),0)
 console.log('PASS specific settings search, target reveal, keyboard results, typo suggestion/acceptance, unrelated no-result query')
} finally {await browser.close()}
