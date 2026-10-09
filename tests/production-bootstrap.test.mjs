import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectWrangler,productionVersion,patchScopedSubdomain} from '../scripts/production-wrangler-version.mjs';
const metadata=s=>({default_environment:{script:{last_deployed_from:s}}});
test('Pinned compatible uploader applies only to recognized origins',()=>{assert.equal(selectWrangler(metadata('dash')),'4.30.0');for(const s of ['wrangler','api'])assert.equal(selectWrangler(metadata(s)),'4.30.0');for(const s of [null,'unknown',undefined])assert.throws(()=>selectWrangler(metadata(s)))});
test('Bootstrap reads only production hiking Worker and fails closed',async()=>{let seen;const opts={accountId:'a'.repeat(32),token:'test-placeholder',fetcher:async u=>{seen=u;return {ok:true,json:async()=>({success:true,result:metadata('dash')})}}};assert.equal(await productionVersion(opts),'4.30.0');assert.equal(seen,'https://api.cloudflare.com/client/v4/accounts/'+opts.accountId+'/workers/services/israel-hikes');await assert.rejects(productionVersion({...opts,fetcher:async()=>({ok:false})}));await assert.rejects(productionVersion({...opts,fetcher:async()=>({ok:true,json:async()=>({success:false})})}));await assert.rejects(productionVersion({...opts,accountId:''}))});

test('Production verification runs after upload error without masking the failed step',async()=>{const{readFile}=await import('node:fs/promises');const s=await readFile('.github/workflows/validate.yml','utf8');assert.match(s,/id: production-upload/);assert.match(s,/always\(\).*steps\.production-upload\.outcome == 'failure'/);assert.ok(!/continue-on-error/.test(s));assert.match(s,/environment:\n      name: production/)});

test('Preview job selects its own dashboard bootstrap version and rejects other Workers',async()=>{
 let seen;const opts={accountId:'a'.repeat(32),token:'test-placeholder',worker:'israel-hikes-preview',fetcher:async u=>{seen=u;return {ok:true,json:async()=>({success:true,result:metadata('dash')})}}};
 assert.equal(await productionVersion(opts),'4.30.0');
 assert.ok(seen.endsWith('/workers/services/israel-hikes-preview'));
 await assert.rejects(productionVersion({...opts,worker:'puzzle'}));
 const{readFile}=await import('node:fs/promises');const s=await readFile('.github/workflows/validate.yml','utf8');
 assert.match(s,/id: preview-wrangler/);
 assert.match(s,/wranglerVersion: \$\{\{ steps\.preview-wrangler\.outputs\.version \}\}/);
 assert.match(s,/production-wrangler-version\.mjs israel-hikes-preview/);
});

test('Scoped patch affects only the optional account URL helper and rejects drift',()=>{
 const marker='async function getWorkersDevSubdomain(complianceConfig, accountId, configPath) {';
 const source=marker+'\noldCode();\n}\nworkerScopedUpdate();';
 const result=patchScopedSubdomain(source);
 assert.ok(result.includes('return "amikamsnir.workers.dev";'));
 assert.ok(result.endsWith('workerScopedUpdate();'));
 assert.throws(()=>patchScopedSubdomain('unknown source'));
 assert.throws(()=>patchScopedSubdomain(marker+marker));
});
