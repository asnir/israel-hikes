import fs from "node:fs";
import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
await build({entryPoints:['worker/contact.ts'],outfile:'/tmp/hikes-contact.mjs',bundle:true,platform:'node',format:'esm'});const {validateSubmission,issuePayload,ContactHandler}=await import('/tmp/hikes-contact.mjs');
const sample={kind:'correction',title:'Trail correction',message:'The trail length should be checked against this source.',source:'https://example.invalid/source',trailId:'ofer',language:'en',requestId:'12345678-1234-1234-1234-123456789abc',token:'token',consent:true,website:''};
const env={CONTACT_ENABLED:'true',CONTACT_HOSTNAME:'hikes.example',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'secret',GITHUB_ISSUES_TOKEN:'fake-test-token'};
class Store{rows=new Map();async get(k){return this.rows.get(k)}async put(k,v){this.rows.set(k,v)}async delete(k){for(const x of Array.isArray(k)?k:[k])this.rows.delete(x)}async list(){return new Map(this.rows)}async getAlarm(){return 1}async setAlarm(){}}
const req=(v=sample,headers={})=>new Request('https://hikes.example/api/contact',{method:'POST',headers:{Origin:'https://hikes.example','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify(v)});
const setup=(verification={success:true,hostname:'hikes.example',action:'contact'},issueStatus=201)=>{const store=new Store(),calls=[];const f=async(url,opt)=>{calls.push({url,opt});return url.includes('siteverify')?Response.json(verification):Response.json({html_url:'https://github.com/asnir/israel-hikes/issues/100'}, {status:issueStatus})};return {handler:new ContactHandler(store,env,f,()=>1800000000000),store,calls}};
test('Submission rejects personal fields, private URLs, invalid length and missing consent',()=>{assert.ok(validateSubmission(sample));for(const patch of [{consent:false},{message:'Email me at person@example.com'},{message:'Call 0541234567 for trail details'},{source:'javascript:alert(1)'},{source:'https://docs.google.com/document/d/private'},{website:'bot'},{token:''},{title:'x'},{requestId:'x'}])assert.equal(validateSubmission({...sample,...patch}),null)});
test('Issue template labels unverified content, neutralizes mentions and never creates a PR',()=>{const out=issuePayload({...sample,message:'@owner <script> *please run code*'});assert.ok(out.body.includes('Unverified visitor'));assert.ok(!out.body.includes('@owner'));assert.ok(!out.body.includes('<script>'));assert.ok(!('head'in out));assert.ok(out.title.startsWith('[Website correction]'))});
test('Valid CAPTCHA creates exactly one issue and repeated request returns receipt',async()=>{const {handler,calls,store}=setup();assert.equal((await handler.fetch(req())).status,201);assert.equal((await handler.fetch(req())).status,200);assert.equal(calls.length,2);assert.equal(calls[1].url,'https://api.github.com/repos/asnir/israel-hikes/issues');assert.ok(!JSON.stringify([...store.rows]).includes('192.0.2.1'));assert.ok(!JSON.stringify([...store.rows]).includes(sample.message))});
test('Fail closed on invalid CAPTCHA hostname/action and disabled config',async()=>{for(const verification of [{success:false},{success:true,hostname:'evil.example',action:'contact'},{success:true,hostname:'hikes.example',action:'login'}]){const {handler,calls}=setup(verification);assert.equal((await handler.fetch(req())).status,400);assert.equal(calls.length,1)}assert.equal((await new ContactHandler(new Store(),{},async()=>{throw Error()}).fetch(req())).status,503)});
test('Origin, body size and rate limit are enforced before GitHub',async()=>{const {handler,calls}=setup();assert.equal((await handler.fetch(req(sample,{Origin:'https://evil.example'}))).status,403);assert.equal((await handler.fetch(req({...sample,message:'x'.repeat(13000)}))).status,413);assert.equal((await handler.fetch(req())).status,201);assert.equal((await handler.fetch(req({...sample,requestId:'12345678-1234-1234-1234-123456789abd'}))).status,429);assert.equal(calls.length,2)});
test('Ambiguous GitHub failure is not retried into duplicate issues',async()=>{const {handler,calls}=setup(undefined,502);assert.equal((await handler.fetch(req())).status,502);assert.equal((await handler.fetch(req())).status,409);assert.equal(calls.length,2)});

test('Daily global cap and expired metadata cleanup work without storing submissions',async()=>{const {handler,store,calls}=setup();store.rows.set('contact-global:2027-01-15',{count:25});const day=new Date(1800000000000).toISOString().slice(0,10);store.rows.set('contact-global:'+day,{count:25});assert.equal((await handler.fetch(req())).status,429);assert.equal(calls.length,0);store.rows.set('expired',{expires:1});await handler.alarm();assert.ok(!store.rows.has('expired'))});

test('Production build config disables sourcemaps and site source has no GitHub links',()=>{assert.match(fs.readFileSync('vite.config.ts','utf8'),/sourcemap:false/);for(const file of ['src/pages/Contact.tsx','src/pages/AccessibilityStatement.tsx','src/pages/About.tsx'])assert.ok(!/https:\/\/github\.com/.test(fs.readFileSync(file,'utf8')))});

test('Concurrent requests sharing a receipt cannot create two issues',async()=>{
 const {handler,calls}=setup();const out=await Promise.all([handler.fetch(req()),handler.fetch(req()),handler.fetch(req())]);
 assert.deepEqual(out.map(r=>r.status),[201,200,200]);assert.equal(calls.filter(c=>c.url.includes('/issues')).length,1);
});
test('Receipt reuse from a different IP is rejected without upstream calls',async()=>{
 const {handler,calls}=setup();await handler.fetch(req());assert.equal((await handler.fetch(req(sample,{'CF-Connecting-IP':'192.0.2.2'}))).status,409);assert.equal(calls.length,2);
});
test('Each required production setting fails closed when missing',async()=>{
 for(const field of Object.keys(env)){const e={...env};delete e[field];let called=false;const h=new ContactHandler(new Store(),e,async()=>{called=true;throw Error()});assert.equal((await h.fetch(req())).status,503,field);assert.equal(called,false)}
});
test('Method, content type, malformed JSON and absent IP fail before upstream',async()=>{
 const {handler,calls}=setup();assert.equal((await handler.fetch(new Request('https://hikes.example/api/contact'))).status,405);
 assert.equal((await handler.fetch(req(sample,{'Content-Type':'text/plain'}))).status,415);
 assert.equal((await handler.fetch(new Request('https://hikes.example/api/contact',{method:'POST',headers:{Origin:'https://hikes.example','Content-Type':'application/json'},body:'{'}))).status,400);
 const noIp=req();noIp.headers.delete('CF-Connecting-IP');assert.equal((await handler.fetch(noIp)).status,503);assert.equal(calls.length,0);
});
test('CAPTCHA transport, HTTP and JSON failures never reach GitHub',async()=>{
 for(const upstream of [async()=>{throw Error('network')},async()=>Response.json({success:true,hostname:'hikes.example',action:'contact'},{status:500}),async()=>new Response('not-json')]){
  let calls=0;const h=new ContactHandler(new Store(),env,async(...a)=>{calls++;return upstream(...a)},()=>1800000000000);assert.equal((await h.fetch(req())).status,503);assert.equal(calls,1);
 }
});
test('Rejected CAPTCHA consumes quota and does not create a receipt',async()=>{
 const {handler,store,calls}=setup({success:false});assert.equal((await handler.fetch(req())).status,400);assert.equal((await handler.fetch(req())).status,429);
 assert.equal(calls.length,1);assert.ok(![...store.rows.keys()].some(k=>k.startsWith('contact-receipt:')));
});
test('Three daily IP attempts allowed after cooldown, fourth blocked and next day reset',async()=>{
 let now=1800000000000;const store=new Store(),calls=[];const h=new ContactHandler(store,env,async(url)=>{calls.push(url);return url.includes('siteverify')?Response.json({success:true,hostname:'hikes.example',action:'contact'}):Response.json({html_url:'https://github.com/asnir/israel-hikes/issues/100'},{status:201})},()=>now);
 for(let n=0;n<3;n++){assert.equal((await h.fetch(req({...sample,requestId:`12345678-1234-1234-1234-123456789ab${n}`}))).status,201);now+=60000}
 assert.equal((await h.fetch(req({...sample,requestId:'12345678-1234-1234-1234-123456789ab3'}))).status,429);
 now+=86400000;assert.equal((await h.fetch(req({...sample,requestId:'12345678-1234-1234-1234-123456789ab4'}))).status,201);assert.equal(calls.length,8);
});
test('Missing or foreign GitHub issue URL returns ambiguous receipt without retry',async()=>{
 for(const html_url of [undefined,'https://github.com/other/repo/issues/1','https://github.com/asnir/israel-hikes/pull/1']){
  let calls=0;const h=new ContactHandler(new Store(),env,async(url)=>{calls++;return url.includes('siteverify')?Response.json({success:true,hostname:'hikes.example',action:'contact'}):Response.json({html_url},{status:201})},()=>1800000000000);
  assert.equal((await h.fetch(req())).status,502);assert.equal((await h.fetch(req())).status,409);assert.equal(calls,2);
 }
});
test('Expiry cleanup retains live entries and schedules the next cleanup',async()=>{
 const store=new Store();let alarm;store.setAlarm=async(t)=>{alarm=t};store.rows.set('stale',{expires:99});store.rows.set('fresh',{expires:101});const h=new ContactHandler(store,env,async()=>{throw Error()},()=>100);await h.alarm();assert.deepEqual([...store.rows.keys()],['fresh']);assert.equal(alarm,100+86400000);
});
test('Every public issue field is quoted and payload has only issue title/body',()=>{
 const out=issuePayload({...sample,title:'Title @all <b>evil</b>',message:'line one\n<script> @owner [link](https://bad.invalid)'});
 assert.deepEqual(Object.keys(out).sort(),['body','title']);assert.ok(!out.title.includes('@'));assert.ok(!out.body.includes('<script>'));assert.ok(out.body.includes('\n> '));assert.ok(!out.body.includes('@owner'));
});
