import assert from 'node:assert/strict'
import { executeMultiAgent, AgentStageError, validateMultiAgent, type MultiAgentConfig, type AgentStage } from '../src/lib/agents/multiAgent'
const model={providerId:'ollama',model:'test:latest',endpoint:'http://test.invalid'}
const config:MultiAgentConfig={leader:model,specialist:model,reviewer:model,specialistJobs:['Evidence','Alternatives'],maxCalls:5,concurrency:2,tokenBudget:20000,inputBudget:5000,outputBudget:100}
let passed=0
const test=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('ok',name)}
const usage={prompt:20,completion:10,total:30,reported:true}
await test('fixed DAG, explicit disagreement review, complete inputs, concurrency two and immutable events',async()=>{
 let active=0,peak=0;const order:string[]=[],inputs:Record<string,string>={};let latest:AgentStage[]=[]
 const stages=await executeMultiAgent(config,'Task END_SENTINEL',async(stage)=>{order.push(stage.id);inputs[stage.id]=stage.input;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return {text:stage.id==='review'?'DISAGREEMENT: sources differ.':'public '+stage.id,usage}},s=>{latest=s;s[0].text='mutated event copy'})
 assert.equal(stages.length,5);assert.equal(stages.every(stage=>stage.status==='completed'),true);assert.equal(peak,2);assert.equal(order[0],'plan');assert.equal(order[4],'final');assert.ok(inputs.final.includes('DISAGREEMENT'));assert.ok(inputs.final.includes('END_SENTINEL'));assert.equal(stages[0].text,'public plan');assert.ok(latest.every(stage=>stage.endedAt!>=stage.startedAt!))
})
await test('serial setting restricts specialist concurrency',async()=>{let active=0,peak=0;await executeMultiAgent({...config,concurrency:1},'Task',async()=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {text:'public',usage}},()=>{});assert.equal(peak,1)})
await test('call budget stops delegation without fallback/final',async()=>{let calls=0,last:AgentStage[]=[];await assert.rejects(executeMultiAgent({...config,maxCalls:2},'Task',async()=>{calls++;await Promise.resolve();return {text:'partial public',usage}},s=>last=s));assert.ok(calls<=2);assert.equal(last.find(s=>s.id==='final')!.status,'cancelled');assert.ok(last.some(stage=>stage.status==='blocked'))})
await test('too-small input/run budgets block before network with no truncation',async()=>{for(const patch of [{inputBudget:1},{tokenBudget:1}]){let calls=0;await assert.rejects(executeMultiAgent({...config,...patch},'Task',async()=>{calls++;return {text:'no',usage}},()=>{}));assert.equal(calls,0)}})
await test('reported spend beyond reservation stops further calls',async()=>{let calls=0;await assert.rejects(executeMultiAgent({...config,tokenBudget:1000},'Task',async()=>{calls++;return {text:'public',usage:{...usage,total:2000}}},()=>{}));assert.equal(calls,1)})
await test('provider failure retains partial output/usage and stops remaining work',async()=>{let last:AgentStage[]=[];await assert.rejects(executeMultiAgent(config,'Task',async()=>{throw new AgentStageError('refusal','partial evidence',usage)},s=>last=s));assert.equal(last[0].text,'partial evidence');assert.equal(last[0].usage!.total,30);assert.equal(last[0].status,'failed');assert.equal(last.slice(1).every(stage=>stage.status==='cancelled'),true)})
await test('external cancellation reaches both active specialists; no reviewer/final',async()=>{const controller=new AbortController();let active=0,last:AgentStage[]=[];await assert.rejects(executeMultiAgent(config,'Task',async(stage,_max,signal)=>{if(stage.id==='plan')return {text:'plan',usage};return await new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new AgentStageError('stopped','partial',usage)),{once:true});active++;if(active===2)controller.abort()})},s=>last=s,controller.signal));assert.equal(active,2);assert.equal(last.filter(stage=>stage.role==='specialist').every(stage=>stage.status==='cancelled'),true);assert.equal(last.find(stage=>stage.id==='review')!.status,'cancelled')})
await test('invalid config and non-finite usage fail closed',async()=>{assert.throws(()=>validateMultiAgent({...config,concurrency:3},'Task'));assert.throws(()=>validateMultiAgent({...config,maxCalls:6},'Task'));assert.throws(()=>validateMultiAgent({...config,specialistJobs:[]},'Task'));await assert.rejects(executeMultiAgent(config,'Task',async()=>({text:'public',usage:{...usage,total:NaN}}),()=>{}))})
await test('Board evidence is scoped per specialist and not repeated to leader/reviewer/final',async()=>{
 const inputs:Record<string,string>={}
 const evidence={sources:[{id:'a',label:'Source A',content:'SOURCE_A_END'},{id:'b',label:'Source B',content:'SOURCE_B_END'}],specialistSourceIds:[['a'],['b']]}
 await executeMultiAgent({...config,evidence},'Task only',async stage=>{inputs[stage.id]=stage.input;return {text:'Concise public work product citing [board:a]',usage}},()=>{})
 assert.ok(inputs['specialist-0'].includes('SOURCE_A_END'));assert.ok(!inputs['specialist-0'].includes('SOURCE_B_END'))
 assert.ok(inputs['specialist-1'].includes('SOURCE_B_END'));assert.ok(!inputs['specialist-1'].includes('SOURCE_A_END'))
 for(const id of ['plan','review','final'])assert.ok(!inputs[id].includes('SOURCE_A_END')&&!inputs[id].includes('SOURCE_B_END'))
 assert.ok(inputs.final.includes('Concise public work product'))
 assert.throws(()=>validateMultiAgent({...config,evidence:{...evidence,specialistSourceIds:[['unknown'],[]]}},'Task'))
 assert.throws(()=>validateMultiAgent({...config,evidence:{...evidence,specialistSourceIds:[['a','a'],[]]}},'Task'))
 let calls=0
 await assert.rejects(executeMultiAgent({...config,inputBudget:700,evidence:{...evidence,sources:[{...evidence.sources[0],content:'x'.repeat(5000)},evidence.sources[1]]}},'Task',async()=>{calls++;return {text:'Small plan',usage}},()=>{}))
 assert.ok(calls<=2,'Oversized evidence must block its specialist before dispatch, with no silent clipping')
})
console.log(`PASS ${passed} bounded MultiAgent engine checks; fake request adapters only`)
