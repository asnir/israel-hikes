import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
const server = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
  { stdio: "ignore" },
);
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; i < 30; i++) {
    try {
      await page.goto("http://127.0.0.1:5173");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await page.waitForSelector(".trail-card");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/downloads/hikes-desktop.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/downloads/hikes-mobile.png",
    fullPage: false,
  });
  await page.locator(".results-toolbar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/downloads/hikes-mobile-cards.png" });
  let overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  console.log("home overflow:", overflow);
  await page
    .getByRole("textbox", { name: "חיפוש מסלולים", exact: true })
    .fill("יער עופר");
  await page.waitForTimeout(100);
  console.log("search", await page.locator(".trail-card").count());
  await page.locator(".card-title").first().click();
  await page.waitForSelector(".detail-heading");
  await page.screenshot({ path: "/downloads/hikes-detail-mobile.png" });
  console.log(
    "detail overflow:",
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  );
  await page.goto("http://127.0.0.1:5173/long");
  await page.waitForSelector(".long-card");
  console.log("long", await page.locator(".long-card").count());
  await page.locator(".long-card").first().click();
  await page.waitForSelector(".trail-card");
  console.log("golan segments", await page.locator(".trail-card").count());
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "תצוגת מפה", exact: true }).click();
  await page.waitForSelector(".leaflet-container");
  await page.screenshot({ path: "/downloads/hikes-map-mobile.png" });
  console.log(
    "map markers",
    await page.locator(".leaflet-interactive").count(),
  );
  console.log("errors", errors);
  await browser.close();
} finally {
  server.kill();
}
