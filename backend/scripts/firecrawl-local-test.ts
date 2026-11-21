import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {readFirecrawlLocal} from '../src/services/reader/firecrawl-local'
const root=await mkdtemp(join(tmpdir(),'re-fc-test-')),binary=join(root,'firecrawl-local'),previous=process.env.FIRECRAWL_LOCAL_BIN
const oldKey=process.env.FIRECRAWL_API_KEY,oldCloud=process.env.FIRECRAWL_CLOUD
async function fixture(code:string){await writeFile(binary,`#!${process.execPath}\n${code}`,{mode:0o700})}
try{
 process.env.FIRECRAWL_LOCAL_BIN=binary;process.env.FIRECRAWL_API_KEY='must-not-be-inherited';process.env.FIRECRAWL_CLOUD='auto'
 await fixture(`const a=process.argv.slice(2);if(a.join('|')!=='--browser|never|scrape|https://example.test/article|--public-only|--timeout|12000|--format|markdown'||process.env.FIRECRAWL_CLOUD!=='off'||process.env.FIRECRAWL_API_KEY||process.env.FIRECRAWL_LOCAL_BROWSER!=='never'||!process.env.HOME.startsWith('${tmpdir()}/re-firecrawl-local-'))process.exit(5);console.log(JSON.stringify({success:true,data:{markdown:'# Evidence\\nExact text <script>untrusted</script>',metadata:{title:'Local fixture'}}}))`)
 const result=await readFirecrawlLocal('https://example.test/article');assert.equal(result.via,'firecrawl-local');assert.equal(result.title,'Local fixture');assert.equal(result.blocks[0].type,'paragraph');assert.match((result.blocks[0] as {text:string}).text,/<script>/)
 for(const url of ['file:///etc/passwd','http://localhost/admin','http://127.0.0.1/','https://user:password@example.test/'])await assert.rejects(readFirecrawlLocal(url))
 for(const data of [{success:true,data:{markdown:'Text',source:'firecrawl-cloud'}},{success:true,data:{markdown:'Text',blocked:true}},{success:false},{success:true,data:{markdown:''}}]){await fixture(`console.log(${JSON.stringify(JSON.stringify(data))})`);await assert.rejects(readFirecrawlLocal('https://example.test/article'))}
 await fixture("console.log('not JSON')");await assert.rejects(readFirecrawlLocal('https://example.test/article'))
 await fixture("process.stdout.write('x'.repeat(2100000));setInterval(()=>{},1000)");await assert.rejects(readFirecrawlLocal('https://example.test/article'))
 await fixture('setInterval(()=>{},1000)');const abort=new AbortController(),pending=readFirecrawlLocal('https://example.test/article',abort.signal);setTimeout(()=>abort.abort(),100);await assert.rejects(pending,/cancelled/)
 const a=new AbortController(),b=new AbortController(),one=readFirecrawlLocal('https://example.test/article',a.signal),two=readFirecrawlLocal('https://example.test/article',b.signal)
 await assert.rejects(readFirecrawlLocal('https://example.test/article'),/busy/);a.abort();b.abort();await Promise.allSettled([one,two])
 process.env.FIRECRAWL_LOCAL_BIN='relative-name';await assert.rejects(readFirecrawlLocal('https://example.test/'),/absolute/)
 console.log('PASS Firecrawl Local adapter: fixed argv/no shell, cloud-off/browser-off/public-only, no inherited API key, isolated HOME, plain-text output, private/scheme/credential refusal, cloud-source/blocked/malformed/empty/output-budget failures, abort and concurrency cap. Executable fixture only; official Rust binary not installed or live-tested.')
}finally{
 if(previous===undefined)delete process.env.FIRECRAWL_LOCAL_BIN;else process.env.FIRECRAWL_LOCAL_BIN=previous
 if(oldKey===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=oldKey
 if(oldCloud===undefined)delete process.env.FIRECRAWL_CLOUD;else process.env.FIRECRAWL_CLOUD=oldCloud
 await rm(root,{recursive:true,force:true})
}
