import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true})
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept())
 await p.addInitScript(()=>{localStorage.setItem('intro.logo.seen','1');localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:true,updates:{autoCheck:false}}},version:0}))})
 await p.route('**/api/**',r=>r.fulfill({json:{}}));await p.goto('http://127.0.0.1:5173/#/board')
 await p.getByRole('button',{name:'Create your first board',exact:true}).click()
 await p.getByRole('button',{name:'Note',exact:true}).click()
 await p.getByRole('textbox',{name:'Item text',exact:true}).fill('Movement study\nA local, editable note.')
 const save=async()=>{await p.getByRole('button',{name:'Save revision',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[aria-label="Undo board edit"]')?.disabled)}
 const value=async(name)=>Number(await p.getByRole('spinbutton',{name,exact:true}).inputValue())
 const history=()=>p.locator('.re-board-body').getAttribute('data-history')
 const drag=async(name,dx,dy,end='up')=>{await p.getByRole('button',{name,exact:true}).scrollIntoViewIfNeeded();const box=await p.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box);await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});if(end==='escape')await p.keyboard.press('Escape');await p.mouse.up()}
 await save()
 // No state/history churn until release, one completed gesture is one undo step.
 const before=await history();const box=await p.getByRole('button',{name:'Move note card',exact:true}).boundingBox()
 await p.mouse.move(box.x+16,box.y+16);await p.mouse.down();await p.mouse.move(box.x+76,box.y+56,{steps:10})
 assert.equal(await value('X position'),40);assert.equal(await history(),before)
 await p.mouse.up();assert.equal(await value('X position'),100);assert.equal(await value('Y position'),80)
 await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await value('X position'),40);assert.equal(await p.getByRole('button',{name:'Undo board edit'}).isDisabled(),true)
 await p.getByRole('button',{name:'Redo board edit'}).click();assert.equal(await value('X position'),100)
 const checkpoint=await history();await drag('Move note card',40,30,'escape');assert.equal(await value('X position'),100);assert.equal(await history(),checkpoint)
 // Pointer cancellation must also restore the preview without a draft change.
 const handle=p.getByRole('button',{name:'Resize note card',exact:true});const rb=await handle.boundingBox();await p.mouse.move(rb.x+16,rb.y+16);await p.mouse.down();await p.mouse.move(rb.x+55,rb.y+45)
 await handle.dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();await p.waitForTimeout(100);assert.equal(await value('Card width'),250);assert.equal(await history(),checkpoint)
 await drag('Resize note card',60,40);assert.equal(await value('Card width'),310);assert.equal(await value('Card height'),230)
 await p.getByRole('button',{name:'Undo board edit'}).click();assert.equal(await value('Card width'),250)
 // Keyboard and numeric alternatives, minimum sizes.
 await handle.focus();await p.keyboard.press('Shift+ArrowRight');assert.equal(await value('Card width'),260)
 await p.getByRole('spinbutton',{name:'Card width',exact:true}).fill('100');assert.equal(await value('Card width'),160)
 await p.getByRole('spinbutton',{name:'Card width',exact:true}).fill('250')
 for(let i=0;i<4;i++)await p.getByRole('button',{name:'Zoom in',exact:true}).click()
 await drag('Move note card',40,20);assert.equal(await value('X position'),120);assert.equal(await value('Y position'),90)
 for(let i=0;i<6;i++)await p.getByRole('button',{name:'Zoom out',exact:true}).click()
 await drag('Move note card',20,10);assert.equal(await value('X position'),160);assert.equal(await value('Y position'),110)
 for(let i=0;i<2;i++)await p.getByRole('button',{name:'Zoom in',exact:true}).click()
 await save();await p.reload();await p.getByRole('button',{name:/Select note 1:/}).click();assert.equal(await value('X position'),160);assert.equal(await value('Card width'),250)
 await p.screenshot({path:'.cache/board-manipulation-desktop.png',animations:'disabled'})
 // Recovery decision blocks editing handles, too.
 await p.getByRole('spinbutton',{name:'Card height',exact:true}).fill('240');await p.reload();await p.getByRole('button',{name:/Select note 1:/}).click();assert.equal(await p.getByRole('button',{name:'Move note card',exact:true}).isDisabled(),true)
 await p.getByRole('button',{name:'Load recovery draft',exact:true}).click();assert.equal(await value('Card height'),240)
 await p.setViewportSize({width:390,height:844});await p.getByRole('spinbutton',{name:'Card width',exact:true}).scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await p.screenshot({path:'.cache/board-manipulation-narrow.png',animations:'disabled'})
 assert.deepEqual(errors,[])
 console.log('PASS move/resize preview without draft churn, one-step undo/redo, Escape/pointercancel rollback, keyboard/numeric alternatives, minimum size, 50/200% coordinate conversion, save/reload, recovery guard, narrow layout; no page errors')
}finally{await browser.close()}
