import {build} from 'esbuild';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
await build({entryPoints:['worker/admin-auth.ts'],outfile:'/tmp/lifecycle-ui-auth.mjs',bundle:true,platform:'node',format:'esm'});
const {AdminAuth}=await import('/tmp/lifecycle-ui-auth.mjs');
const auth=new AdminAuth({transaction:async()=>{},get:async()=>undefined,list:async()=>new Map()}, {
 ADMIN_AUTH_ENABLED:'true',ADMIN_PASSWORD_ENABLED:'true',ADMIN_OTP_ENABLED:'false',ADMIN_LIFECYCLE_ENABLED:'true',
 ADMIN_LIFECYCLE_SECRET:'l'.repeat(64),ADMIN_PASSWORD_PEPPER:'p'.repeat(64),ADMIN_SECRET:'a'.repeat(64),
 ADMIN_ORIGIN:'https://hikes.example',ADMIN_ALLOWLIST:'["first@example.invalid","second@example.invalid"]',
},()=>{},()=>1800000000000,async()=>()=>new Uint8Array(32));
const browser=await chromium.launch({headless:true});
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const requests=[];let complete;
  await page.route('**/*',async route=>{
   const req=route.request();requests.push(req.url());
   if(new URL(req.url()).pathname==='/api/admin/auth/complete') {
    complete=req.postDataJSON();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});return;
   }
   const r=await auth.fetch(new Request(req.url(),{method:req.method()}));
   await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});
  });
  const token='synthetic-test-token';
  await page.goto('https://hikes.example/admin/setup#'+token);
  await page.waitForFunction(()=>location.hash==='');
  assert.equal(new URL(page.url()).hash,'');
  assert.ok(requests.every(u=>!u.includes(token)));
  await page.locator('#new-password').fill('passwordpassword123!');
  await page.locator('#strength').filter({hasText:'predictable'}).waitFor();
  assert.equal(await page.locator('#new-password').evaluate(e=>e.validity.valid),false);
  await page.locator('#new-password').fill('violet marmot lantern glacier octopus');
  await page.locator('#strength').filter({hasText:'Strong enough'}).waitFor();
  await page.locator('#confirm-password').fill('mismatched synthetic value');
  await page.locator('button').click();
  await page.locator('#status').filter({hasText:'Passwords do not match'}).waitFor();
  assert.equal(complete,undefined);
  await page.screenshot({path:`/downloads/lifecycle-setup-${width}.png`,fullPage:true});
  const axe=await new AxeBuilder({page}).analyze();assert.equal(axe.violations.length,0,JSON.stringify(axe.violations));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#confirm-password').fill('violet marmot lantern glacier octopus');
  await page.locator('button').click();
  await page.locator('#status').filter({hasText:'Password saved. Sign in separately.'}).waitFor();
  assert.equal(complete.token,token);
  assert.equal(await page.locator('#new-password').inputValue(),'');
  assert.equal(await page.locator('#confirm-password').inputValue(),'');
  assert.equal(await page.locator('form').isVisible(),false);
  await page.goto('https://hikes.example/admin/setup');
  await page.locator('#status').filter({hasText:'Link missing'}).waitFor();
  assert.equal(await page.locator('form').isVisible(),false);
  await context.close();
 }
 console.log('Recipient setup: fragment scrubbed/no network leak, local strength, mismatch/no send, cleared fields, no auto-login, missing-link gate,390/1440/no overflow/axe passed');
} finally {await browser.close();}
