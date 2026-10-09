import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
await build({entryPoints:['src/lib/saved-state.ts'],outdir:'/tmp/hikes-saved-test',bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {parseSaved,toggleSaved}=await import('/tmp/hikes-saved-test/saved-state.mjs');
test('Saved state recovers from corrupt and wrong-shaped storage',()=>{for(const v of [null,'{','false','12','{}'])assert.deepEqual(parseSaved(v),[]);assert.deepEqual(parseSaved('["ofer",null,12,"ofer",""]'),['ofer'])});
test('Toggle adds and removes a stable route ID without mutating input',()=>{const a=['ofer'];assert.deepEqual(toggleSaved(a,'ramat'),['ofer','ramat']);assert.deepEqual(toggleSaved(a,'ofer'),[]);assert.deepEqual(a,['ofer'])});
