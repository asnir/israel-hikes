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
  const text=await page.locator('.access-section').innerText();assert.ok(text.includes(lang==='he'?'רמת גן':'Ramat Gan'));assert.ok(text.includes('78'));assert.ok(text.includes('80'));assert.ok(text.includes(lang==='he'?'לא אורך המסלול':'not trail length'));
  const facts=await page.locator('.detail-columns > div > .detail-section').first().innerText();assert.ok(!facts.includes('78'));assert.ok(!facts.includes('80'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.access-section').scrollIntoViewIfNeeded();await page.screenshot({path:folder+`/page-arrival-${lang}-${width}.png`});
  await page.locator('.access-section').screenshot({path:folder+`/arrival-${lang}-${width}.png`});
  await page.locator('.access-section select').selectOption('telaviv');assert.ok((await page.locator('.drive-large').innerText()).includes(lang==='he'?'תל אביב':'Tel Aviv'));
  if(lang==='en')assert.deepEqual((await page.locator('body').innerText()).split('\n').filter(s=>/[א-ת]/.test(s)),['עברית']);
 }
 console.log('Driving information: card separation, legacy Ramat Gan, selected city, bilingual labels and no mobile overflow passed.');
}finally{await browser?.close();server.kill()}
