import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
await build({entryPoints:['src/lib/discovery-preferences.ts'],outfile:'/tmp/hikes-discovery-preferences.mjs',bundle:true,platform:'node',format:'esm'});
const {parsePreferences,defaultPreferences,savePreferences,loadPreferences,preferencesKey}=await import('/tmp/hikes-discovery-preferences.mjs');
test('validated browser choices round-trip with no GPS, address, routes or permission',()=>{
 const input={city:'telaviv',search:'ofer',filters:{category:'walking',drive:'עד 100 ק״מ',region:'כרמל, מנשה וגלבוע'},sort:'length',view:'map',onlySaved:true,origin:{point:[32,34],label:'private'},routed:{ofer:10},permission:true};
 const parsed=parsePreferences(JSON.stringify(input));assert.equal(parsed.city,'telaviv');assert.equal(parsed.view,'map');assert.equal(parsed.onlySaved,true);assert.equal(parsed.filters.category,'walking');assert.equal(parsed.filters.provenance,'');assert(!('origin' in parsed));assert(!('routed' in parsed));assert(!('permission' in parsed));
 const data=new Map();global.localStorage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};assert(savePreferences(input));assert.deepEqual(loadPreferences(),parsed);assert(!data.get(preferencesKey).includes('private'));delete global.localStorage;
});
test('malformed and obsolete choices fall back safely',()=>{
 for(const raw of [null,'bad','null','[]','x'.repeat(10001)])assert.deepEqual(parsePreferences(raw),defaultPreferences());
 const parsed=parsePreferences(JSON.stringify({city:'legacy',search:'x'.repeat(300),filters:{category:'verified',drive:'עד 100 ק״מ',region:'bad',provenance:'private'},sort:'bad',view:'bad',onlySaved:'yes'}));assert.equal(parsed.city,'');assert.equal(parsed.search.length,160);assert.deepEqual(parsed.filters,defaultPreferences().filters);assert.equal(parsed.sort,'default');assert.equal(parsed.view,'grid');assert.equal(parsed.onlySaved,false);
});
test('custom/GPS origin and its drive filter never restore; reset leaves defaults',()=>{
 const value=parsePreferences(JSON.stringify({city:'custom',filters:{drive:'עד 100 ק״מ'},origin:{point:[32,34]}}));assert.equal(value.city,'');assert.equal(value.filters.drive,'');assert.deepEqual(parsePreferences(JSON.stringify(defaultPreferences())),defaultPreferences());
});
test('blocked browser storage does not stop discovery',()=>{
 global.localStorage={getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}};assert.deepEqual(loadPreferences(),defaultPreferences());assert.equal(savePreferences(defaultPreferences()),false);delete global.localStorage;
});
test('preferences are included in the full UI gate and never restore a location origin',async()=>{
 const fs=await import('node:fs/promises');const pkg=JSON.parse(await fs.readFile('package.json'));assert(pkg.scripts['test:e2e'].includes('preferences-ui-test.mjs'));
 const home=await fs.readFile('src/pages/Home.tsx','utf8');assert(home.includes('useState(loadPreferences)'));assert(home.includes('useState(restored.city)'));assert(home.includes('O(null);R({})'));assert(!home.includes('useState(restored.origin)'));
});
