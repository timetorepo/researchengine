import assert from 'node:assert/strict'
import {logoRoutes} from '../src/routes/logos'
import {sourceLogoDomain} from '../../shared/logos/source-logo'
const oldEnabled=process.env.LOGO_DEV_ENABLED,oldKey=process.env.LOGO_DEV_PUBLISHABLE_KEY
try{
 delete process.env.LOGO_DEV_ENABLED;delete process.env.LOGO_DEV_PUBLISHABLE_KEY
 assert.equal((await logoRoutes.request('/resolve?source=example.com')).status,503)
 process.env.LOGO_DEV_ENABLED='1';process.env.LOGO_DEV_PUBLISHABLE_KEY='sk_not-a-publishable-key';assert.equal((await logoRoutes.request('/resolve?source=example.com')).status,503)
 const key='pk_fixture_only_not_real';process.env.LOGO_DEV_PUBLISHABLE_KEY=key
 const response=await logoRoutes.request('/resolve?source='+encodeURIComponent('https://Example.COM/private?q=sensitive#fragment')),value=await response.json()
 assert.equal(response.status,200);assert.equal(value.domain,'example.com');assert.equal(value.imageUrl,'/api/logos/image?domain=example.com');assert.ok(!JSON.stringify(value).includes(key));assert.ok(!JSON.stringify(value).includes('sensitive'))
 const image=await logoRoutes.request(value.imageUrl.replace('/api/logos',''));assert.equal(image.status,302);const url=new URL(image.headers.get('location')!);assert.equal(url.origin,'https://img.logo.dev');assert.equal(url.pathname,'/example.com');assert.equal(url.searchParams.get('token'),key);assert.equal(url.searchParams.get('fallback'),'404');assert.equal(url.searchParams.get('redirect'),'404');assert.equal(image.headers.get('cache-control'),'no-store')
 for(const source of ['localhost','127.0.0.1','[::1]','http://user:secret@example.com','https://example.com:8443','file:///etc/passwd','internal.local','bad.test','bad/../localhost'])assert.throws(()=>sourceLogoDomain(source))
 assert.equal((await logoRoutes.request('/image?domain=example.com&token=secret')).status,400)
 console.log('PASS logo.dev routes: opt-in/missing/sk-key refusal, source-domain-only descriptors without token/path/query, fixed-host publishable redirect/no image proxy, missing/redirected-brand refusal policy, invalid/private/credential/port rejection. No real key/provider requests.')
}finally{if(oldEnabled===undefined)delete process.env.LOGO_DEV_ENABLED;else process.env.LOGO_DEV_ENABLED=oldEnabled;if(oldKey===undefined)delete process.env.LOGO_DEV_PUBLISHABLE_KEY;else process.env.LOGO_DEV_PUBLISHABLE_KEY=oldKey}
