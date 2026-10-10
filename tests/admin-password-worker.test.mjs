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
  outfile: "/tmp/password-integration.mjs",
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
test("real workerd imported WASM + DO password-only login with no sender, wrong password, replay/logout and no registration", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "/tmp/password-integration.mjs" },
        {
          type: "CompiledWasm",
          path: "/tmp/sodium.wasm",
          contents: fs.readFileSync("worker/vendor/libsodium/sodium.wasm"),
        },
      ],
      modulesRoot: "/tmp",
      compatibilityDate: "2026-10-09",
      bindings: {
        ADMIN_AUTH_ENABLED: "true",
        ADMIN_PASSWORD_ENABLED: "true",
        ADMIN_OTP_ENABLED: "false",
        ADMIN_PASSWORD_PEPPER: "p".repeat(64),
        ADMIN_SECRET: "a".repeat(64),
        ADMIN_ORIGIN: "https://hikes.example",
        ADMIN_ALLOWLIST: '["first@example.invalid","second@example.invalid"]',
      },
      durableObjects: { AUTH: { className: "Auth", useSQLite: true } },
    }),
  );
  const origin = "https://hikes.example";
  const post = (path, body, c) =>
    mf.dispatchFetch(origin + path, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "192.0.2.1",
        ...(c ? { Cookie: c } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await mf.dispatchFetch(origin + "/synthetic-fixture")).status,
      200,
    );
    assert.equal(
      (
        await post("/api/admin/auth/password", {
          username: "first@example.invalid",
          password: "incorrect testing passphrase",
        })
      ).status,
      401,
    );
    const r = await post("/api/admin/auth/password", {
      username: "first@example.invalid",
      password: "synthetic only testing passphrase",
    });
    assert.equal(r.status, 200, await r.clone().text());
    const c = r.headers.get("Set-Cookie").split(";")[0];
    assert.equal(
      (
        await mf.dispatchFetch(origin + "/api/admin/session", {
          headers: { Cookie: c },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("/api/admin/auth/request", {
          email: "first@example.invalid",
        })
      ).status,
      503,
    );
    for (const p of [
      "/api/admin/auth/register",
      "/api/admin/auth/password-reset",
      "/api/admin/auth/password-setup",
    ])
      assert.equal((await post(p, {})).status, 404);
    assert.equal((await post("/api/admin/auth/logout", {}, c)).status, 200);
    assert.equal(
      (
        await mf.dispatchFetch(origin + "/api/admin/session", {
          headers: { Cookie: c },
        })
      ).status,
      401,
    );
  } finally {
    await mf.dispose();
  }
});
