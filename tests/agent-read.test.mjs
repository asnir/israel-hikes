import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['src/lib/catalog.ts','worker/catalog.ts'],outdir:'/tmp/hikes-agent-test',bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {catalog}=await import('/tmp/hikes-agent-test/src/lib/catalog.mjs');
const {catalogResponse}=await import('/tmp/hikes-agent-test/worker/catalog.mjs');
const {generateReadData}=await import('../scripts/agent-read-data.mjs');
const root='/tmp/hikes-agent-generated';
await generateReadData(root);
test('Every catalog trail is discoverable with facts, provenance, cautions, sources and explicit unknown coordinates',async()=>{
 const index=JSON.parse(await fs.readFile(`${root}/data/catalog.json`));
 assert.equal(index.trails.length,catalog.length);
 assert.equal(index.lastSourceCheck,'2026-10-09');
 assert.match(index.safetyNotice,/not.*live/i);
 for(const trail of catalog){
  const found=index.trails.find(t=>t.id===trail.id);assert(found);assert.equal(found.jsonUrl,`/api/trails/${trail.id}`);
  const detail=JSON.parse(await fs.readFile(`${root}/data/trails/${trail.id}.json`));
  assert.deepEqual(detail.trail,JSON.parse(JSON.stringify(trail)));assert.equal(detail.id,trail.id);assert(detail.safetyNotice);assert.equal(detail.coordinates===null,!trail.access?.destination?.match(/^\d+\.\d+,\d+\.\d+$/));
 }
});
test('Discovery covers public pages, not admin inbox; XML and llms discovery refer to real IDs',async()=>{
 const sitemap=await fs.readFile(`${root}/sitemap.xml`,'utf8');const llms=await fs.readFile(`${root}/llms.txt`,'utf8');
 for(const trail of catalog)assert(sitemap.includes(`/trail/${trail.id}</loc>`));
 assert(!sitemap.includes('contact-inbox'));assert.match(llms,/\/api\/catalog/);assert.match(llms,/read.only/i);assert.match(llms,/licen/i);
});
test('Read endpoints never reach upstream/contact, allow only GET/HEAD, reject malformed and unknown IDs',async()=>{
 const assets={fetch:async request=>{const path=new URL(request.url).pathname;try{return new Response(await fs.readFile(root+path),{headers:{'Content-Type':'application/json'}});}catch{return new Response('<html>SPA</html>',{headers:{'Content-Type':'text/html'}});}}};
 for(const path of ['/api/catalog','/api/trails/ofer']){const response=await catalogResponse(new Request('https://example.com'+path),assets);assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/json/);assert((await response.json()).safetyNotice);assert.equal((await catalogResponse(new Request('https://example.com'+path,{method:'HEAD'}),assets)).status,200);assert.equal((await catalogResponse(new Request('https://example.com'+path,{method:'POST'}),assets)).status,405);}
 for(const id of ['not-real','OFER','ofer/extra','%2F',''])assert.equal((await catalogResponse(new Request('https://example.com/api/trails/'+id),assets)).status,404);
});
test('Public feeds preserve source caution/provenance and contain no owner/contact/account fields',async()=>{
 const index=JSON.parse(await fs.readFile(`${root}/data/catalog.json`));
 for(const row of index.trails){assert(row.refs.length>0);assert.deepEqual(row.notes,catalog.find(t=>t.id===row.id).notes);assert(row.provenance);}
 const text=await fs.readFile(`${root}/data/catalog.json`,'utf8');
 assert(!/docs\.google\.com\/document|CONTACT_ADMIN|TURNSTILE|requestId|visitorEmail/.test(text));
 const worker=await fs.readFile('worker/index.ts','utf8');assert(worker.indexOf('catalogResponse(request')<worker.indexOf('env.SERVICE_ENABLED'));assert(worker.indexOf('if(catalogRead)')<worker.indexOf('env.CONTACT.get'));
});
test('Generated feeds are part of exact deployment verification',async()=>{
 const {listReadAssets}=await import('../scripts/check-live-assets.mjs');const paths=await listReadAssets(root);
 assert(paths.includes('llms.txt'));assert(paths.includes('sitemap.xml'));assert(paths.includes('data/catalog.json'));assert.equal(paths.filter(p=>p.startsWith('data/trails/')).length,catalog.length);
});
