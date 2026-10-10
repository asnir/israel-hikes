import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import fs from "node:fs";
await build({
  entryPoints: ["worker/index.ts"],
  outfile: "/tmp/hikes-admin-worker.mjs",
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
test("real Worker + Durable Object route default-denies admin and keeps public site/contact isolated", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "test",
          modules: [
            { type: "ESModule", path: "/tmp/hikes-admin-worker.mjs" },
            {
              type: "CompiledWasm",
              path: "/tmp/sodium.wasm",
              contents: fs.readFileSync(
                "worker/vendor/libsodium/sodium.wasm",
              ),
            },
          ],
          modulesRoot: "/tmp",
          compatibilityDate: "2026-10-09",
          bindings: { ADMIN_AUTH_ENABLED: "false" },
          durableObjects: {
            ADMIN_AUTH: { className: "AdminAuthGateway", useSQLite: true },
            CONTACT: { className: "ContactGateway", useSQLite: true },
            UPSTREAM: { className: "UpstreamGateway", useSQLite: true },
          },
          serviceBindings: { ASSETS: () => new Response("public-static") },
        },
      ],
    }),
  );
  try {
    for (const path of [
      "/admin",
      "/admin/",
      "/admin/login.js",
      "/api/admin",
      "/api/admin/session",
      "/api/admin/trails",
    ]) {
      const r = await mf.dispatchFetch("https://hikes.example" + path);
      assert.equal(r.status, 503);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
      assert.ok(!(await r.text()).includes("public-static"));
    }
    assert.equal(
      await (
        await mf.dispatchFetch("https://hikes.example/trail/shofet")
      ).text(),
      "public-static",
    );
    assert.equal(
      (await mf.dispatchFetch("https://hikes.example/api/contact-inbox"))
        .status,
      404,
    );
  } finally {
    await mf.dispose();
  }
});
test("preview and production route admin through Worker first with disabled explicit configuration", () => {
  for (const p of ["wrangler.jsonc", "wrangler.preview.jsonc"]) {
    const text = fs.readFileSync(p, "utf8");
    assert.match(text, /"ADMIN_AUTH_ENABLED":"false"/);
    assert.match(text, /"\/admin", "\/admin\/\*"/);
    assert.match(text, /"class_name":"AdminAuthGateway"/);
    assert.ok(!text.includes("ADMIN_ALLOWLIST"));
    assert.ok(!text.includes("ADMIN_SECRET"));
    assert.ok(!text.includes("send_email"));
  }
});
test("real Durable Object enabled synthetic OTP session, replay, tamper and logout", async () => {
  const fixture = `import {DurableObject} from 'cloudflare:workers';import {AdminAuth} from './worker/admin-auth';export class TestAuth extends DurableObject{constructor(ctx,env){super(ctx,env);this.h=new AdminAuth(ctx.storage,{...env,ADMIN_EMAIL:{send:async m=>{await ctx.storage.put('test-mail',m)}}},p=>ctx.waitUntil(p))}alarm(){return this.h.alarm()}async fetch(r){if(new URL(r.url).pathname==='/test-mail')return Response.json(await this.ctx.storage.get('test-mail'));return this.h.fetch(r).catch(e=>new Response(e.stack,{status:500}))}}export default {fetch(r,env){return env.AUTH.get(env.AUTH.idFromName('auth')).fetch(r)}}`;
  await build({
    stdin: {
      contents: fixture,
      resolveDir: process.cwd(),
      sourcefile: "synthetic-worker.ts",
    },
    outfile: "/tmp/hikes-auth-enabled.mjs",
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["cloudflare:workers"],
  });
  const origin = "https://hikes.example";
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      modulesRoot: "/tmp",
      scriptPath: "/tmp/hikes-auth-enabled.mjs",
      compatibilityDate: "2026-10-09",
      bindings: {
        ADMIN_AUTH_ENABLED: "true",
        ADMIN_ORIGIN: origin,
        ADMIN_SECRET: "a".repeat(64),
        ADMIN_ALLOWLIST: '["first@example.invalid","second@example.invalid"]',
        ADMIN_EMAIL_FROM: "login@example.invalid",
      },
      durableObjects: { AUTH: { className: "TestAuth", useSQLite: true } },
    }),
  );
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
    const req = await post("/api/admin/auth/request", {
      email: "first@example.invalid",
    });
    assert.equal(req.status, 202, await req.clone().text());
    const challenge = req.headers.get("Set-Cookie").split(";")[0];
    const mail = await (await mf.dispatchFetch(origin + "/test-mail")).json();
    const code = mail.text.match(/\b\d{8}\b/)[0];
    const body = { email: "first@example.invalid", code };
    const rs = await Promise.all([
      post("/api/admin/auth/verify", body, challenge),
      post("/api/admin/auth/verify", body, challenge),
    ]);
    assert.deepEqual(
      rs.map((r) => r.status),
      [200, 401],
    );
    const cookie = rs[0].headers.get("Set-Cookie").split(";")[0];
    assert.equal(
      (
        await mf.dispatchFetch(origin + "/api/admin/session", {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await mf.dispatchFetch(origin + "/api/admin/session", {
          headers: { Cookie: cookie + "tampered" },
        })
      ).status,
      401,
    );
    assert.equal(
      (await post("/api/admin/auth/logout", {}, cookie)).status,
      200,
    );
    assert.equal(
      (
        await mf.dispatchFetch(origin + "/api/admin/session", {
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
  } finally {
    await mf.dispose();
  }
});
