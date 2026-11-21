/** Domain-only logo lookup. Never forward source paths, search text or credentials. */
export function sourceLogoDomain(raw:string):string{
 if(typeof raw!=='string'||raw.length>2048)throw new Error('Invalid source domain')
 const parsed=new URL(raw.includes('://')?raw:'https://'+raw)
 if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port)throw new Error('Public domain required')
 const domain=parsed.hostname.toLowerCase()
 if(domain.length>253||!domain.includes('.')||!domain.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||/^\d+(?:\.\d+)+$/.test(domain)||/\.(?:localhost|local|internal|test|invalid|onion)$/.test(domain)||domain.endsWith('.arpa'))throw new Error('Public domain required')
 return domain
}
export function sourceLogoPath(raw:string){return '/api/logos/image?domain='+encodeURIComponent(sourceLogoDomain(raw))}
