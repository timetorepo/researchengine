/** Explicit trusted-local operator entrypoint. Secrets only from non-TTY stdin. */
import { initializeOfflineHost, bootstrapOfflineOwner, issueOfflineInvite, exportPortableOwner } from '../src/teams/operator'
import { parseManagedTeamConfig, readPrivateFile, startManagedTeam } from '../src/teams/managed-server'
const usage='Usage: teams <init ROOT TEAM | bootstrap ROOT OWNER DURATION_MS NEW_OWNER_FILE | invite ROOT OWNER_FILE HTTPS_ORIGIN ROLE INVITE_MS SESSION_MS NEW_PRIVATE_INVITE_FILE | export-owner ROOT OWNER_FILE HTTPS_ORIGIN NEW_PORTABLE_FILE | serve PRIVATE_CONFIG_JSON --confirm-network-exposure>. Passphrase via non-TTY stdin only; never arguments or environment.'
async function password(){
 if(process.stdin.isTTY)throw new Error('Non-TTY stdin required')
 const chunks:Buffer[]=[];let length=0,all:Buffer|undefined
 try{
  for await(const chunk of process.stdin){const bytes=Buffer.from(chunk);chunks.push(bytes);length+=bytes.length;if(length>1026)throw new Error('Invalid passphrase input')}
  all=Buffer.concat(chunks);let end=all.length;if(end&&all[end-1]===10){end--;if(end&&all[end-1]===13)end--}
  const value=Buffer.from(all.subarray(0,end));if(value.length<12||value.length>1024||value.includes(10)||value.includes(13)){value.fill(0);throw new Error('Invalid passphrase input')};return value
 }finally{chunks.forEach(value=>value.fill(0));all?.fill(0)}
}
let secret:Buffer|undefined
try{
 const [command,...args]=process.argv.slice(2),counts:Record<string,number>={init:2,bootstrap:4,invite:7,'export-owner':4,serve:2}
 if(!Object.hasOwn(counts,command)||args.length!==counts[command]||(command==='serve'&&args[1]!=='--confirm-network-exposure'))throw new Error(usage)
 secret=await password();let result:unknown
 if(command==='init'){await initializeOfflineHost(args[0],args[1],secret);result={initialized:true,team:args[1]}}
 else if(command==='bootstrap')result=await bootstrapOfflineOwner(args[0],args[1],Number(args[2]),args[3],secret)
 else if(command==='invite'){if(!['Admin','Editor','Viewer'].includes(args[3]))throw new Error('Invalid role');result=await issueOfflineInvite(args[0],args[1],args[2],args[3] as 'Editor',Number(args[4]),Number(args[5]),args[6],secret)}
 else if(command==='export-owner')result=await exportPortableOwner(args[0],args[1],args[2],args[3],secret)
 else{
  const config=parseManagedTeamConfig(await readPrivateFile(args[0])),running=await startManagedTeam(config,secret,true)
  secret.fill(0);secret=undefined
  await new Promise<void>((resolve,reject)=>{
   const stop=()=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);running.close().then(resolve,reject)}
   process.once('SIGINT',stop);process.once('SIGTERM',stop);running.server.once('error',()=>{running.close().then(()=>reject(new Error('Listener failure')),reject)})
   process.stdout.write(JSON.stringify({command:'serve',listening:true,team:running.team,origin:config.publicOrigin})+'\n')
  })
  result={stopped:true,drained:true}
 }
 process.stdout.write(JSON.stringify({command,result})+'\n')
}catch(error){process.stderr.write(error instanceof Error&&error.message===usage?usage+'\n':'Teams operation failed. Check private paths, passphrase, certificate/trust, configuration and writer locks. No secrets are logged. A bootstrap/invitation may already have committed: preserve new files and use explicit recovery; do not reinitialize storage.\n');process.exitCode=1}
finally{secret?.fill(0)}
