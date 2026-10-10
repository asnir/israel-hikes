import { chromium } from "playwright-core";
import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import setup from "argon2id/lib/setup.js";
import fs from "node:fs";
import assert from "node:assert/strict";
await build({
  entryPoints: ["worker/admin-auth.ts"],
  outfile: "/tmp/hikes-auth-ui.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { AdminAuth } = await import("/tmp/hikes-auth-ui.mjs");
await build({
  entryPoints: ["worker/admin-password.ts"],
  outfile: "/tmp/hikes-password-ui.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { makeCredential } = await import("/tmp/hikes-password-ui.mjs");
const wasm = fs.readFileSync("node_modules/argon2id/dist/no-simd.wasm"),
  loader = async (o) => WebAssembly.instantiate(wasm, o),
  hasher = await setup(loader, loader);
const rows = new Map(),
  mail = [],
  jobs = [];
const store = {
  get: async (k) => rows.get(k),
  put: async (k, v) => rows.set(k, v),
  delete: async (k) => rows.delete(k),
  list: async () => new Map(rows),
  getAlarm: async () => null,
  setAlarm: async () => {},
};
const env = {
  ADMIN_AUTH_ENABLED: "true",
  ADMIN_PASSWORD_ENABLED: "true",
  ADMIN_PASSWORD_PEPPER: "p".repeat(64),
  ADMIN_ORIGIN: "https://hikes.example",
  ADMIN_SECRET: "a".repeat(64),
  ADMIN_ALLOWLIST: '["first@example.invalid","second@example.invalid"]',
  ADMIN_EMAIL_FROM: "login@example.invalid",
  ADMIN_EMAIL: {
    send: async (m) => {
      mail.push(m);
    },
  },
};
const hashKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env.ADMIN_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const id = Buffer.from(
  await crypto.subtle.sign(
    "HMAC",
    hashKey,
    new TextEncoder().encode("email:first@example.invalid"),
  ),
).toString("hex");
rows.set(
  "credential:" + id,
  await makeCredential(
    "synthetic only UI passphrase",
    hasher,
    env.ADMIN_PASSWORD_PEPPER,
  ),
);
const h = new AdminAuth(
  store,
  env,
  (p) => jobs.push(p),
  () => Date.now(),
  async () => hasher,
);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://hikes.example/**", async (route) => {
    const q = route.request();
    const r = await h.fetch(
      new Request(q.url(), {
        method: q.method(),
        headers: { ...q.headers(), "CF-Connecting-IP": "192.0.2.1" },
        body: q.postData() || undefined,
      }),
    );
    await route.fulfill({
      status: r.status,
      headers: Object.fromEntries(r.headers),
      body: await r.text(),
    });
  });
  await page.goto("https://hikes.example/admin");
  await page.getByRole("button", { name: "Send code" }).waitFor();
  for (const w of [390, 1440]) {
    await page.setViewportSize({ width: w, height: 820 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.equal(
      results.violations.length,
      0,
      JSON.stringify(results.violations),
    );
  }
  await page.getByLabel("Email", { exact: true }).fill("first@example.invalid");
  await page.getByRole("button", { name: "Send code" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "If this address" })
    .waitFor();
  await Promise.all(jobs);
  assert.equal(mail.length, 1);
  await page
    .getByLabel("Login code", { exact: true })
    .fill(mail[0].text.match(/\b\d{8}\b/)[0]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText("Authenticated. Admin is read-only. Editing is not enabled.")
    .waitFor();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Send code" }).waitFor();
  await page
    .getByLabel("Username (email)", { exact: true })
    .fill("first@example.invalid");
  await page.locator("#password").fill("wrong synthetic passphrase");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "request failed" })
    .waitFor();
  assert.equal(await page.locator("#password").inputValue(), "");
  await page.locator("#password").fill("synthetic only UI passphrase");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page
    .getByText("Authenticated. Admin is read-only. Editing is not enabled.")
    .waitFor();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in with password" }).waitFor();
  for (const w of [390, 1440]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.screenshot({
      path: `/downloads/password-login-${w}.png`,
      fullPage: true,
    });
  }
  console.log(
    "Synthetic admin UI login/logout, mobile/desktop layout and accessibility passed",
  );
} finally {
  await browser.close();
}
