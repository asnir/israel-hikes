import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import fs from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const fixture = `import {DurableObject} from 'cloudflare:workers';import {AdminAuth} from './worker/admin-auth';import {makeCredential} from './worker/admin-password';import {loadPasswordHasher} from './worker/password-runtime';export class Auth extends DurableObject{constructor(ctx,env){super(ctx,env);this.auth=new AdminAuth(ctx.storage,env,p=>ctx.waitUntil(p),()=>Date.now(),loadPasswordHasher)}alarm(){return this.auth.alarm()}async fetch(r){if(new URL(r.url).pathname==='/synthetic-fixture'){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(this.env.ADMIN_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const id=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('email:first@example.invalid'))),b=>b.toString(16).padStart(2,'0')).join('');await this.ctx.storage.put('credential:'+id,await makeCredential('synthetic only testing passphrase',await loadPasswordHasher(),this.env.ADMIN_PASSWORD_PEPPER));return new Response('ready')}return this.auth.fetch(r)}}export default {fetch(r,env){return env.AUTH.get(env.AUTH.idFromName('auth')).fetch(r)}}`;
await build({
  stdin: {
    contents: fixture,
    resolveDir: process.cwd(),
    sourcefile: "password-test.ts",
  },
  outfile: "/tmp/lifecycle-workerd.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:workers"],
  plugins: [
    {
      name: "wasm",
      setup(build) {
        build.onResolve({ filter: /sodium\.wasm$/ }, () => ({
          path: "./sodium.wasm",
          external: true,
        }));
      },
    },
  ],
});
test('real workerd libsodium + SQLite DO transactional bootstrap/setup/reset/replay', async () => {
 const mf=new Miniflare(convertV4MiniflareOptions({
  modules:[{type:'ESModule',path:'/tmp/lifecycle-workerd.mjs'},{type:'CompiledWasm',path:'/tmp/sodium.wasm',contents:fs.readFileSync('worker/vendor/libsodium/sodium.wasm')}],
  modulesRoot:'/tmp',compatibilityDate:'2026-10-09',bindings:{
   ADMIN_AUTH_ENABLED:'true',ADMIN_PASSWORD_ENABLED:'true',ADMIN_OTP_ENABLED:'false',ADMIN_LIFECYCLE_ENABLED:'true',
   ADMIN_LIFECYCLE_SECRET:'l'.repeat(64),ADMIN_BOOTSTRAP_SECRET:'b'.repeat(64),ADMIN_PASSWORD_PEPPER:'p'.repeat(64),
   ADMIN_SECRET:'a'.repeat(64),ADMIN_ORIGIN:'https://hikes.example',ADMIN_ALLOWLIST:'["first@example.invalid","second@example.invalid"]',
  },durableObjects:{AUTH:{className:'Auth',useSQLite:true}},
 }));
 const origin='https://hikes.example',password='violet marmot lantern glacier octopus';
 const post=(path,body,cookie)=>mf.dispatchFetch(origin+'/api/admin/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 try {
  const issue=await post('bootstrap',{username:'first@example.invalid',secret:'b'.repeat(64)});assert.equal(issue.status,200,await issue.clone().text());
  const token=new URL((await issue.json()).url).hash.slice(1);
  const done=await post('complete',{token,password});assert.equal(done.status,200,await done.clone().text());assert.equal(done.headers.get('Set-Cookie'),null);
  assert.equal((await post('complete',{token,password})).status,400);
  const login=await post('password',{username:'first@example.invalid',password});assert.equal(login.status,200,await login.clone().text());const cookie=login.headers.get('Set-Cookie').split(';')[0];
  const reset=await post('link',{username:'first@example.invalid',purpose:'reset',password},cookie);assert.equal(reset.status,200,await reset.clone().text());
  const t=new URL((await reset.json()).url).hash.slice(1),next='indigo walrus meadow cyclone violin';
  const out=await post('complete',{token:t,password:next});assert.equal(out.status,200,await out.clone().text());
  assert.equal((await mf.dispatchFetch(origin+'/api/admin/session',{headers:{Cookie:cookie}})).status,401);
  assert.equal((await post('password',{username:'first@example.invalid',password:next})).status,200);
  assert.equal((await post('password',{username:'first@example.invalid',password})).status,401);
 } finally {await mf.dispose();}
});
