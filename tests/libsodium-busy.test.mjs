import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const runtime=await build({entryPoints:['worker/password-runtime.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fake',setup(b){b.onResolve({filter:/vendor\/libsodium\/wrapper\.mjs$/},()=>({path:'fake',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`export async function createSodium(){await new Promise(r=>setTimeout(r,5));if(globalThis.__fail)throw Error('synthetic');return {libsodium:{__capturedMemory:new WebAssembly.Memory({initial:1})},crypto_pwhash(){return new Uint8Array(32)},crypto_pwhash_ALG_ARGON2ID13:2}}` }));}}]});
const {loadPasswordHasher}=await import('data:text/javascript;base64,'+Buffer.from(runtime.outputFiles[0].text).toString('base64'));
const p={password:new Uint8Array(32),salt:new Uint8Array(16),passes:2,memorySize:19456,parallelism:1,tagLength:32};
test('forced async overlap rejects busy; success and throw release active state',async()=>{const h=await loadPasswordHasher();const pending=h(p);await assert.rejects(()=>h(p));await pending;await h(p);globalThis.__fail=true;await assert.rejects(()=>h(p));globalThis.__fail=false;await new Promise(r=>setTimeout(r,1050));await h(p);});
