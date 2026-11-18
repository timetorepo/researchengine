import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true })
try {
 const p = await browser.newPage({ viewport: { width: 1280, height: 900 } })
 await p.addInitScript(() => { localStorage.setItem('intro.logo.seen','1'); if (!localStorage.getItem('re.data.main:research-engine-v1')) localStorage.setItem('re.data.main:research-engine-v1',JSON.stringify({state:{settings:{onboarded:true,reduceMotion:false,updates:{autoCheck:false}}},version:0})) })
 await p.route('**/api/**', r => r.fulfill({json:{}}))
 await p.goto('http://127.0.0.1:5173/#/settings')
 await p.getByRole('searchbox',{name:'Find a settings category'}).fill('Liquid Glass Redesign')
 await p.getByRole('button',{name:'Liquid Glass Redesign Appearance',exact:true}).click()
 const toggle = p.getByRole('switch',{name:'Liquid Glass Redesign',exact:true})
 await toggle.waitFor(); assert.equal(await toggle.getAttribute('aria-checked'),'false')
 await toggle.focus(); await p.keyboard.press('Space')
 await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='on')
 assert.ok((await toggle.getAttribute('class')).includes('lg-switch'))
 await p.reload(); await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='on')
 // Exercise the actual settings header after activating glass.
 const search = p.getByRole('searchbox',{name:'Find a settings category'})
 await search.fill('Liquid Glass Redesign'); await p.getByRole('button',{name:'Clear',exact:true}).click(); assert.equal(await search.inputValue(),'')
 await search.fill('Liquid Glass Redesign'); await p.getByRole('button',{name:'Liquid Glass Redesign Appearance',exact:true}).click()
 const strength=p.getByRole('slider',{name:'Floating navigation glass strength',exact:true});await strength.focus();const old=Number(await strength.inputValue());await p.keyboard.press(old===100?'ArrowLeft':'ArrowRight');assert.equal(Number(await strength.inputValue()),old+(old===100?-5:5))
 for (const width of [1280,390]) {
  await p.setViewportSize({width,height:900})
  await toggle.scrollIntoViewIfNeeded()
  assert.ok(await toggle.isVisible())
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await p.screenshot({path:`.cache/liquid-glass-settings-${width}.png`})
 }
 await p.setViewportSize({width:1280,height:900})
 // Isolated real adapters, no providers, keys or model requests.
 await p.evaluate(async()=>{
  const reactModule = await import('/node_modules/.vite/deps/react.js'); const React = reactModule.default ?? reactModule; const client = await import('/node_modules/.vite/deps/react-dom_client.js'); const createRoot = client.createRoot ?? client.default.createRoot
  const {Slider} = await import('/src/components/ui/native/Slider.tsx'); const {BoardPopover} = await import('/src/components/ui/boardui/Popover.tsx'); const {Switch} = await import('/src/components/ui/heroui/Switch.tsx'); const {Input} = await import('/src/components/ui/heroui/Input.tsx'); const {Button} = await import('/src/components/ui/heroui/Button.tsx'); const {SegmentedControl} = await import('/src/components/ui/native/SegmentedControl.tsx')
  const host=document.createElement('section'); host.id='adapter-test'; host.style='position:fixed;inset:0;z-index:99999;background:var(--bg);padding:40px'; document.body.append(host)
  function Test(){const [v,set]=React.useState('secret'); const [checked,check]=React.useState(false); const [seg,select]=React.useState('a'); const [range,setRange]=React.useState(40); return React.createElement('div',null,
   React.createElement(Slider,{'aria-label':'Test range',value:range,min:0,max:100,step:5,onValueChange:setRange}),React.createElement(Slider,{'aria-label':'Disabled range',value:40,disabled:true,onValueChange:setRange}),React.createElement(BoardPopover,{label:'Test popup',trigger:'Open popup'},React.createElement('button',null,'Popup action')),React.createElement(Switch,{label:'Test switch',checked,onChange:check}),React.createElement(Switch,{label:'Disabled switch',checked:false,onChange:check,disabled:true}),
   React.createElement(Input,{label:'Test password',type:'password',value:v,onChange:set,description:'Help text'}),
   React.createElement(Button,{isLoading:true},'Loading action'),React.createElement(Button,{disabled:true},'Disabled action'),
   React.createElement(SegmentedControl,{label:'Test segments',items:[{value:'a',label:'Alpha'},{value:'b',label:'Beta'}],value:seg,onChange:select}),
   React.createElement(SegmentedControl,{label:'Disabled segments',items:[{value:'a',label:'Enabled option'},{value:'b',label:'Disabled option',disabled:true}],value:seg,onChange:select}))}
  createRoot(host).render(React.createElement(Test))
 })
 const area=p.locator('#adapter-test');
 const range=area.getByRole('slider',{name:'Test range',exact:true});await range.focus();await p.keyboard.press('ArrowRight');assert.equal(await range.inputValue(),'45');await p.keyboard.press('End');assert.equal(await range.inputValue(),'100');assert.equal(await area.getByRole('slider',{name:'Disabled range'}).isDisabled(),true)
 const trigger=area.getByRole('button',{name:'Test popup'});await trigger.click();await p.getByRole('button',{name:'Popup action'}).waitFor();await p.keyboard.press('Escape');await p.getByRole('button',{name:'Popup action'}).waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true)
 const sw=area.getByRole('switch',{name:'Test switch',exact:true}); await sw.focus();await p.keyboard.press('Space');assert.equal(await sw.getAttribute('aria-checked'),'true')
 assert.equal(await area.getByRole('switch',{name:'Disabled switch'}).isDisabled(),true)
 const input=area.getByLabel('Test password',{exact:true}); await input.fill('changed');assert.equal(await input.inputValue(),'changed');assert.equal(await input.getAttribute('type'),'password'); await area.getByRole('button',{name:'Toggle visibility'}).click();assert.equal(await input.getAttribute('type'),'text')
 assert.equal(await area.getByRole('button',{name:'Loading action'}).isDisabled(),true);assert.equal(await area.getByRole('button',{name:'Disabled action'}).isDisabled(),true)
 assert.equal(await area.getByRole('radio',{name:'Disabled option'}).isDisabled(),true)
 await p.screenshot({path:'.cache/liquid-glass-controls.png'})
 for(const theme of ['light','catppuccin-latte','nord','dark']) {
  await p.evaluate(async theme=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,theme}}))},theme)
  await p.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme)
  assert.equal(await input.evaluate(el=>{const sample=document.createElement('span');sample.style.color='var(--text)';document.body.append(sample);const matches=getComputedStyle(el).color===getComputedStyle(sample).color;sample.remove();return matches}),true)
  await p.screenshot({path:`.cache/liquid-glass-controls-${theme}.png`,animations:"disabled"})
 }
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,theme:'high-contrast'}}))});await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='off')
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,theme:'dark'}}))});await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='on')

 await p.emulateMedia({ reducedMotion:'reduce' });await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='off');assert.equal(await area.locator('.lg-switch').count(),0)
 await p.emulateMedia({ reducedMotion:'no-preference',forcedColors:'active' });await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='off')
 await p.emulateMedia({forcedColors:'none'});await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='on')
 await p.evaluate(async()=>{const {useStore}=await import('/src/stores/useStore.ts');useStore.setState(s=>({settings:{...s.settings,reduceMotion:true}}))}); await p.waitForFunction(()=>document.documentElement.dataset.liquidRedesign==='off')
 console.log('PASS default off; keyboard toggle; persistence; real Glisse switch/input; password visibility; disabled/loading; disabled segment fallback; OS/app reduced motion; forced colours; range keyboard/bounds/disabled; search clear; popup Escape/focus return; narrow settings')
} finally { await browser.close() }
