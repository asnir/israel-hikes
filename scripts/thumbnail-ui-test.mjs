import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.SCREENSHOT_DIR||'/tmp/thumbnail-final';mkdirSync(out,{recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--port','4184'],{stdio:'ignore'});let browser;
try{browser=await chromium.launch();const page=await browser.newPage();for(let i=0;i<50;i++){try{await page.goto('http://localhost:4184');break}catch{await new Promise(r=>setTimeout(r,100))}}
for(const lang of ['he','en'])for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.goto('http://localhost:4184/?lang='+lang);await page.waitForSelector('.trail-card');for(let i=0;i<9;i++){await page.locator('.load-more button,button.load-more').count().then(async n=>{if(n)await page.locator('.load-more button,button.load-more').click()})}
for(const card of await page.locator('.trail-card').all()){
 const picture=card.locator('.card-photo, .card-landscape');const size=await picture.boundingBox();assert.ok(Math.abs(size.width-96)<0.1);assert.ok(Math.abs(size.height-96)<0.1);
 const facts=await card.locator('.card-facts').boundingBox();assert.ok(facts.y>=size.y+size.height-1,'Facts below square');
 assert.equal(await card.evaluate(e=>e.scrollWidth>e.clientWidth),false);
 const name=await card.locator('.card-title').getAttribute('href');if(['ofer','hanadiv','shofet','oren','ext-26','ext-96','ext-89'].some(id=>name==='/trail/'+id))await card.screenshot({path:`${out}/${name.split('/').pop()}-${lang}-${width}.png`});
}
await page.locator('.trail-card').first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/cards-${lang}-${width}.png`});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}console.log('All rendered photo/placeholder squares96px; long-title cards fit; facts below squares;3901440he/en passed.');
}finally{await browser?.close();server.kill()}
