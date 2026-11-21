import assert from 'node:assert/strict'
import { compactBoardEvidence, type BoardEvidence } from '../src/lib/board/context'
const text='Verbatim evidence\n  spaces and duplicate lines\nEND_SENTINEL'
const sources:BoardEvidence[]=[
 {citation:'board:a',item:{id:'a',kind:'note',text,textFormat:'markdown',x:100,y:200,width:300,height:200}},
 {citation:'board:b',item:{id:'b',kind:'reference',text,x:0,y:0,width:200,height:100,source:{url:'https://example.test/source'},parentId:'frame'}},
 {citation:'board:c',item:{id:'c',kind:'connector',text:'Conflicts with',x:0,y:0,width:100,height:100,fromId:'a',toId:'b'}},
 ...['pdf1','pdf2'].map(id=>({citation:`board:${id}`,item:{id,kind:'pdf' as const,text:'annotation',x:0,y:0,width:200,height:100,attachmentId:'original',source:{page:2}},original:{name:'source.pdf',type:'application/pdf',bytes:4000,page:2,text:'Page two source text\nNOT_PAGE_ONE',note:'Linked page only'}})),
 {citation:'board:d',item:{id:'d',kind:'drawing',text:'Stroke annotation',x:0,y:0,width:200,height:100,pointSpace:'unit',points:Array.from({length:500},(_,i)=>({x:i/500,y:i/500}))}},
]
const before=JSON.stringify(sources),compact=compactBoardEvidence(sources),serialized=JSON.stringify(compact)
assert.equal(JSON.stringify(sources),before,'Projection must not mutate Board evidence')
assert.equal(compact.items.length,sources.length)
for(let i=0;i<sources.length;i++)assert.equal(compact.texts[compact.items[i].textRef],sources[i].item.text)
assert.equal(compact.items[0].textRef,compact.items[1].textRef)
assert.equal(compact.items[0].textFormat,'markdown')
assert.equal(compact.items[1].source?.url,'https://example.test/source')
assert.equal(compact.items[1].parent,'board:frame')
assert.equal(compact.items[2].from,'board:a');assert.equal(compact.items[2].to,'board:b')
assert.equal(compact.items[3].originalRef,compact.items[4].originalRef)
assert.equal(Object.keys(compact.originals).length,1)
const original=compact.originals[compact.items[3].originalRef!]
assert.equal(original.page,2);assert.equal(compact.texts[original.textRef!],'Page two source text\nNOT_PAGE_ONE')
for(const key of ['"x":','"y":','"width":','"height":','"points":','"bytes":','"attachmentId":'])assert.ok(!serialized.includes(key),key)
assert.ok(serialized.includes('END_SENTINEL'))
assert.ok(serialized.length<before.length)
assert.deepEqual(compactBoardEvidence([]),{items:[],texts:{},originals:{}})
console.log(`PASS compact context: exact text/Markdown/provenance, relationships, duplicate page/text pooling, no geometry/bytes, no mutation; fixture JSON characters ${before.length} → ${serialized.length} (not a tokenizer/billing measurement)`)
