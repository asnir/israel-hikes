import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server = spawn(
  "node",
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--port",
    "8787",
    "--show-interactive-dev-session=false",
  ],
  { stdio: "ignore" },
);
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; i < 70; i++) {
    try {
      await page.goto("http://127.0.0.1:8787");
      await page.waitForSelector(".trail-card", { timeout: 1000 });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.equal(await page.locator(".trail-card").count(), 24);
  await page
    .getByRole("button", { name: "5 מסלולים שנבדקו", exact: true })
    .click();
  assert.equal(await page.locator(".trail-card").count(), 5);
  await page
    .getByRole("button", { name: "שמירת מסלול", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "שמורים (1)", exact: true }).click();
  assert.equal(await page.locator(".trail-card").count(), 1);
  await page.reload();
  await page.waitForSelector(".trail-card");
  assert.equal(
    await page.getByRole("button", { name: "שמורים (1)", exact: true }).count(),
    1,
  );
  await page
    .getByRole("combobox", { name: "עיר מוצא", exact: true })
    .selectOption("haifa");
  await page.locator("summary").click();
  await page
    .getByRole("textbox", { name: "כתובת לחישוב נסיעה", exact: true })
    .fill("Haifa");
  await page.getByRole("button", { name: "חיפוש", exact: true }).click();
  await page.waitForSelector(".address-results button", { timeout: 20000 });
  await page.locator(".address-results button").first().click();
  await page.getByRole("button", { name: /חישוב כביש ל-/ }).click();
  await page.waitForSelector(".dynamic-origin p", { timeout: 30000 });
  console.log(
    "dynamic status",
    await page.locator(".dynamic-origin p").innerText(),
  );
  await page.getByRole("button", { name: "תצוגת מפה", exact: true }).click();
  await page.waitForSelector(".leaflet-interactive");
  await page.locator(".leaflet-interactive").first().click({ force: true });
  await page.waitForSelector(".map-selected");
  assert.equal(await page.locator(".map-selected").count(), 1);
  await page.screenshot({ path: "/downloads/hikes-map-selected.png" });
  await page.goto("http://127.0.0.1:8787/long/golan");
  await page.waitForSelector(".trail-card");
  await page.screenshot({ path: "/downloads/hikes-long-mobile.png" });
  console.log("errors", errors);
  assert.equal(errors.length, 0);
  await browser.close();
  console.log(
    "UI assertions passed: category, local saved state, city, explicit geocode, routing, clickable map.",
  );
} finally {
  server.kill();
}
