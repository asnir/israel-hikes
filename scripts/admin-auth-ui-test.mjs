import { chromium } from "playwright-core";
import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
await build({
  entryPoints: ["worker/admin-auth.ts"],
  outfile: "/tmp/hikes-auth-ui.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { AdminAuth } = await import("/tmp/hikes-auth-ui.mjs");
const rows = new Map(),
  mail = [],
  jobs = [];
const store = {
  get: async (k) => rows.get(k),
  put: async (k, v) => rows.set(k, v),
  delete: async (k) => rows.delete(k),
  list: async () => new Map(rows),
  setAlarm: async () => {},
};
const env = {
  ADMIN_AUTH_ENABLED: "true",
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
const h = new AdminAuth(store, env, (p) => jobs.push(p));
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
  console.log(
    "Synthetic admin UI login/logout, mobile/desktop layout and accessibility passed",
  );
} finally {
  await browser.close();
}
