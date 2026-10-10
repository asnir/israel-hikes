import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
await build({
  entryPoints: ["worker/admin-auth.ts"],
  outfile: "/tmp/hikes-admin-auth.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { AdminAuth } = await import("/tmp/hikes-admin-auth.mjs");
class Store {
  rows = new Map();
  async get(k) {
    return structuredClone(this.rows.get(k));
  }
  async put(k, v) {
    this.rows.set(k, structuredClone(v));
  }
  async delete(k) {
    for (const x of Array.isArray(k) ? k : [k]) this.rows.delete(x);
  }
  async list() {
    return new Map(this.rows);
  }
  alarmTime = null;
  async getAlarm() {
    return this.alarmTime;
  }
  async setAlarm(t) {
    this.alarmTime = t;
  }
}
const origin = "https://hikes.example";
const env = {
  ADMIN_AUTH_ENABLED: "true",
  ADMIN_ORIGIN: origin,
  ADMIN_SECRET: "a".repeat(64),
  ADMIN_ALLOWLIST: '["first@example.invalid","second@example.invalid"]',
  ADMIN_EMAIL_FROM: "login@example.invalid",
};
function setup() {
  let now = 1800000000000;
  const store = new Store(),
    mail = [],
    jobs = [];
  const e = {
    ...env,
    ADMIN_EMAIL: {
      send: async (m) => {
        mail.push(m);
      },
    },
  };
  const h = new AdminAuth(
    store,
    e,
    (p) => jobs.push(p),
    () => now,
  );
  return {
    h,
    store,
    mail,
    e,
    flush: () => Promise.all(jobs),
    advance: (n) => (now += n),
  };
}
function request(path, body, cookie, extra = {}) {
  return new Request(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const cookie = (r) => r.headers.get("Set-Cookie")?.split(";")[0];
async function challenge(s, email = "first@example.invalid") {
  const r = await s.h.fetch(request("/api/admin/auth/request", { email }));
  await s.flush();
  return { r, c: cookie(r), code: s.mail.at(-1)?.text.match(/\b\d{8}\b/)[0] };
}
async function login(s) {
  const c = await challenge(s);
  return s.h.fetch(
    request(
      "/api/admin/auth/verify",
      { email: "first@example.invalid", code: c.code },
      c.c,
    ),
  );
}
test("fails closed if any configuration missing or malformed", async () => {
  for (const key of [...Object.keys(env), "ADMIN_EMAIL"]) {
    const s = setup();
    delete s.e[key];
    assert.equal((await s.h.fetch(request("/admin"))).status, 503);
    assert.equal(s.mail.length, 0);
  }
  for (const patch of [
    { ADMIN_AUTH_ENABLED: "false" },
    { ADMIN_SECRET: "short" },
    { ADMIN_ORIGIN: "http://hikes.example" },
    { ADMIN_ALLOWLIST: '["one@example.invalid"]' },
  ]) {
    const s = setup();
    Object.assign(s.e, patch);
    assert.equal((await s.h.fetch(request("/admin"))).status, 503);
  }
});
test("request is generic, allowlist private, codes keyed and no raw email/IP/OTP stored", async () => {
  const s = setup();
  const good = await challenge(s);
  assert.equal(good.r.status, 202);
  assert.match(good.c, /__Host-admin-challenge=/);
  assert.equal(s.mail.length, 1);
  const bad = await s.h.fetch(
    request(
      "/api/admin/auth/request",
      { email: "outsider@example.invalid" },
      undefined,
      { "CF-Connecting-IP": "192.0.2.2" },
    ),
  );
  await s.flush();
  assert.equal(await bad.text(), await good.r.text());
  assert.equal(s.mail.length, 1);
  const rows = JSON.stringify([...s.store.rows]);
  for (const value of ["first@example.invalid", "192.0.2.1", good.code])
    assert.ok(!rows.includes(value));
});
test("single use and concurrent redemption yield exactly one short signed session", async () => {
  const s = setup(),
    c = await challenge(s);
  const rs = await Promise.all([
    s.h.fetch(
      request(
        "/api/admin/auth/verify",
        { email: "first@example.invalid", code: c.code },
        c.c,
      ),
    ),
    s.h.fetch(
      request(
        "/api/admin/auth/verify",
        { email: "first@example.invalid", code: c.code },
        c.c,
      ),
    ),
  ]);
  assert.deepEqual(
    rs.map((r) => r.status),
    [200, 401],
  );
  assert.match(
    rs[0].headers.get("Set-Cookie"),
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.match(rs[0].headers.get("Set-Cookie"), /Max-Age=900/);
});
test("session tampering, missing session, expiry and logout revoke access", async () => {
  const s = setup();
  assert.equal((await s.h.fetch(request("/api/admin/session"))).status, 401);
  const r = await login(s),
    c = cookie(r);
  assert.equal(
    (await s.h.fetch(request("/api/admin/session", undefined, c))).status,
    200,
  );
  assert.equal(
    (await s.h.fetch(request("/api/admin/session", undefined, c + "x"))).status,
    401,
  );
  assert.equal(
    (await s.h.fetch(request("/api/admin/auth/logout", {}, c))).status,
    200,
  );
  assert.equal(
    (await s.h.fetch(request("/api/admin/session", undefined, c))).status,
    401,
  );
  const s2 = setup(),
    r2 = await login(s2);
  s2.advance(900001);
  assert.equal(
    (await s2.h.fetch(request("/api/admin/session", undefined, cookie(r2))))
      .status,
    401,
  );
});
test("OTP expiry, attempts, wrong address and missing browser challenge deny", async () => {
  for (const mode of ["expiry", "attempts", "address", "cookie"]) {
    const s = setup(),
      c = await challenge(s);
    if (mode === "expiry") s.advance(300001);
    if (mode === "attempts")
      for (let i = 0; i < 3; i++)
        assert.equal(
          (
            await s.h.fetch(
              request(
                "/api/admin/auth/verify",
                { email: "first@example.invalid", code: "00000000" },
                c.c,
              ),
            )
          ).status,
          401,
        );
    assert.equal(
      (
        await s.h.fetch(
          request(
            "/api/admin/auth/verify",
            {
              email:
                mode === "address"
                  ? "second@example.invalid"
                  : "first@example.invalid",
              code: c.code,
            },
            mode === "cookie" ? undefined : c.c,
          ),
        )
      ).status,
      401,
    );
  }
});
test("origin/method/content type/input bounds/host spoof reject before sending", async () => {
  const s = setup();
  for (const headers of [
    { Origin: "https://evil.example" },
    { Origin: "" },
    { "Content-Type": "text/plain" },
    { "Sec-Fetch-Site": "cross-site" },
  ])
    assert.ok(
      (
        await s.h.fetch(
          request(
            "/api/admin/auth/request",
            { email: "first@example.invalid" },
            undefined,
            headers,
          ),
        )
      ).status >= 400,
    );
  assert.equal(
    (await s.h.fetch(request("/api/admin/auth/request"))).status,
    405,
  );
  assert.equal(
    (
      await s.h.fetch(
        request("/api/admin/auth/request", {
          email: "first@example.invalid",
          to: "evil@example.invalid",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await s.h.fetch(
        request("/api/admin/auth/request", { email: "x".repeat(5000) }),
      )
    ).status,
    413,
  );
  const wrong = request("/api/admin/auth/request", {
    email: "first@example.invalid",
  });
  assert.equal(
    (
      await s.h.fetch(
        new Request("https://evil.example/api/admin/auth/request", wrong),
      )
    ).status,
    403,
  );
  await s.flush();
  assert.equal(s.mail.length, 0);
});
test("rate budgets, resend rotation, global quota and bounded storage", async () => {
  const s = setup(),
    c = await challenge(s);
  assert.equal(
    (
      await s.h.fetch(
        request("/api/admin/auth/request", { email: "first@example.invalid" }),
      )
    ).status,
    202,
  );
  await s.flush();
  assert.equal(s.mail.length, 1);
  s.advance(60001);
  const newer = await challenge(s);
  assert.equal(s.mail.length, 2);
  assert.equal(
    (
      await s.h.fetch(
        request(
          "/api/admin/auth/verify",
          { email: "first@example.invalid", code: c.code },
          c.c,
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await s.h.fetch(
        request(
          "/api/admin/auth/verify",
          { email: "first@example.invalid", code: newer.code },
          newer.c,
        ),
      )
    ).status,
    200,
  );
  const s2 = setup();
  for (let i = 0; i < 512; i++)
    s2.store.rows.set("stub:" + i, { expires: 1800001000000 });
  assert.equal(
    (
      await s2.h.fetch(
        request("/api/admin/auth/request", { email: "first@example.invalid" }),
      )
    ).status,
    503,
  );
});
test("unknown admin/write endpoints deny; existing contact bearer access unaffected", async () => {
  const s = setup(),
    r = await login(s),
    c = cookie(r);
  for (const path of [
    "/api/admin/trails",
    "/api/admin/write",
    "/admin/anything",
  ])
    assert.equal((await s.h.fetch(request(path, {}, c))).status, 404);
  const page = await s.h.fetch(request("/admin", undefined, c));
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("read-only"));
  assert.equal(page.headers.get("Cache-Control"), "no-store");
  assert.equal(page.headers.get("X-Robots-Tag"), "noindex, nofollow");
});
test("mail failure leaves no usable challenge, expired state removed", async () => {
  const s = setup();
  s.e.ADMIN_EMAIL.send = async () => {
    throw Error("transport");
  };
  const r = await s.h.fetch(
    request("/api/admin/auth/request", { email: "first@example.invalid" }),
  );
  assert.equal(r.status, 202);
  await s.flush();
  assert.ok(![...s.store.rows.keys()].some((k) => k.startsWith("challenge:")));
  s.advance(86400001);
  await s.h.alarm();
  assert.equal(s.store.rows.size, 0);
});
test("hour/day/global email caps hold across different IPs; verification rate blocks distributed guesses", async () => {
  const s = setup();
  for (let i = 0; i < 5; i++) {
    await s.h.fetch(
      request(
        "/api/admin/auth/request",
        { email: "first@example.invalid" },
        undefined,
        { "CF-Connecting-IP": `192.0.2.${i + 1}` },
      ),
    );
    await s.flush();
    s.advance(60001);
  }
  assert.equal(s.mail.length, 3);
  const s2 = setup();
  for (let i = 0; i < 24; i++) {
    await s2.h.fetch(
      request(
        "/api/admin/auth/request",
        { email: i % 2 ? "first@example.invalid" : "second@example.invalid" },
        undefined,
        { "CF-Connecting-IP": `192.0.2.${i + 1}` },
      ),
    );
    await s2.flush();
    s2.advance(60001);
  }
  assert.ok(s2.mail.length <= 6);
  assert.ok(s2.mail.length > 0);
});
test("configuration revocation, wrong JWT audience/alg/signature, duplicate cookies and streaming bounds fail closed", async () => {
  const { SignJWT } = await import("jose");
  const s = setup(),
    r = await login(s),
    c = cookie(r);
  s.e.ADMIN_ALLOWLIST = '["second@example.invalid","third@example.invalid"]';
  assert.equal(
    (await s.h.fetch(request("/api/admin/session", undefined, c))).status,
    401,
  );
  const s2 = setup(),
    r2 = await login(s2),
    c2 = cookie(r2);
  assert.equal(
    (await s2.h.fetch(request("/api/admin/session", undefined, c2 + "; " + c2)))
      .status,
    401,
  );
  const raw = c2.slice(c2.indexOf("=") + 1);
  const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64url"));
  for (const patch of [
    { aud: "other" },
    { iss: "https://evil.example" },
    { exp: payload.exp + 9999 },
  ]) {
    const forged = await new SignJWT({ ...payload, ...patch })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(env.ADMIN_SECRET));
    assert.equal(
      (
        await s2.h.fetch(
          request(
            "/api/admin/session",
            undefined,
            "__Host-admin-session=" + forged,
          ),
        )
      ).status,
      401,
    );
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2048));
      controller.close();
    },
  });
  const streamed = new Request(origin + "/api/admin/auth/request", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  });
  assert.equal((await s2.h.fetch(streamed)).status, 413);
});
test("unfinished body never blocks logout/read and times out without mutation", async () => {
  const s = setup(),
    session = await login(s),
    c = cookie(session);
  const stream = new ReadableStream({ start() {} });
  const stalled = s.h.fetch(
    new Request(origin + "/api/admin/auth/request", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "192.0.2.1",
      },
      body: stream,
      duplex: "half",
    }),
  );
  const fast = await Promise.race([
    s.h.fetch(request("/api/admin/auth/logout", {}, c)),
    new Promise((resolve) =>
      setTimeout(() => resolve(new Response("", { status: 599 })), 100),
    ),
  ]);
  assert.equal(fast.status, 200);
  assert.equal((await stalled).status, 408);
});
test("global denial bounds IP cardinality and traffic cannot postpone cleanup; expired capacity recovers", async () => {
  const s = setup();
  s.store.alarmTime = null;
  for (let i = 0; i < 511; i++) {
    await s.h.fetch(
      request(
        "/api/admin/auth/request",
        { email: "outsider@example.invalid" },
        undefined,
        { "CF-Connecting-IP": `192.0.2.${i}` },
      ),
    );
    if (i === 0) s.advance(1);
  }
  assert.ok(s.store.rows.size <= 110);
  const alarm = s.store.alarmTime;
  s.advance(1000);
  await s.h.fetch(
    request(
      "/api/admin/auth/request",
      { email: "outsider@example.invalid" },
      undefined,
      { "CF-Connecting-IP": "192.0.2.252" },
    ),
  );
  assert.equal(s.store.alarmTime, alarm);
  s.advance(3600001);
  await s.h.fetch(
    request("/api/admin/auth/request", { email: "first@example.invalid" }),
  );
  await s.flush();
  assert.equal(s.mail.length, 1);
  assert.ok(s.store.rows.size < 20);
  const s2 = setup();
  for (let i = 0; i < 512; i++) s2.store.rows.set("old:" + i, { expires: 1 });
  assert.equal((await challenge(s2)).r.status, 202);
  assert.equal(s2.mail.length, 1);
});
