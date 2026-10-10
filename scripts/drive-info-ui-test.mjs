import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const folder=process.env.SCREENSHOT_DIR||'/tmp/drive-info';mkdirSync(folder,{recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179'],{stdio:'ignore'});
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:4179');break}catch{await new Promise(r=>setTimeout(r,100))}}
 for(const lang of ['he','en'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4179/?lang='+lang);await page.waitForSelector('.trail-card');
  assert.equal(await page.locator('.card-bottom').first().innerText().then(s=>/\d/.test(s)),false,'No driving numbers in card footer');
  await page.screenshot({path:folder+`/cards-${lang}-${width}.png`});
  await page.goto('http://127.0.0.1:4179/trail/hanadiv?lang='+lang);await page.waitForSelector('.access-section');
  const text=await page.locator('.access-section').innerText();assert.ok(!/Ramat Gan|Tel Aviv|רמת גן|תל אביב|78/.test(text));assert.equal(await page.locator('.access-section select,.drive-large').count(),0);assert.ok(await page.locator('.access-section button').count());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.access-section').scrollIntoViewIfNeeded();await page.screenshot({path:folder+`/page-arrival-${lang}-${width}.png`});
  await page.locator('.access-section').screenshot({path:folder+`/arrival-${lang}-${width}.png`});
  if(lang==='en')assert.deepEqual((await page.locator('body').innerText()).split('\n').filter(s=>/[א-ת]/.test(s)),['עברית']);
 }
 console.log('Driving information: card separation, no fixed-origin estimates, navigation preserved, bilingual labels and no mobile overflow passed.');
}finally{await browser?.close();server.kill()}
