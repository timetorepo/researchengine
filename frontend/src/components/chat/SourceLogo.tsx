import {useState} from 'react'
import {sourceLogoDomain,sourceLogoPath} from '../../../../shared/logos/source-logo'
export function logoDomainFromImage(src:string):string|undefined{
 try{const url=new URL(src,location.origin);if(url.origin!==location.origin||url.pathname!=='/api/logos/image'||[...url.searchParams.keys()].join(',')!=='domain'||url.hash)return;const domain=sourceLogoDomain(url.searchParams.get('domain')??'');return src===sourceLogoPath(domain)?domain:undefined}catch{return}
}
/** Request-gated brand decoration, never a verified source seal. No hidden beacon. */
export function SourceLogo({domain}:{domain:string}){
 const [load,setLoad]=useState(false),[failed,setFailed]=useState(false)
 return <span className="inline-flex flex-col items-start gap-1 my-2 max-w-full" aria-label={`Optional source logo for ${domain}`}>
  {!load?<button className="bui-button" onClick={()=>setLoad(true)}>Load {domain} logo via Logo.dev</button>:failed?<span role="status">Logo unavailable for {domain}; source identity is unverified.</span>:<img src={sourceLogoPath(domain)} width={64} height={64} alt={`${domain} brand logo (not verification)`} referrerPolicy="strict-origin-when-cross-origin" crossOrigin="anonymous" onError={()=>setFailed(true)}/>}
  <small>Optional brand mark, not endorsement. Loading shares this domain and your browser origin with the provider.</small>
  <a href="https://logo.dev" target="_blank" rel="noopener noreferrer" className="text-xs underline">Logos provided by Logo.dev</a>
 </span>
}
