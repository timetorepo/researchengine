/** Local operator configuration: no automatic startup or main-app API mount. */
import { readFile, lstat } from 'node:fs/promises'
import { openManagedTeam } from './operator'
import { startTeamHttps, type TeamHttpsOptions } from './https'
export type ManagedTeamConfig = Omit<TeamHttpsOptions,'cert'|'key'> & {keyRoot:string;dataRoot:string;certFile:string;keyFile:string}
export async function readPrivateFile(path:string){
 const metadata=await lstat(path)
 if(!metadata.isFile()||(metadata.mode&0o077)!==0||(process.getuid&&metadata.uid!==process.getuid()))throw new Error('Expected owner-only file, not a symlink')
 return readFile(path)
}
export function parseManagedTeamConfig(bytes:Buffer):ManagedTeamConfig{
 if(bytes.length>16384)throw new Error('Invalid host configuration')
 const config=JSON.parse(bytes.toString('utf8'))
 const names=['keyRoot','dataRoot','certFile','keyFile','confirmNetworkExposure','bind','port','publicOrigin','allowedOrigins','allowNativeClients','limits']
 if(!config||Array.isArray(config)||Object.keys(config).sort().join(',')!==names.sort().join(',')||['keyRoot','dataRoot','certFile','keyFile'].some(name=>typeof config[name]!=='string'||!config[name])||config.confirmNetworkExposure!==true)throw new Error('Explicit complete host configuration required')
 // Transport validates certificate/host/origin/IP/budgets before binding.
 return config
}
export async function startManagedTeam(config:ManagedTeamConfig,password:Buffer,confirmNetworkExposure:boolean){
 if(confirmNetworkExposure!==true)throw new Error('Explicit network exposure confirmation required')
 let cert:Buffer|undefined,key:Buffer|undefined,opened:Awaited<ReturnType<typeof openManagedTeam>>|undefined
 try{
  cert=await readFile(config.certFile);key=await readPrivateFile(config.keyFile)
  opened=await openManagedTeam(config.keyRoot,config.dataRoot,password)
  const {keyRoot:_,dataRoot:__,certFile:___,keyFile:____,...transport}=config
  const server=await startTeamHttps(opened.host,{...transport,cert,key})
  let closing:Promise<void>|undefined
  const close=()=>closing??=(async()=>{
   // Stop accepting and drain HTTP work before closing/fsyncing the host queue.
   const deadline=setTimeout(()=>server.closeAllConnections(),config.limits.requestTimeoutMs+1000);deadline.unref()
   try{await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections()})}finally{clearTimeout(deadline);await opened!.close()}
  })()
  return{server,team:opened.team,close}
 }catch(error){await opened?.close();throw error}
 finally{key?.fill(0);cert?.fill(0)}
}
