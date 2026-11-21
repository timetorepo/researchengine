import assert from 'node:assert/strict'
import {mergeSharedBoard} from '../../shared/teams/board-merge'
const note=(id:string,text:string)=>({id,kind:'note' as const,text,x:10,y:10,width:200,height:100})
const base={id:'board',revision:1,title:'Evidence',items:[note('one','A'),note('two','B')]}
const ours={...structuredClone(base),items:[note('one','our edit'),note('two','B')]},theirs={...structuredClone(base),revision:2,items:[note('one','A'),note('two','their edit')]}
const result=mergeSharedBoard(base,ours,theirs);assert.deepEqual(result.conflicts,[]);assert.equal(result.board!.revision,2);assert.deepEqual(result.board!.items.map(i=>i.text),['our edit','their edit'])
assert.deepEqual(base.items.map(i=>i.text),['A','B'])
assert.ok(mergeSharedBoard(base,ours,{...theirs,items:[note('one','competing edit'),note('two','B')]}).conflicts.includes('item:one'))
assert.ok(mergeSharedBoard(base,ours,{...theirs,items:[note('two','B')]}).conflicts.includes('item:one'))
assert.ok(mergeSharedBoard(base,{...ours,title:'Ours'},{...theirs,title:'Theirs'}).conflicts.includes('title'))
assert.ok(mergeSharedBoard(base,{...ours,revision:0},theirs).conflicts.length)
const deleted={...structuredClone(base),items:[note('two','B')]},connected={...theirs,items:[...base.items,{id:'connection',kind:'connector' as const,text:'',x:0,y:0,width:1,height:1,fromId:'one',toId:'two'}]}
assert.ok(mergeSharedBoard(base,deleted,connected).conflicts.length,'Deletion/addition cannot create dangling connector')
assert.equal(mergeSharedBoard(base,ours,{...ours,revision:2}).board!.items[0].text,'our edit')
console.log('PASS conservative shared canvas merge: disjoint item edits, same-item/delete-edit/title conflicts, scope/revision gates, dangling-link refusal, no input mutation or network writes')
