import fs from "node:fs";
const screenshots=process.env.SCREENSHOT_DIR||"/tmp/hikes-screenshots";fs.mkdirSync(screenshots,{recursive:true});
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore'});
try {
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:4173');break}catch{await new Promise(r=>setTimeout(r,100))}}await page.waitForSelector('.trail-card');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
await page.getByRole('button',{name:'English',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='en');
assert.deepEqual(await page.locator('body').innerText().then(s=>s.split('\n').filter(s=>/[א-ת]/.test(s))),['עברית']);
await page.screenshot({path:screenshots+'/hikes-en-mobile.png'});
assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.getByRole('textbox',{name:'Search trails',exact:true}).fill('Ofer');assert.ok(await page.locator('.trail-card').count()>0);
await page.locator('.card-title').first().click();await page.waitForSelector('.detail-heading');assert.deepEqual(await page.locator('body').innerText().then(s=>s.split('\n').filter(s=>/[א-ת]/.test(s))),['עברית']);
await page.screenshot({path:screenshots+'/hikes-en-detail-mobile.png'});
await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');
await page.goto('http://127.0.0.1:4173/long/golan');await page.waitForSelector('.trail-card');assert.deepEqual(await page.locator('body').innerText().then(s=>s.split('\n').filter(s=>/[א-ת]/.test(s))),['עברית']);
await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.trail-card');await page.screenshot({path:screenshots+'/hikes-en-desktop.png'});
await page.getByRole('button',{name:'עברית',exact:true}).click();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
assert.deepEqual(errors,[]);await browser.close();
} finally {server.kill()}
