import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import setup from 'argon2id/lib/setup.js';
import fs from 'node:fs';
const wasm=fs.readFileSync('node_modules/argon2id/dist/no-simd.wasm');
const reference=await setup(async imports=>WebAssembly.instantiate(wasm,imports),async imports=>WebAssembly.instantiate(wasm,imports));
await build({entryPoints:['worker/admin-auth.ts'],outfile:'/tmp/lifecycle-handler.mjs',bundle:true,platform:'node',format:'esm'});
const {AdminAuth}=await import('/tmp/lifecycle-handler.mjs');
const origin='https://hikes.example';
const strong='violet marmot lantern glacier octopus';
function fixture(patch={}) {
  let rows=new Map(),calls=0;
  const store={
    get:async k=>structuredClone(rows.get(k)),
    put:async(k,v)=>rows.set(k,structuredClone(v)),
    delete:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])rows.delete(k);},
    list:async()=>new Map(rows),getAlarm:async()=>null,setAlarm:async()=>{},
    transaction:async f=>{const before=structuredClone(rows);try{return await f(store);}catch(e){rows=before;throw e;}},
  };
  const env={ADMIN_AUTH_ENABLED:'true',ADMIN_PASSWORD_ENABLED:'true',ADMIN_OTP_ENABLED:'false',
    ADMIN_LIFECYCLE_ENABLED:'true',ADMIN_LIFECYCLE_SECRET:'l'.repeat(64),ADMIN_BOOTSTRAP_SECRET:'b'.repeat(64),
    ADMIN_PASSWORD_PEPPER:'p'.repeat(64),ADMIN_SECRET:'a'.repeat(64),ADMIN_ORIGIN:origin,
    ADMIN_ALLOWLIST:'["first@example.invalid","second@example.invalid"]',...patch};
  const h=new AdminAuth(store,env,()=>{},()=>1800000000000,async()=>p=>{calls++;return reference(p);});
  const post=(path,body,headers={})=>h.fetch(new Request(origin+'/api/admin/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify(body)}));
  return {h,post,env,rows:()=>rows,calls:()=>calls};
}
test('bootstrap is one-time per target, recipient token does not login, replay and weak input denied',async()=>{
 const f=fixture();
 const issued=await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});
 assert.equal(issued.status,200);
 const link=await issued.json(),token=new URL(link.url).hash.slice(1);
 assert.equal(link.expiresIn,900);assert.equal(link.role,'admin-read-only');
 assert.equal((await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)})).status,400);
 assert.equal((await f.post('complete',{token,password:'passwordpassword123!'})).status,400);
 assert.equal(f.calls(),0);
 const completed=await f.post('complete',{token,password:strong});
 assert.equal(completed.status,200);assert.equal(completed.headers.get('Set-Cookie'),null);
 assert.equal(f.calls(),1);assert.equal([...f.rows().keys()].filter(k=>k.startsWith('session:')).length,0);
 assert.equal((await f.post('complete',{token,password:strong})).status,400);
});
test('lifecycle default-deny and distinct secrets precede hashing or tokens',async()=>{
 for(const patch of [{ADMIN_LIFECYCLE_ENABLED:'false'},{ADMIN_LIFECYCLE_SECRET:'a'.repeat(64)},{ADMIN_LIFECYCLE_SECRET:'p'.repeat(64)},{ADMIN_AUTH_ENABLED:'false'}]){
  const f=fixture(patch);assert.equal((await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)})).status,503);assert.equal(f.calls(),0);
 }
 for(const secret of ['wrong','a'.repeat(64),'p'.repeat(64),'l'.repeat(64)]){
  const f=fixture({ADMIN_BOOTSTRAP_SECRET:secret});assert.equal((await f.post('bootstrap',{username:'first@example.invalid',secret})).status,403);assert.equal(f.calls(),0);
 }
});
test('unauthenticated issuance, changed allowlist, CSRF, extra fields and oversized request rejected',async()=>{
 const f=fixture();
 assert.equal((await f.post('link',{username:'first@example.invalid',purpose:'setup',password:''})).status,403);
 assert.equal((await f.post('bootstrap',{username:'outsider@example.invalid',secret:'b'.repeat(64)})).status,403);
 assert.equal((await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)},{Origin:'https://other.invalid'})).status,403);
 assert.equal((await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64),role:'owner'})).status,400);
 assert.equal((await f.post('complete',{token:'x'.repeat(5000),password:strong})).status,413);
 assert.equal(f.calls(),0);
});
test('removed recipient cannot consume a formerly valid link',async()=>{
 const f=fixture();const issued=await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});
 const token=new URL((await issued.json()).url).hash.slice(1);
 f.env.ADMIN_ALLOWLIST='["second@example.invalid","third@example.invalid"]';
 assert.equal((await f.post('complete',{token,password:strong})).status,400);
 assert.equal(f.calls(),0);
});
test('password-authenticated reset requires reauth and revokes old session after completion',async()=>{
 const f=fixture();const issued=await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});
 const token=new URL((await issued.json()).url).hash.slice(1);
 assert.equal((await f.post('complete',{token,password:strong})).status,200);
 const login=await f.post('password',{username:'first@example.invalid',password:strong});
 assert.equal(login.status,200);const cookie=login.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await f.post('link',{username:'first@example.invalid',purpose:'reset',password:'wrong testing passphrase'},{Cookie:cookie})).status,403);
 const reset=await f.post('link',{username:'first@example.invalid',purpose:'reset',password:strong},{Cookie:cookie});
 assert.equal(reset.status,200);
 // Reset valid request consumes fifth lifecycle budget slot, after bootstrap/complete/two issuance attempts.
 const resetToken=new URL((await reset.json()).url).hash.slice(1);
 const completion=await f.post('complete',{token:resetToken,password:'indigo walrus meadow cyclone violin'});
 assert.equal(completion.status,200);
 assert.equal(completion.headers.get('Set-Cookie'),null);
 assert.equal((await f.h.fetch(new Request(origin+'/api/admin/session',{headers:{Cookie:cookie}}))).status,401);
});
test('anonymous distributed issuance cannot spend global completion budget or enumerate allowlist',async()=>{
 const f=fixture();
 for(let i=0;i<25;i++) {
  const statuses=[];
  for(const username of ['first@example.invalid','outsider@example.invalid'])statuses.push((await f.post('link',{username,purpose:'reset',password:''},{'CF-Connecting-IP':'192.0.2.'+(i+2)})).status);
  assert.deepEqual(statuses,[403,403]);
 }
 const issue=await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});assert.equal(issue.status,200);
 const token=new URL((await issue.json()).url).hash.slice(1);
 for(let i=0;i<12;i++)assert.equal((await f.post('complete',{token,password:'passwordpassword123!'})).status,400);
 assert.equal((await f.post('complete',{token,password:strong})).status,200);
 assert.ok(![...f.rows().keys()].some(k=>k.includes('lifecycle-global')));
});
test('peer-admin reset blocked and account reauth failure budget enforced',async()=>{
 const f=fixture();const issue=await f.post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});
 const token=new URL((await issue.json()).url).hash.slice(1);await f.post('complete',{token,password:strong});
 const login=await f.post('password',{username:'first@example.invalid',password:strong});const cookie=login.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await f.post('link',{username:'second@example.invalid',purpose:'invite',password:strong},{Cookie:cookie})).status,403);
 for(let i=0;i<5;i++)assert.equal((await f.post('link',{username:'first@example.invalid',purpose:'reset',password:'wrong testing passphrase'},{Cookie:cookie,'CF-Connecting-IP':'192.0.2.'+(i+2)})).status,403);
 assert.equal((await f.post('link',{username:'first@example.invalid',purpose:'reset',password:strong},{Cookie:cookie,'CF-Connecting-IP':'192.0.2.99'})).status,429);
});
