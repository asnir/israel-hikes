import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['worker/password-lifecycle.ts'],outfile:'/tmp/hikes-lifecycle.mjs',bundle:true,platform:'node',format:'esm'});
const {PasswordLifecycle}=await import('/tmp/hikes-lifecycle.mjs');
function fixture(){const rows=new Map();let now=1800000000000,calls=0;let queue=Promise.resolve();const store={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>{for(const x of Array.isArray(k)?k:[k])rows.delete(x)},list:async()=>new Map(rows),transaction:f=>{const p=queue.then(()=>f(store));queue=p.catch(()=>{});return p}};const h=new PasswordLifecycle(store,{origin:'https://hikes.example',secret:'l'.repeat(64),pepper:'p'.repeat(64)},()=>now,async()=>()=>{calls++;return new Uint8Array(32).fill(3)});return {h,rows,calls:()=>calls,advance:n=>now+=n};}
const strong='violet marmot lantern glacier octopus';
const target='a'.repeat(64),actor='b'.repeat(64);
test('tokens signed, purpose bound, no target identity/plain token stored; weak strength does not consume',async()=>{const f=fixture();const token=await f.h.issue({target,actor,purpose:'setup'});assert.ok(!JSON.stringify([...f.rows]).includes(token));assert.equal((await f.h.consume(token,'passwordpassword123!',['first@example.invalid'])).ok,false);assert.equal(f.calls(),0);assert.equal((await f.h.consume(token,strong)).ok,true);assert.equal(f.calls(),1);assert.equal((await f.h.consume(token,strong)).ok,false);});
test('reset invalidates sessions/challenges/both methods and old links; does not auto-login',async()=>{const f=fixture();let t=await f.h.issue({target,actor,purpose:'setup'});await f.h.consume(t,strong);f.rows.set('session:otp',{email:target,expires:1800000999999});f.rows.set('session:password',{email:target,expires:1800000999999});f.rows.set('challenge:otp',{email:target,expires:1800000999999});f.rows.set('active:'+target,{id:'otp',expires:1800000999999});const rev=f.rows.get('credential:'+target).revision;t=await f.h.issue({target,actor,purpose:'reset'});const stale=await f.h.issue({target,actor,purpose:'reset'});assert.equal((await f.h.consume(t,strong)).ok,false);assert.equal((await f.h.consume(stale,strong)).ok,true);assert.notEqual(f.rows.get('credential:'+target).revision,rev);assert.equal([...f.rows.keys()].filter(k=>/^(session|challenge|active|lifecycle):/.test(k)).length,0);});
test('parallel reuse, expiry, forged signatures and target revision are fail closed',async()=>{const f=fixture();const t=await f.h.issue({target,actor,purpose:'invite'});assert.equal((await f.h.consume(t.slice(0,-2)+'AA',strong)).ok,false);const out=await Promise.all([f.h.consume(t,strong),f.h.consume(t,strong)]);assert.equal(out.filter(x=>x.ok).length,1);const reset=await f.h.issue({target,actor,purpose:'reset'});f.advance(900001);assert.equal((await f.h.consume(reset,strong)).ok,false);});
test('purpose restrictions and record capacity precede costly work',async()=>{const f=fixture();await assert.rejects(()=>f.h.issue({target,actor,purpose:'reset'}));const t=await f.h.issue({target,actor,purpose:'setup'});await f.h.consume(t,strong);await assert.rejects(()=>f.h.issue({target,actor,purpose:'invite'}));});
test('signed adversarial claim mutations rejected before KDF',async()=>{
 const {jwtVerify,SignJWT}=await import('jose');
 for(const patch of [{aud:'hikes-password-reset'},{purpose:'reset'},{role:'owner'},{sub:'c'.repeat(64)},{jti:'not-hex'},{revision:'changed'},{iss:'https://other.invalid'},{exp:1800001900},{iat:1800000010}]) {
  const f=fixture(),t=await f.h.issue({target,actor,purpose:'setup'});
  const {payload}=await jwtVerify(t,new TextEncoder().encode('l'.repeat(64)),{currentDate:new Date(1800000000000)});
  const token=await new SignJWT({...payload,...patch}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(new TextEncoder().encode('l'.repeat(64)));
  assert.equal((await f.h.consume(token,strong)).ok,false,JSON.stringify(patch));assert.equal(f.calls(),0);
 }
});
test('credential revision mutation and removed allowlist block before KDF',async()=>{
 const f=fixture(),t=await f.h.issue({target,actor,purpose:'setup'});
 assert.equal((await f.h.consume(t,strong,[],['c'.repeat(64)])).ok,false);assert.equal(f.calls(),0);
 const donor=fixture(),dt=await donor.h.issue({target,actor,purpose:'setup'});await donor.h.consume(dt,strong);
 f.rows.set('credential:'+target,donor.rows.get('credential:'+target));
 assert.equal((await f.h.consume(t,strong)).ok,false);assert.equal(f.calls(),0);
});
test('expired bootstrap can be reissued without wiping DO storage',async()=>{
 const f=fixture();const old=await f.h.issue({target,actor:target,purpose:'setup',bootstrap:true});
 await assert.rejects(()=>f.h.issue({target,actor:target,purpose:'setup',bootstrap:true}));
 f.advance(900001);const next=await f.h.issue({target,actor:target,purpose:'setup',bootstrap:true});
 assert.notEqual(next,old);assert.equal((await f.h.consume(next,strong)).ok,true);
 assert.equal(f.rows.has('bootstrap:'+target),false);
});

test('wrong JWT typ rejected despite valid signature',async()=>{
 const {jwtVerify,SignJWT}=await import('jose');const f=fixture(),t=await f.h.issue({target,actor,purpose:'setup'});
 const {payload}=await jwtVerify(t,new TextEncoder().encode('l'.repeat(64)),{currentDate:new Date(1800000000000)});
 const token=await new SignJWT(payload).setProtectedHeader({alg:'HS256',typ:'other'}).sign(new TextEncoder().encode('l'.repeat(64)));
 assert.equal((await f.h.consume(token,strong)).ok,false);assert.equal(f.calls(),0);
});
