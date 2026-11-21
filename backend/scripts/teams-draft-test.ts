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

const {sealBackChatDraft,unlockBackChatDraft}=await import('../../shared/teams/backchat-draft')
const chat={member:'editor',threadId:'general',text:'Unsent chat evidence',pending:{operationId:'op-one',postId:'post-one'}}
const chatFile=await sealBackChatDraft(scope,chat,password)
assert.deepEqual(await unlockBackChatDraft(chatFile,password,scope,'editor'),chat)
assert.notDeepEqual(await sealBackChatDraft(scope,chat,password),chatFile)
for(const [bytes,pass,destination,member] of [[chatFile,'wrong passphrase value',scope,'editor'],[chatFile,password,scope,'other'],[chatFile,password,{...scope,team:'other'},'editor'],[file,password,scope,'editor']] as const)await assert.rejects(unlockBackChatDraft(bytes,pass,destination,member))
for(const value of [{...chat,text:'x'.repeat(16001)},{...chat,pending:{operationId:'invalid id',postId:'post'}},{...chat,pending:{operationId:'op',postId:'post'},text:' '},{...chat,extra:true}])await assert.rejects(sealBackChatDraft(scope,value,password))
const chatEnvelope=JSON.parse(new TextDecoder().decode(chatFile))
for(const patch of [{version:2},{kdf:'PBKDF2-SHA256-1'},{sealed:chatEnvelope.sealed.slice(0,-4)+'AAAA'},{extra:true}])await assert.rejects(unlockBackChatDraft(encode({...chatEnvelope,...patch}),password,scope,'editor'))
console.log('PASS BackChat draft: text/thread/pending identities roundtrip, random encryption, wrong-member/scope/pass/format refusal, malformed identities/empty pending/size/tamper/schema/KDF/version refusal')

const linkedChat={...chat,links:[{boardId:'board-one',revision:2,itemId:'note-one'}]}
assert.deepEqual(await unlockBackChatDraft(await sealBackChatDraft(scope,linkedChat,password),password,scope,'editor'),linkedChat)
for(const links of [[{boardId:'board',revision:0}],[{boardId:'board',revision:1,itemId:'invalid id'}],[{boardId:'board',revision:1},{boardId:'board',revision:1}]])await assert.rejects(sealBackChatDraft(scope,{...chat,links},password))
console.log('PASS encrypted BackChat references: exact pending link roundtrip, invalid revision/item and duplicate refusal; older link-free draft roundtrip retained')
