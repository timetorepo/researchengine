import assert from 'node:assert/strict'
import {sealBoardDraft,inspectBoardDraft,unlockBoardDraft} from '../../shared/teams/board-draft'
const scope={origin:'https://team.test',team:'test-team'},password='test-only encrypted draft passphrase'
const draft={member:'editor',operationId:'unresolved-operation',board:{id:'board-one',revision:0,title:'Private draft sentinel',items:[{id:'note',kind:'note' as const,text:'Unsent evidence',x:10,y:10,width:200,height:100}]}}
const file=await sealBoardDraft(scope,draft,password)
assert.deepEqual(inspectBoardDraft(file),scope);assert.deepEqual(await unlockBoardDraft(file,password,scope,'editor'),draft)
assert.notDeepEqual(await sealBoardDraft(scope,draft,password),file)
assert.equal(new TextDecoder().decode(file).includes(draft.board.title),false)
for(const args of [[file,'wrong test passphrase',scope,'editor'],[file,password,{...scope,team:'other'},'editor'],[file,password,scope,'other-member'],[new Uint8Array(100001),password,scope,'editor']] as const)await assert.rejects(unlockBoardDraft(...args))
const value=JSON.parse(new TextDecoder().decode(file)),encode=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v))
for(const patch of [{version:2},{kdf:'PBKDF2-SHA256-1'},{sealed:value.sealed.slice(0,-4)+'AAAA'},{origin:'https://other.test'},{extra:true}])await assert.rejects(unlockBoardDraft(encode({...value,...patch}),password,scope,'editor'))
for(const board of [{...draft.board,revision:-1},{...draft.board,items:[{...draft.board.items[0],width:0}]},{...draft.board,title:'x'.repeat(64001)}])await assert.rejects(sealBoardDraft(scope,{...draft,board},password))
await assert.rejects(sealBoardDraft(scope,draft,'short'))
assert.deepEqual(await unlockBoardDraft(await sealBoardDraft(scope,{board:draft.board,member:'editor'},password),password,scope,'editor'),{board:draft.board,member:'editor'})
console.log('PASS encrypted Board draft: randomized/scope-authenticated envelope, exact roundtrip including unresolved identity and revision zero, wrong pass/member/scope/KDF/version/tamper/size/schema refusals; no storage/network APIs')
