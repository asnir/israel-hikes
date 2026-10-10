import {chromium} from 'playwright';import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const live=process.env.LIVE_ORIGIN;const origin=live||'http://127.0.0.1:4187';const server=live?null:spawn('node',['node_modules/vite/bin/vite.js','preview','--port','4187','--host','127.0.0.1'],{stdio:'ignore'});const out=process.env.SCREENSHOT_DIR||'/tmp/public-labels';fs.mkdirSync(out,{recursive:true});let browser;
try{browser=await chromium.launch();const p=await browser.newPage();for(let n=0;n<40;n++){try{await p.goto(origin);break}catch{await new Promise(r=>setTimeout(r,100))}}
for(const lang of ['he','en'])for(const width of [390,1440]){await p.setViewportSize({width,height:950});
 for(const path of ['/','/trail/ofer','/trail/ext-26','/trail/seg-y2y-d','/long','/long/golan','/about']){
  await p.goto(origin+path+'?lang='+lang);await p.locator('#main').waitFor();const text=await p.locator('body').innerText();assert(!/נבדקו ב-|רעיונות לבדיקה|checked routes|ideas to check/i.test(text),path);
  assert.equal(await p.locator('.trail-card .badge,.detail-heading .badge').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(path==='/'){const walking=p.getByRole('button',{name:lang==='he'?'174 מסלולי הליכה':'174 walking routes',exact:true});await walking.click();assert.equal(await p.locator('.trail-card').count(),24);const segment=p.getByRole('button',{name:lang==='he'?/59 מקטעי שבילים/:/59 trail sections/});await segment.click();assert.equal(await p.locator('.trail-card').count(),24);await walking.click();await p.screenshot({path:`${out}/home-${lang}-${width}.png`});}
  if(path==='/trail/ofer'){assert(await p.locator('.safety-card a[href="https://www.parks.org.il/category/newsflash/"]').count());await p.screenshot({path:`${out}/detail-${lang}-${width}.png`});}
 }
}console.log('Public labels hidden; walking/section filters, source/safety links, no overflow he/en390/1440 passed');
}finally{await browser?.close();server?.kill()}
