import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const folder=process.env.SCREENSHOT_DIR||'/tmp/card-navigation';mkdirSync(folder,{recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4181'],{stdio:'ignore'});
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:4181');break}catch{await new Promise(r=>setTimeout(r,100))}}
 for(const lang of ['he','en'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const area of ['summary','facts','padding']){
   await page.goto('http://127.0.0.1:4181/?lang='+lang);await page.waitForSelector('.trail-card');
   const card=page.locator('.trail-card').first();const href=await card.locator('.card-title').getAttribute('href');
   const target=area==='summary'?card.locator('.card-summary'):area==='facts'?card.locator('.card-facts'):card;
   const box=await target.boundingBox();await target.scrollIntoViewIfNeeded();const current=await target.boundingBox();
   assert.ok(box&&current);await page.mouse.click(current.x+(area==='padding'?8:current.width/2),current.y+(area==='padding'?8:current.height/2));
   await page.waitForURL('**'+href);assert.ok((await page.locator('.detail-heading h1').innerText()).length>0);
  }
  await page.goto('http://127.0.0.1:4181/?lang='+lang);await page.waitForSelector('.trail-card');
  const card=page.locator('.trail-card').first();const savedBefore=await card.locator('button.saved').count();await card.locator('button').click();assert.equal(new URL(page.url()).pathname,'/');assert.equal(await card.locator('button.saved').count(),savedBefore?0:1);
  await card.locator('button').focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('class'),'card-title');await page.screenshot({path:folder+`/focus-${lang}-${width}.png`});
  const href=await card.locator('.card-title').getAttribute('href');await page.keyboard.press('Enter');await page.waitForURL('**'+href);
  await page.goto('http://127.0.0.1:4181/?lang='+lang);await page.getByRole('textbox',{name:lang==='he'?'חיפוש מסלולים':'Search trails',exact:true}).fill('Ofer');
  const result=page.locator('.trail-card').first();await result.scrollIntoViewIfNeeded();const b=await result.locator('.card-summary').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForURL('**/trail/ofer');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 console.log('Whole card navigation passed: summaries/facts/padding, independent save, real-link keyboard activation, search, Hebrew/English mobile/desktop.');
}finally{await browser?.close();server.kill()}
