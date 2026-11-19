/** Development/operator entrypoint. No listener, shell spawning or automatic activation. */
import { initializeOfflineHost, backupOfflineHost, verifyOfflinePackage, restoreOfflinePackage, verifyOfflineRestore, recoverOfflineOwner } from '../src/teams/operator'
const usage='Usage: teams-offline <init ROOT TEAM | backup ROOT NEW_PACKAGE | verify ROOT PACKAGE | restore KEY_ROOT PACKAGE NEW_DATA_ROOT | verify-restore KEY_ROOT DATA_ROOT | recover-owner KEY_ROOT DATA_ROOT OWNER EXPECTED_SEQUENCE EXPECTED_DIGEST NEW_ENCRYPTED_CREDENTIAL_FILE --confirm-invalidate-all>. Passphrase only via non-TTY stdin, never argv/environment.'
async function password(): Promise<Buffer> {
  if(process.stdin.isTTY)throw new Error('Refusing echoed terminal input. Supply passphrase via a trusted non-TTY stdin producer.')
  const chunks:Buffer[]=[];let length=0,result:Buffer|undefined
  try {
    for await(const chunk of process.stdin){const bytes=Buffer.from(chunk);chunks.push(bytes);length+=bytes.length;if(length>1026)throw new Error('Passphrase input too long')}
    result=Buffer.concat(chunks)
    let end=result.length;if(end&&result[end-1]===10){end--;if(end&&result[end-1]===13)end--}
    const value=Buffer.from(result.subarray(0,end))
    if(value.length<12||value.length>1024||value.includes(10)||value.includes(13)){value.fill(0);throw new Error('Expected one passphrase of 12–1024 bytes')}
    return value
  }finally{chunks.forEach(chunk=>chunk.fill(0));result?.fill(0)}
}
let secret:Buffer|undefined
try {
  const [command,...args]=process.argv.slice(2)
  const counts:Record<string,number>={init:2,backup:2,verify:2,restore:3,'verify-restore':2,'recover-owner':7}
  if(!Object.hasOwn(counts,command)||args.length!==counts[command])throw new Error(usage)
  if(command==='recover-owner'&&(args[6]!=='--confirm-invalidate-all'||!Number.isSafeInteger(Number(args[3]))||Number(args[3])<1||!/^[a-f0-9]{64}$/.test(args[4])))throw new Error(usage)
  secret=await password()
  let result:unknown
  if(command==='init'){await initializeOfflineHost(args[0],args[1],secret);result={team:args[1],initialized:true}}
  else if(command==='backup')result=await backupOfflineHost(args[0],args[1],secret)
  else if(command==='verify')result=await verifyOfflinePackage(args[0],args[1],secret)
  else if(command==='restore')result=await restoreOfflinePackage(args[0],args[1],args[2],secret)
  else if(command==='recover-owner')result=await recoverOfflineOwner(args[0],args[1],args[2],{sequence:Number(args[3]),digest:args[4]},args[5],secret,true)
  else result=await verifyOfflineRestore(args[0],args[1],secret)
  process.stdout.write(JSON.stringify({command,offline:true,result})+'\n')
 }catch(error){
  // Never echo arbitrary parser/OS/crypto messages or supplied arguments into operator logs.
  const message=error instanceof Error&&[usage,'Refusing echoed terminal input. Supply passphrase via a trusted non-TTY stdin producer.','Passphrase input too long','Expected one passphrase of 12–1024 bytes'].includes(error.message)?error.message:'Offline Teams operation failed. Check passphrase, owner-only paths, writer locks and package integrity. Preserve partial new destinations; existing destination files are never overwritten. A recovery commit may already have invalidated old credentials.'
  process.stderr.write(message+'\n');process.exitCode=1
 }
 finally{secret?.fill(0)}
