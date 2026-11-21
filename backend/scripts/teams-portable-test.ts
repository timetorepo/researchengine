import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {TeamClient} from '../../shared/teams/client'
import {inspectPortableCredential,sealPortableCredential,unlockPortableCredential} from '../../shared/teams/portable-credential'
const scope={origin:'https://team.test',team:'team-one'},credential=randomBytes(32).toString('base64url')
const session={credential,digest:createHash('sha256').update(scope.team+'\0'+credential).digest('hex'),expiresAt:Date.now()+100000,receipt:{sequence:1,digest:'a'.repeat(64)},member:'editor',role:'Editor' as const}
const password='test-only strong portable passphrase';let calls=0
const config={native:false,timeoutMs:1000,responseBytes:8192,fetch:async()=>{calls++;return Response.json({state:{schemaVersion:1,sequence:1,boards:[],posts:[],requiredAttachments:[]},member:'editor',role:'Editor'})}}
const sealed=await sealPortableCredential(scope,session,password)
assert.deepEqual(inspectPortableCredential(sealed),scope)
assert.equal(new TextDecoder().decode(sealed).includes(credential),false)
assert.equal(new TextDecoder().decode(sealed).includes(password),false)
assert.notDeepEqual(await sealPortableCredential(scope,session,password),sealed)
const restored=await unlockPortableCredential(sealed,password,scope,config)
assert.equal(calls,0);assert.equal(restored.identity().member,'editor');await restored.read();assert.equal(calls,1);restored.disconnect()
for(const [bytes,pass,destination] of [[sealed,'wrong password value',scope],[sealed,password,{...scope,origin:'https://other.test'}],[sealed,password,{...scope,team:'other'}],[new Uint8Array(8193),password,scope]] as const)await assert.rejects(unlockPortableCredential(bytes,pass,destination,config))
const data=JSON.parse(new TextDecoder().decode(sealed)),encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value))
for(const patch of [{origin:'https://other.test'},{team:'other'},{kdf:'PBKDF2-SHA256-1'},{iv:'AAAA'},{salt:'bad'},{sealed:data.sealed.slice(0,-4)+'AAAA'},{extra:true},{version:2}])await assert.rejects(unlockPortableCredential(encode({...data,...patch}),password,{origin:patch.origin??scope.origin,team:patch.team??scope.team},config))
assert.equal(calls,1,'All failed unlocks are local, with no network')
await assert.rejects(sealPortableCredential(scope,session,'short'))
await assert.rejects(TeamClient.fromSession(scope,{...session,expiresAt:Number.MAX_SAFE_INTEGER},config))
await assert.rejects(sealPortableCredential({...scope,origin:'http://team.test'},session,password))
console.log('PASS portable credential: randomized AES-GCM/PBKDF2 envelope, scope and schema binding, wrong-pass/tamper/KDF/version/budget refusal, no clear credential/password in file, no unlock-network side effect, explicit validated read, date-range refusal; test secrets only')
