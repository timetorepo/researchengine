import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, stat, chmod, appendFile, unlink, access, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createHostKeyring, unlockHostKeyring, clearHostKeys } from '../src/teams/keyring'
import { initializeOfflineHost, backupOfflineHost, verifyOfflinePackage, restoreOfflinePackage, verifyOfflineRestore } from '../src/teams/operator'
import { TeamJournal } from '../src/teams/journal'
import { TeamObjects } from '../src/teams/objects'
import { replayTeam, type TypedTeamOperation } from '../src/teams/replay'
const root=await mkdtemp(join(tmpdir(),'re-team-operator-')),password=Buffer.from(randomBytes(24).toString('base64')),wrong=Buffer.from(randomBytes(24).toString('base64'))
let checks=0
const cli=(args:string[],secret:Buffer)=>new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
 const child=spawn(process.execPath,['--import','tsx',new URL('./teams-offline.ts',import.meta.url).pathname,...args],{stdio:['pipe','pipe','pipe']});let stdout='',stderr=''
 child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',code=>resolve({code,stdout,stderr}));child.stdin.on('error',error=>{if((error as NodeJS.ErrnoException).code!=='EPIPE')reject(error)});child.stdin.end(secret)
})
try {
 const sealed=await createHostKeyring('team-one',password),again=await createHostKeyring('team-one',password)
 assert.notDeepEqual(sealed,again);assert.ok(!sealed.includes(password));const unlocked=await unlockHostKeyring(sealed,password)
 assert.equal(unlocked.team,'team-one');assert.ok(!unlocked.keys.journal.equals(unlocked.keys.objects));assert.ok(!unlocked.keys.backup.equals(unlocked.keys.objects))
 for(const key of Object.values(unlocked.keys))assert.ok(!sealed.includes(key))
 const reloaded=await unlockHostKeyring(sealed,password);assert.deepEqual(reloaded,unlocked);clearHostKeys(reloaded);clearHostKeys(unlocked);checks++
 await assert.rejects(unlockHostKeyring(sealed,wrong),/Could not unlock/)
 const parsed=JSON.parse(sealed.toString());parsed.team='changed-team';await assert.rejects(unlockHostKeyring(Buffer.from(JSON.stringify(parsed)),password))
 parsed.team='team-one';parsed.kdf='scrypt-N1073741824';await assert.rejects(unlockHostKeyring(Buffer.from(JSON.stringify(parsed)),password),/Unsupported/)
 await assert.rejects(unlockHostKeyring(sealed.subarray(0,20),password));await assert.rejects(createHostKeyring('team-one',Buffer.from('short')))
 await assert.rejects(unlockHostKeyring(Buffer.alloc(4097),password),/size/);checks++
 const hostRoot=join(root,'host');await initializeOfflineHost(hostRoot,'team-one',password)
 assert.equal((await stat(hostRoot)).mode&0o777,0o700);assert.equal((await stat(join(hostRoot,'host.keys'))).mode&0o777,0o600)
 const keyFile=await readFile(join(hostRoot,'host.keys'));await assert.rejects(initializeOfflineHost(hostRoot,'team-one',password),/EEXIST/);assert.deepEqual(await readFile(join(hostRoot,'host.keys')),keyFile);checks++
 const keys=await unlockHostKeyring(keyFile,password)
 const journal=await TeamJournal.open(join(hostRoot,'journal'),keys.keys.journal)
 const objects=await TeamObjects.open(join(hostRoot,'objects'),keys.keys.objects,keys.team)
 const attachment=await objects.putAttachment(Buffer.from('PRIVATE_OPERATOR_ORIGINAL'))
 const operation:TypedTeamOperation={id:'one',actor:'alice',kind:'team.board.replace.v1',payload:{boardId:'board',expectedRevision:0,title:'PRIVATE_OPERATOR_BOARD',items:[{id:'image',kind:'image',x:0,y:0,width:160,height:120,text:'Original',attachmentId:attachment}]}}
 await journal.append(operation)
 await objects.putSnapshot({version:1,checkpoint:journal.checkpoint(),state:replayTeam(journal.replay(),new Set([attachment])),attachments:[attachment]},journal)
 await assert.rejects(backupOfflineHost(hostRoot,join(root,'live.backup'),password),/EEXIST/)
 await journal.close();clearHostKeys(keys)
 const backup=join(root,'team.backup'),result=await backupOfflineHost(hostRoot,backup,password)
 assert.equal(result.checkpoint.sequence,1);assert.equal((await stat(backup)).mode&0o777,0o600)
 const packageBytes=await readFile(backup);assert.ok(!packageBytes.includes('PRIVATE_OPERATOR_ORIGINAL'));assert.ok(!packageBytes.includes(password))
 assert.deepEqual(await verifyOfflinePackage(hostRoot,backup,password),result)
 await assert.rejects(backupOfflineHost(hostRoot,backup,password),/EEXIST/);assert.deepEqual(await readFile(backup),packageBytes);checks++
 const restored=join(root,'restored');assert.deepEqual(await restoreOfflinePackage(hostRoot,backup,restored,password),result);assert.deepEqual(await verifyOfflineRestore(hostRoot,restored,password),result)
 await assert.rejects(access(join(restored,'host.keys')));await assert.rejects(restoreOfflinePackage(hostRoot,backup,restored,password),/EEXIST/)
 const badPackage=join(root,'bad.backup'),bad=Buffer.from(packageBytes);bad[20]^=1;await writeFile(badPackage,bad)
 const invalid=join(root,'invalid');await assert.rejects(restoreOfflinePackage(hostRoot,badPackage,invalid,password));await assert.rejects(access(invalid));checks++
 await chmod(join(hostRoot,'host.keys'),0o644);await assert.rejects(verifyOfflinePackage(hostRoot,backup,password),/owner-only/);await chmod(join(hostRoot,'host.keys'),0o600)
 await rename(join(hostRoot,'host.keys'),join(hostRoot,'saved.keys'));await symlink(join(hostRoot,'saved.keys'),join(hostRoot,'host.keys'))
 await assert.rejects(verifyOfflinePackage(hostRoot,backup,password),/owner-only/);await unlink(join(hostRoot,'host.keys'));await rename(join(hostRoot,'saved.keys'),join(hostRoot,'host.keys'));checks++
 // Backup must not silently repair damaged/missing source storage.
 const logPath=join(hostRoot,'journal','operations.log'),log=await readFile(logPath)
 await appendFile(logPath,'torn-tail');await assert.rejects(backupOfflineHost(hostRoot,join(root,'torn.backup'),password),/Incomplete journal tail/)
 assert.deepEqual(await readFile(logPath),Buffer.concat([log,Buffer.from('torn-tail')]));await writeFile(logPath,log)
 await rename(logPath,logPath+'.saved');await assert.rejects(backupOfflineHost(hostRoot,join(root,'missing.backup'),password));await assert.rejects(access(logPath));await rename(logPath+'.saved',logPath)
 await rename(join(hostRoot,'objects'),join(hostRoot,'objects-saved'));await assert.rejects(backupOfflineHost(hostRoot,join(root,'missing-objects.backup'),password));await assert.rejects(access(join(hostRoot,'objects')));await rename(join(hostRoot,'objects-saved'),join(hostRoot,'objects'));checks++
 const cliRoot=join(root,'cli-host'),cliPackage=join(root,'cli.backup'),cliRestore=join(root,'cli-restore')
 for(const args of [['init',cliRoot,'cli-team'],['backup',cliRoot,cliPackage],['verify',cliRoot,cliPackage],['restore',cliRoot,cliPackage,cliRestore],['verify-restore',cliRoot,cliRestore]]){
  const response=await cli(args,Buffer.concat([password,Buffer.from('\n')]))
  assert.equal(response.code,0,response.stderr);assert.equal(JSON.parse(response.stdout).offline,true);assert.ok(!response.stdout.includes(password.toString()));assert.ok(!response.stderr.includes(password.toString()))
 }
 const wrongCli=await cli(['verify',cliRoot,cliPackage],wrong);assert.notEqual(wrongCli.code,0);assert.equal(wrongCli.stdout,'');assert.ok(!wrongCli.stderr.includes(wrong.toString()))
 const argvSecret=await cli(['verify',cliRoot,cliPackage,'forbidden-extra-argument'],password);assert.notEqual(argvSecret.code,0);assert.ok(!argvSecret.stderr.includes('forbidden-extra-argument'))
 const multiLine=await cli(['verify',cliRoot,cliPackage],Buffer.concat([password,Buffer.from('\nsecond-line\n')]));assert.notEqual(multiLine.code,0);checks++
 console.log(`PASS ${checks} offline host-key/operator checks: randomized wrapped keys, wrong password/tamper/KDF refusal, owner-only no-overwrite initialization, typed backup/verify/restore, active-lock refusal, damaged/missing source preservation, permissions/symlink refusal, CLI non-TTY stdin and no secret output. No networking.`)
} finally {password.fill(0);wrong.fill(0);await rm(root,{recursive:true,force:true})}
