import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

await build({
  entryPoints: ['worker/password-runtime.ts'],
  outfile: '/tmp/sodium-failure-runtime.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'node-wasm-fixture',
    setup(b) {
      b.onResolve({ filter: /sodium\.wasm$/ }, () => ({
        path: 'sodium-node', namespace: 'fixture',
      }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: `import fs from 'node:fs';export default new WebAssembly.Module(fs.readFileSync(${JSON.stringify(process.cwd() + '/worker/vendor/libsodium/sodium.wasm')}));`,
        loader: 'js',
      }));
    },
  }],
});
await build({
  entryPoints: ['worker/admin-auth.ts'],
  outfile: '/tmp/sodium-failure-auth.mjs',
  bundle: true, format: 'esm', platform: 'node',
});

test('lazy runtime RNG failure backs off, auth503 no session and retry after cooldown', () => {
  const body = `
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
let rngCalls = 0;
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
 subtle: webcrypto.subtle,
 getRandomValues() { rngCalls++; throw Error('synthetic RNG failure'); }
}});
const {loadPasswordHasher} = await import('/tmp/sodium-failure-runtime.mjs');
const hasher=await loadPasswordHasher();
assert.equal(rngCalls,0);
const params={password:new Uint8Array(32),salt:new Uint8Array(16),passes:2,memorySize:19456,parallelism:1,tagLength:32};
await assert.rejects(()=>hasher(params));
const count=rngCalls;assert.ok(count>0);
await assert.rejects(()=>hasher(params));assert.equal(rngCalls,count);
const {AdminAuth} = await import('/tmp/sodium-failure-auth.mjs');
const rows = new Map();
const storage = {get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,v),
 delete:async()=>{},list:async()=>new Map(rows),getAlarm:async()=>null,setAlarm:async()=>{}};
let hasherCalls=0;
const h = new AdminAuth(storage,{
 ADMIN_AUTH_ENABLED:'true',ADMIN_PASSWORD_ENABLED:'true',ADMIN_OTP_ENABLED:'false',
 ADMIN_PASSWORD_PEPPER:'p'.repeat(64),ADMIN_SECRET:'a'.repeat(64),
 ADMIN_ORIGIN:'https://synthetic.invalid',ADMIN_ALLOWLIST:'["first@example.invalid","second@example.invalid"]'
},()=>{},()=>Date.now(),()=>{hasherCalls++;return loadPasswordHasher();});
const r = await h.fetch(new Request('https://synthetic.invalid/api/admin/auth/password',{
 method:'POST',headers:{Origin:'https://synthetic.invalid','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},
 body:JSON.stringify({username:'first@example.invalid',password:'synthetic testing passphrase'})
}));
assert.equal(hasherCalls,1);
assert.equal(r.status,503);
assert.equal(r.headers.get('Set-Cookie'),null);
assert.ok(![...rows.keys()].some(k=>k.startsWith('session:')));
assert.equal(rngCalls,count);
await new Promise(r=>setTimeout(r,1050));
await assert.rejects(()=>hasher(params));assert.ok(rngCalls>count);
`;
  fs.writeFileSync('/tmp/sodium-fresh-failure.mjs', body);
  const result = spawnSync(process.execPath, ['/tmp/sodium-fresh-failure.mjs'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
