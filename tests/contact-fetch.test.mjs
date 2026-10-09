import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['worker/contact.ts'],outfile:'/tmp/hikes-contact-fetch.mjs',bundle:true,platform:'node',format:'esm'});
const {ContactHandler}=await import('/tmp/hikes-contact-fetch.mjs');
test('Default siteverify fetch has no handler receiver',async()=>{
 const original=globalThis.fetch;
 let called=false;
 globalThis.fetch=async function(url){
  assert.equal(this,undefined);
  assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  called=true;
  return Response.json({success:false});
 };
 try{
  const rows=new Map();
  const storage={get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,v),getAlarm:async()=>1};
  const env={CONTACT_ENABLED:'true',CONTACT_HOSTNAME:'hikes.example',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'test',CONTACT_ADMIN_SECRET:'a'.repeat(32)};
  const handler=new ContactHandler(storage,env);
  const payload={kind:'general',title:'Synthetic check',message:'Synthetic check without real visitor details.',source:'',trailId:'',name:'',email:'',language:'en',requestId:'12345678-1234-1234-1234-123456789abc',token:'dummy',consent:true,website:''};
  const request=new Request('https://hikes.example/api/contact',{method:'POST',headers:{Origin:'https://hikes.example','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(payload)});
  const response=await handler.fetch(request);
  assert.equal(called,true);
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'verification-failed'});
 }finally{globalThis.fetch=original}
});
