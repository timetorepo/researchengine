import assert from 'node:assert/strict'
import { prepareSummaryRequest, parseSummaryResponse, applyReviewedSummary, BOARD_SUMMARY_USE_SYSTEM } from '../src/lib/board/summary'
import { agentStageInput } from '../src/lib/agents/multiAgent'
import type { BoardSnapshot } from '../src/lib/board/session'
const usage={prompt:40,completion:20,total:60,reported:true}
const original={items:[{citation:'board:a',kind:'pdf',source:{page:2},textRef:'t1',originalRef:'o1'}],texts:{t1:'ORIGINAL_SOURCE_SENTINEL '+'Evidence '.repeat(600),t2:'PDF_PAGE_SENTINEL'},originals:{o1:{name:'source.pdf',type:'application/pdf',fileId:'attachment-a',page:2,textRef:'t2',note:'Linked page only'}}}
const source:BoardSnapshot={version:1,id:'snapshot-a',boardId:'board-a',boardTitle:'Sources',revision:3,draft:true,createdAt:new Date().toISOString(),providerId:'ollama',endpoint:'http://127.0.0.1:11434',model:'test',intent:'Compare evidence',task:'Compare evidence carefully',inputBudget:10000,outputBudget:500,system:'original system',prompt:JSON.stringify(original),includedIds:['a','b'],excludedIds:['private'],contextMode:'compact',agentSources:[{id:'a',label:'PDF annotation',content:JSON.stringify(original)},{id:'b',label:'Note',content:JSON.stringify({items:[{citation:'board:b',kind:'note',textRef:'t1'}],texts:{t1:'INDEPENDENT_NOTE_SENTINEL'},originals:{}})}]}
const before=structuredClone(source)
const request=prepareSummaryRequest(source,10000,300)
assert.ok(request.prompt.includes('ORIGINAL_SOURCE_SENTINEL'))
assert.ok(request.prompt.includes('INDEPENDENT_NOTE_SENTINEL'))
assert.ok(!request.prompt.includes('"points"'))
assert.throws(()=>prepareSummaryRequest(source,1,300),/nothing was truncated/)
for(const value of [0,-1,1.5,NaN])assert.throws(()=>prepareSummaryRequest(source,10000,value))
const raw=JSON.stringify({summaries:[{id:'b',text:'Other perspective [board:b].'},{id:'a',text:'Qualification remains [board:a].'}]})
const items=parseSummaryResponse(raw,source)
assert.deepEqual(items.map(item=>item.id),['a','b'])
for(const invalid of ['not json','```json\n'+raw+'\n```',JSON.stringify({summaries:[{id:'a',text:'one'}]}),JSON.stringify({summaries:[{id:'a',text:'one'},{id:'a',text:'two'}]}),JSON.stringify({summaries:[{id:'a',text:'outside [board:private]'},{id:'b',text:'two'}]}),JSON.stringify({summaries:[{id:'a',text:'one'},{id:'b',text:''}]}),JSON.stringify({summaries:[{id:'a',text:'one',extra:'no'},{id:'b',text:'two'}]})])assert.throws(()=>parseSummaryResponse(invalid,source))
const options={request,rawResponse:raw,items,usage,generatedAt:new Date().toISOString()}
const summary=applyReviewedSummary(source,options)
assert.equal(summary.system,BOARD_SUMMARY_USE_SYSTEM)
assert.equal(summary.contextMode,'summary');assert.notEqual(summary.id,source.id)
assert.deepEqual(summary.includedIds,source.includedIds)
assert.ok(!summary.prompt.includes('ORIGINAL_SOURCE_SENTINEL')&&!summary.prompt.includes('PDF_PAGE_SENTINEL')&&!summary.prompt.includes('INDEPENDENT_NOTE_SENTINEL'))
assert.ok(summary.prompt.includes('source.pdf')&&summary.prompt.includes('"page":2')&&summary.prompt.includes('Qualification remains'))
assert.equal(summary.summary?.originalPrompt,source.prompt)
assert.equal(summary.summary?.rawResponse,raw)
assert.equal(summary.summary?.usage.total,60)
assert.deepEqual(source,before)
const evidence={sources:summary.agentSources!,specialistSourceIds:[['a'],['b']],summaryAudit:summary.summary}
const specialist=agentStageInput('Task',[],evidence,0)
assert.ok(specialist.includes('Qualification remains'))
assert.ok(!specialist.includes('ORIGINAL_SOURCE_SENTINEL')&&!specialist.includes('originalPrompt'))
assert.ok(!agentStageInput('Task',[],evidence,-1).includes('Qualification remains'))
assert.throws(()=>prepareSummaryRequest(summary,10000,300),/not recursively/)
assert.throws(()=>applyReviewedSummary(source,{...options,items:[{id:'a',text:'x'},{id:'b',text:'x'.repeat(50000)}]}),/nothing was truncated/)
assert.throws(()=>applyReviewedSummary(source,{...options,request:{...request,prompt:request.prompt+'tamper'}}),/changed/)
assert.throws(()=>applyReviewedSummary(source,{...options,usage:{...usage,total:NaN}}),/usage/)
const edited=applyReviewedSummary(source,{...options,items:[{id:'a',text:'User corrected the qualification [board:a].'},items[1]]})
assert.ok(edited.prompt.includes('User corrected'));assert.equal(edited.summary?.rawResponse,raw)
assert.ok(edited.summary?.reviewedItems[0].text.includes('User corrected'))
console.log('PASS Board summary contract: exact source input, output/source/citation validation, provenance without originals downstream, editable lossy briefs, immutable audit, budget block, no recursive summaries or mutated request acceptance; no provider calls')
