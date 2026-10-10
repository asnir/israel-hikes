import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';
import setup from 'argon2id/lib/setup.js';
const plugin={name:'node-wasm',setup(b){b.onResolve({filter:/sodium\.wasm$/},()=>({path:'wasm',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import fs from 'node:fs';export default new WebAssembly.Module(fs.readFileSync(${JSON.stringify(process.cwd()+'/worker/vendor/libsodium/sodium.wasm')}));`,loader:'js'}));}};
await build({entryPoints:['worker/password-runtime.ts'],outfile:'/tmp/disposable-runtime-test.mjs',bundle:true,format:'esm',platform:'node',plugins:[plugin]});
await build({entryPoints:['worker/vendor/libsodium/wrapper.mjs'],outfile:'/tmp/disposable-wrapper-test.mjs',bundle:true,format:'esm',platform:'node',plugins:[plugin]});
const {loadPasswordHasher}=await import('/tmp/disposable-runtime-test.mjs');
const {createSodium}=await import('/tmp/disposable-wrapper-test.mjs');
const wasm=fs.readFileSync('node_modules/argon2id/dist/no-simd.wasm');
const reference=await setup(async i=>WebAssembly.instantiate(wasm,i),async i=>WebAssembly.instantiate(wasm,i));
const p={password:new TextEncoder().encode('synthetic unique passphrase for heap probe'),salt:new Uint8Array(16).fill(9),passes:2,memorySize:19456,parallelism:1,tagLength:32};
test('unmodified wrapper baseline positive, whole-memory wipe negative and output preserved',async()=>{
 const sodium=await createSodium();const out=sodium.crypto_pwhash(32,p.password,p.salt,2,19456*1024,sodium.crypto_pwhash_ALG_ARGON2ID13);
 const copy=out.slice();assert.ok(Buffer.from(sodium.libsodium.HEAPU8).indexOf(Buffer.from(out))>=0);
 sodium.libsodium.HEAPU8.fill(0);
 assert.equal(Buffer.from(sodium.libsodium.HEAPU8).indexOf(Buffer.from(out)),-1);
 assert.ok(sodium.libsodium.HEAPU8.every(b=>b===0));assert.deepEqual(out,copy);
});
test('one-use runtime preserves independent KDF output across fresh instances and rejects reuse',async()=>{
 for(let i=0;i<8;i++){
  const h=await loadPasswordHasher(),params={...p,password:new Uint8Array(32).fill(i)};
  assert.deepEqual(await h(params),reference(params));assert.deepEqual(await h(params),reference(params));
 }
});
test('invalid parameters reject before initialization',async()=>{
 const h=await loadPasswordHasher();await assert.rejects(()=>h({...p,memorySize:1e9}),/parameters/);assert.deepEqual(await h(p),reference(p));
});
test('independent concurrent instances have distinct memory and wiping one leaves other intact',async()=>{
 const [a,b]=await Promise.all([createSodium(),createSodium()]);
 assert.notEqual(a.libsodium.HEAPU8.buffer,b.libsodium.HEAPU8.buffer);
 const out=a.crypto_pwhash(32,p.password,p.salt,2,19456*1024,a.crypto_pwhash_ALG_ARGON2ID13);
 a.libsodium.HEAPU8.fill(0);
 assert.ok(!b.libsodium.HEAPU8.every(x=>x===0));
 assert.deepEqual(b.crypto_pwhash(32,p.password,p.salt,2,19456*1024,b.crypto_pwhash_ALG_ARGON2ID13),out);
 b.libsodium.HEAPU8.fill(0);
});
