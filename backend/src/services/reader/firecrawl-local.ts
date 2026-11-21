/** Opt-in official Firecrawl Local CLI scraper. No install, cloud search, daemon,
 * MCP configuration, credentials, shell command or fallback to another engine. */
import {spawn} from 'node:child_process'
import {mkdtemp,rm,stat,access} from 'node:fs/promises'
import {constants} from 'node:fs'
import {isAbsolute,join} from 'node:path'
import {tmpdir} from 'node:os'
import {parseTarget} from './extract'
import type {ReadResult} from './extract'
let active=0
export async function readFirecrawlLocal(raw:string,signal?:AbortSignal):Promise<Omit<ReadResult,'via'>&{via:'firecrawl-local'}>{
 const target=parseTarget(raw),binary=process.env.FIRECRAWL_LOCAL_BIN
 if(!target||target.username||target.password||raw.length>8192)throw new Error('Firecrawl Local requires a public HTTP(S) URL without credentials.')
 if(!binary||!isAbsolute(binary))throw new Error('Configure FIRECRAWL_LOCAL_BIN as the absolute path to your reviewed official firecrawl-local executable. No automatic install.')
 if(active>=2)throw new Error('Firecrawl Local is busy. Wait and retry explicitly.')
 active++;let directory:string|undefined
 try{
  const info=await stat(binary);if(!info.isFile())throw new Error('Invalid executable');await access(binary,constants.X_OK)
  if(signal?.aborted)throw new Error('Scrape cancelled')
  directory=await mkdtemp(join(tmpdir(),'re-firecrawl-local-'))
  const output=await new Promise<string>((resolve,reject)=>{
   // No inherited API keys, saved login/HOME, proxy variables or cloud policy.
   const child=spawn(binary,['--browser','never','scrape',target.href,'--public-only','--timeout','12000','--format','markdown'],{cwd:directory,env:{PATH:process.env.PATH??'',...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{}),HOME:directory,USERPROFILE:directory,FIRECRAWL_LOCAL_HOME:directory,FIRECRAWL_CLI_CREDENTIALS:join(directory!,'no-credentials.json'),FIRECRAWL_CLOUD:'off',FIRECRAWL_LOCAL_BROWSER:'never'},stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true})
   const chunks:Buffer[]=[];let size=0,failure:Error|undefined,killer:ReturnType<typeof setTimeout>|undefined
   const stop=(message:string)=>{if(failure)return;failure=new Error(message);child.kill('SIGTERM');killer=setTimeout(()=>child.kill('SIGKILL'),250);killer.unref()}
   const abort=()=>stop('Firecrawl Local scrape cancelled; no retry.')
   const timer=setTimeout(()=>stop('Firecrawl Local exceeded its execution budget; no retry.'),15000)
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
   child.stdout.on('data',(bytes:Buffer)=>{size+=bytes.length;if(size>2_000_000)stop('Firecrawl Local exceeded its output budget.');else chunks.push(bytes)})
   child.stderr.on('data',(bytes:Buffer)=>{size+=bytes.length;if(size>2_000_000)stop('Firecrawl Local exceeded its output budget.')})
   child.on('error',()=>{failure=new Error('Firecrawl Local executable could not start.')})
   child.on('close',code=>{clearTimeout(timer);if(killer)clearTimeout(killer);signal?.removeEventListener('abort',abort);if(failure)reject(failure);else if(code!==0)reject(new Error('Firecrawl Local failed. Check the installed version and public target; cloud and browser fallback are disabled.'));else resolve(Buffer.concat(chunks).toString('utf8'))})
  })
  if(signal?.aborted)throw new Error('Scrape cancelled')
  let result:any;try{result=JSON.parse(output)}catch{throw new Error('Invalid Firecrawl Local response.')}
  const data=result?.data
  if(result?.success!==true||!data||data.blocked||data.source==='firecrawl-cloud'||typeof data.markdown!=='string'||!data.markdown.trim())throw new Error('Firecrawl Local returned no local readable text. No cloud fallback was attempted.')
  const text=data.markdown,words=text.trim().split(/\s+/).length
  // Plain text block: scraped Markdown/HTML is untrusted content, never executed.
  return{ok:true,url:target.href,via:'firecrawl-local',title:typeof data.metadata?.title==='string'?data.metadata.title:target.hostname,wordCount:words,minutes:Math.max(1,Math.ceil(words/220)),blocks:[{type:'paragraph',text}],outline:[],images:[],warning:typeof data.warning==='string'?data.warning:undefined,fetchedAt:Date.now()}
 }finally{active--;if(directory)await rm(directory,{recursive:true,force:true})}
}
