import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import fs from "node:fs";
import setup from "argon2id/lib/setup.js";
const wasm = fs.readFileSync("node_modules/argon2id/dist/no-simd.wasm");
const loader = async (o) => WebAssembly.instantiate(wasm, o);
const hash = await setup(loader, loader);
await build({
  entryPoints: ["worker/admin-password.ts"],
  outfile: "/tmp/hikes-password-module.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { makeCredential, verifyPassword, validCredential } =
  await import("/tmp/hikes-password-module.mjs");
const secret = "p".repeat(64),
  pw = "synthetic long testing passphrase";
test("Argon2id pinned parameters, unique random salts, no plaintext and native constant-time verification", async () => {
  const a = await makeCredential(pw, hash, secret),
    b = await makeCredential(pw, hash, secret);
  assert.equal(a.algorithm, "argon2id");
  assert.equal(a.memory, 19456);
  assert.equal(a.passes, 2);
  assert.equal(a.parallelism, 1);
  assert.notEqual(a.salt, b.salt);
  assert.ok(!JSON.stringify(a).includes(pw));
  assert.ok(validCredential(a));
  assert.equal(await verifyPassword(pw, a, hash, secret), true);
  assert.equal(
    await verifyPassword("wrong long testing passphrase", a, hash, secret),
    false,
  );
  assert.equal(await verifyPassword(pw, a, hash, "x".repeat(64)), false);
});
test("no truncation, weak/oversized inputs rejected, malformed/downgraded/excessive hash parameters denied", async () => {
  for (const p of ["short", "x".repeat(257)])
    await assert.rejects(() => makeCredential(p, hash, secret));
  const a = await makeCredential(pw, hash, secret);
  for (const patch of [
    { memory: 512 },
    { memory: 999999999 },
    { passes: 1 },
    { parallelism: 2 },
    { salt: "bad" },
    { digest: "bad" },
    { algorithm: "sha256" },
    { version: 18 },
  ]) {
    assert.equal(validCredential({ ...a, ...patch }), false);
    assert.equal(
      await verifyPassword(pw, { ...a, ...patch }, hash, secret),
      false,
    );
  }
  const padded = await makeCredential(" " + pw + " ", hash, secret);
  assert.equal(await verifyPassword(pw, padded, hash, secret), false);
  assert.equal(
    await verifyPassword(" " + pw + " ", padded, hash, secret),
    true,
  );
});
await build({
  entryPoints: ["worker/admin-auth.ts"],
  outfile: "/tmp/hikes-password-auth.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { AdminAuth } = await import("/tmp/hikes-password-auth.mjs");
const origin = "https://hikes.example",
  email = "first@example.invalid",
  keySecret = "a".repeat(64);
const env = {
  ADMIN_AUTH_ENABLED: "true",
  ADMIN_OTP_ENABLED: "false",
  ADMIN_PASSWORD_ENABLED: "true",
  ADMIN_PASSWORD_PEPPER: secret,
  ADMIN_ORIGIN: origin,
  ADMIN_SECRET: keySecret,
  ADMIN_ALLOWLIST: '["first@example.invalid","second@example.invalid"]',
};
async function emailKey() {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Buffer.from(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode("email:" + email),
    ),
  ).toString("hex");
}
async function setupAuth() {
  const rows = new Map();
  let calls = 0,
    now = 1800000000000;
  const storage = {
    get: async (k) => structuredClone(rows.get(k)),
    put: async (k, v) => rows.set(k, structuredClone(v)),
    delete: async (k) => {
      for (const x of Array.isArray(k) ? k : [k]) rows.delete(x);
    },
    list: async () => new Map(rows),
    getAlarm: async () => null,
    setAlarm: async () => {},
  };
  const credential = await makeCredential(pw, hash, secret);
  rows.set("credential:" + (await emailKey()), credential);
  const e = { ...env };
  return {
    rows,
    credential,
    e,
    h: new AdminAuth(
      storage,
      e,
      () => {},
      () => now,
      async () => (params) => {
        calls++;
        return hash(params);
      },
    ),
    calls: () => calls,
    advance: (n) => (now += n),
  };
}
const req = (body, cookie, patch = {}) =>
  new Request(origin + "/api/admin/auth/password", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      ...(cookie ? { Cookie: cookie } : {}),
      ...patch,
    },
    body: JSON.stringify(body),
  });
const session = (cookie) =>
  new Request(origin + "/api/admin/session", { headers: { Cookie: cookie } });
test("additional password method works with no domain/email sender, creates short revocable session and rotates on second login", async () => {
  const s = await setupAuth(),
    r = await s.h.fetch(req({ username: email, password: pw }));
  assert.equal(r.status, 200);
  const c = r.headers.get("Set-Cookie").split(";")[0];
  assert.match(c, /__Host-admin-session=/);
  assert.equal((await s.h.fetch(session(c))).status, 200);
  const r2 = await s.h.fetch(req({ username: email, password: pw }));
  assert.notEqual(r2.headers.get("Set-Cookie"), r.headers.get("Set-Cookie"));
  s.rows.set("credential:" + (await emailKey()), {
    ...s.credential,
    revision: "f".repeat(64),
  });
  assert.equal((await s.h.fetch(session(c))).status, 401);
  assert.ok(!JSON.stringify([...s.rows]).includes(pw));
  s.advance(900001);
  assert.equal(
    (await s.h.fetch(session(r2.headers.get("Set-Cookie").split(";")[0])))
      .status,
    401,
  );
});
test("wrong, unknown, unprovisioned and revoked identities get generic401; disabled method and malformed record fail closed", async () => {
  const s = await setupAuth();
  const wrong = await s.h.fetch(
    req({ username: email, password: "wrong testing passphrase" }),
  );
  const unknown = await s.h.fetch(
    req({ username: "outsider@example.invalid", password: pw }, undefined, {
      "CF-Connecting-IP": "192.0.2.2",
    }),
  );
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(await wrong.text(), await unknown.text());
  assert.equal(s.calls(), 2);
  s.e.ADMIN_ALLOWLIST = '["second@example.invalid","third@example.invalid"]';
  assert.equal(
    (await s.h.fetch(req({ username: email, password: pw }))).status,
    401,
  );
  s.e.ADMIN_PASSWORD_ENABLED = "false";
  assert.equal(
    (await s.h.fetch(req({ username: email, password: pw }))).status,
    503,
  );
});
test("rate reservations precede expensive hashing; global/account/IP limits bound cardinality, cooldown recovery and origin checks", async () => {
  const s = await setupAuth();
  for (let i = 0; i < 6; i++)
    await s.h.fetch(
      req(
        { username: email, password: "incorrect testing passphrase" },
        undefined,
        { "CF-Connecting-IP": `192.0.2.${i}` },
      ),
    );
  assert.equal(s.calls(), 5);
  s.advance(900001);
  assert.equal(
    (await s.h.fetch(req({ username: email, password: pw }))).status,
    200,
  );
  const count = s.calls();
  assert.equal(
    (
      await s.h.fetch(
        req({ username: email, password: pw }, undefined, {
          Origin: "https://evil.example",
        }),
      )
    ).status,
    403,
  );
  assert.equal(s.calls(), count);
  const s2 = await setupAuth();
  for (let i = 0; i < 500; i++)
    await s2.h.fetch(
      req({ username: "outsider@example.invalid", password: pw }, undefined, {
        "CF-Connecting-IP": `192.0.2.${i}`,
      }),
    );
  assert.equal(s2.calls(), 20);
  assert.ok(s2.rows.size < 30);
});
test("library agrees with RFC9106 Argon2id vector", () => {
  const result = hash({
    password: new Uint8Array(32).fill(1),
    salt: new Uint8Array(16).fill(2),
    secret: new Uint8Array(8).fill(3),
    ad: new Uint8Array(12).fill(4),
    parallelism: 4,
    passes: 3,
    memorySize: 32,
    tagLength: 32,
  });
  assert.equal(
    Buffer.from(result).toString("hex"),
    "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659",
  );
});
test("password disabled with OTP configured gives503 without KDF and cannot grant session", async () => {
  const s = await setupAuth();
  s.e.ADMIN_PASSWORD_ENABLED = "false";
  s.e.ADMIN_OTP_ENABLED = "true";
  s.e.ADMIN_EMAIL = {
    send: async () => {
      throw Error("not called");
    },
  };
  s.e.ADMIN_EMAIL_FROM = "login@example.invalid";
  assert.equal(
    (await s.h.fetch(req({ username: email, password: pw }))).status,
    503,
  );
  assert.equal(s.calls(), 0);
  assert.equal(
    [...s.rows.keys()].filter((k) => k.startsWith("session:")).length,
    0,
  );
});
test("pepper rotation revokes existing password sessions, failed credentials store no secret request data", async () => {
  const s = await setupAuth(),
    r = await s.h.fetch(req({ username: email, password: pw })),
    c = r.headers.get("Set-Cookie").split(";")[0];
  s.e.ADMIN_PASSWORD_PEPPER = "x".repeat(64);
  assert.equal((await s.h.fetch(session(c))).status, 401);
  assert.equal(
    (await s.h.fetch(req({ username: email, password: pw }))).status,
    401,
  );
  const state = JSON.stringify([...s.rows]);
  assert.ok(!state.includes(pw));
  assert.ok(!state.includes(email));
  assert.ok(!state.includes(secret));
});
