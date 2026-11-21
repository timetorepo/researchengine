/** CDN URL resolver/redirect only: never proxy/cache logo.dev image bytes. */
import {Hono} from 'hono'
import {sourceLogoDomain,sourceLogoPath} from '../../../shared/logos/source-logo'
export const logoRoutes=new Hono()
function configured(){return process.env.LOGO_DEV_ENABLED==='1'&&/^pk_[A-Za-z0-9_-]{8,200}$/.test(process.env.LOGO_DEV_PUBLISHABLE_KEY??'')}
logoRoutes.get('/resolve',c=>{
 c.header('Cache-Control','no-store')
 if(!configured())return c.json({ok:false,error:'Logo.dev is not enabled/configured. Ask the operator to set LOGO_DEV_ENABLED=1 and a publishable pk_ key. Do not ask for or send a secret key.'},503)
 try{if([...new URL(c.req.url).searchParams.keys()].join(',')!=='source')throw new Error();const domain=sourceLogoDomain(c.req.query('source')??'');return c.json({ok:true,domain,imageUrl:sourceLogoPath(domain),provider:'logo.dev',attributionUrl:'https://logo.dev',notice:'Decorative brand identification only, not verification, endorsement or source evidence. Rendering requires the user to load the logo; browser sends this domain and its origin to Logo.dev. A missing logo must not be invented.'})}catch{return c.json({ok:false,error:'Supply a public HTTP(S) source URL or domain without embedded credentials or a port.'},400)}
})
logoRoutes.get('/image',c=>{
 c.header('Cache-Control','no-store');c.header('Referrer-Policy','strict-origin-when-cross-origin')
 if(!configured())return c.json({error:'Logo provider unavailable'},503)
 try{if([...new URL(c.req.url).searchParams.keys()].join(',')!=='domain')throw new Error();const domain=sourceLogoDomain(c.req.query('domain')??''),url=new URL('https://img.logo.dev/'+domain);url.search=new URLSearchParams({token:process.env.LOGO_DEV_PUBLISHABLE_KEY!,format:'png',size:'64',fallback:'404',redirect:'404'}).toString();return c.redirect(url.href,302)}catch{return c.json({error:'Invalid domain'},400)}
})
