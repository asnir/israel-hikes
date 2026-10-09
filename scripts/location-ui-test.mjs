import {chromium} from 'playwright';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const folder=process.env.SCREENSHOT_DIR||'/tmp/location-ui';mkdirSync(folder,{recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183'],{stdio:'ignore'});let browser;
try{browser=await chromium.launch();const context=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:32.5965,longitude:34.9735,accuracy:20}});const page=await context.newPage();
for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:4183');break}catch{await new Promise(r=>setTimeout(r,100))}}
for(const lang of ['he','en'])for(const width of [390,1440]){
 await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4183/?lang='+lang);await page.waitForSelector('.trail-card');
 let privateCalls=0;page.on('request',r=>{if(/\/api\/(route|geocode)/.test(r.url()))privateCalls++});
 const control=page.locator('.current-location-control button');await control.click();await page.waitForSelector('.location-age');
 assert.equal(await page.locator('.origin-city select').inputValue(),'custom');
 assert.ok((await page.locator('.dynamic-origin').innerText()).includes(lang==='he'?'המיקום הנוכחי שלי':'My current location'));
 assert.equal(await page.locator('.result-controls select').inputValue(),'distance');assert.equal(privateCalls,0);
 const first=await page.locator('.trail-card .card-title').first().getAttribute('href');
 await context.setGeolocation({latitude:29.5577,longitude:34.9519});await control.click();await page.waitForFunction(first=>document.querySelector('.trail-card .card-title')?.getAttribute('href')!==first,first);
 await page.locator('.origin-city select').selectOption('telaviv');assert.equal(await page.locator('.dynamic-origin').count(),0);
 await control.click();await page.waitForSelector('.location-age');await page.locator('.origin-panel').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${folder}/location-${lang}-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:lang==='he'?'סינון':'Filters',exact:true}).click();await page.locator('.advanced-filters select').last().selectOption({index:1});
 await context.setGeolocation({latitude:32.5965,longitude:34.9735});
}
await page.clock.install();await page.clock.fastForward(16*60000);await page.waitForFunction(()=>document.querySelector('.location-age')?.textContent.includes('stale'));assert.equal(await page.locator('.dynamic-origin button').isDisabled(),true);await page.clock.resume();
for(const code of [1,2,3]){await page.addInitScript(code=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_success,error){error({code})}}}),code);await page.goto('http://127.0.0.1:4183/?lang=en');await page.locator('.current-location-control button').click();await page.waitForSelector('.current-location-control [role=status]');assert.equal(await page.locator('.dynamic-origin').count(),0)}
await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined}));await page.goto('http://127.0.0.1:4183/?lang=en');await page.locator('.current-location-control button').click();await page.waitForSelector('.current-location-control [role=status]');assert.equal(await page.locator('.dynamic-origin').count(),0);
await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){success({coords:{latitude:32,longitude:35,accuracy:20},timestamp:Date.now()-16*60000})}}}));await page.goto('http://127.0.0.1:4183/?lang=en');await page.locator('.current-location-control button').click();await page.waitForSelector('.current-location-control [role=status]');assert.equal(await page.locator('.dynamic-origin').count(),0);
await context.close();console.log('Current location: explicit permission, refresh/re-sort, city reset, no automatic routing, denial/unavailable/timeout, bilingual390/1440 passed.');
}finally{await browser?.close();server.kill()}
