import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Admin login code and dependencies removed while general hardening and migration history remain',()=>{
 const p=JSON.parse(fs.readFileSync('package.json'));
 for(const dep of ['jose','argon2id','libsodium-wrappers-sumo','@zxcvbn-ts/core','@zxcvbn-ts/language-en','@zxcvbn-ts/language-common'])assert.equal(p.dependencies?.[dep]||p.devDependencies?.[dep],undefined);
 for(const name of ['admin-auth.ts','admin-password.ts','password-runtime.ts','password-lifecycle.ts','password-strength.ts','sodium-factory.ts'])assert.equal(fs.existsSync('worker/'+name),false);
 const worker=fs.readFileSync('worker/index.ts','utf8');assert.ok(!worker.includes('AdminAuth'));assert.ok(!worker.includes('/admin'));assert.ok(!worker.includes('ContactGateway'));
 for(const name of ['wrangler.jsonc','wrangler.preview.jsonc']){
  const config=JSON.parse(fs.readFileSync(name,'utf8').replace(/,\s*([}\]])/g,'$1'));
  assert.deepEqual(config.assets.run_worker_first,['/api/*']);assert.ok(!config.durable_objects.bindings.some(b=>b.name==='ADMIN_AUTH'));
  assert.ok(!Object.keys(config.vars).some(k=>k.startsWith('ADMIN_')));
  assert.equal(config.migrations.at(-2).tag,'v4-remove-admin-auth');assert.deepEqual(config.migrations.at(-2).deleted_classes,['AdminAuthGateway']);
 }
 assert.ok(fs.existsSync('.github/workflows/security.yml'));assert.ok(fs.existsSync('SECURITY.md'));
});
test('Former admin paths use ordinary assets or unknown API handling, not authentication',async()=>{
 const {build}=await import('esbuild');
 await build({entryPoints:['worker/index.ts'],outfile:'/tmp/no-auth-worker.mjs',bundle:true,format:'esm',platform:'node',plugins:[{name:'do',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export class DurableObject {}'}));}}]});
 const {default:worker}=await import('/tmp/no-auth-worker.mjs');let calls=0;
 const env={ASSETS:{fetch:async()=>{calls++;return new Response('ordinary SPA')}},SERVICE_ENABLED:'true'};
 for(const p of ['/admin','/admin/setup','/contact','/contact-inbox','/a-random-unknown-path'])assert.equal(await(await worker.fetch(new Request('https://synthetic.invalid'+p),env)).text(),'ordinary SPA');assert.equal(calls,5);
 for(const p of ['/api/admin/session','/api/admin/auth/password','/api/contact','/api/contact-config','/api/contact-inbox','/api/contact-inbox/summary','/api/a-random-unknown-path'])assert.equal((await worker.fetch(new Request('https://synthetic.invalid'+p),env)).status,404);
});
