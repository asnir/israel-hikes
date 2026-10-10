import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['worker/password-strength.ts'],outfile:'/tmp/hikes-strength.mjs',bundle:true,platform:'node',format:'esm'});
const {passwordStrength}=await import('/tmp/hikes-strength.mjs');
test('setup strength checks reject long predictable patterns and expected identity/service values',()=>{
 for(const pw of ['short','passwordpassword123!','12345678901234567890','aaaaaaaaaaaaaaaaaaaa','first@example.invalid','IsraelHikes2026!!'])assert.equal(passwordStrength(pw,['first@example.invalid']).ok,false,pw);
});
test('strength accepts generated passwords/passphrases without arbitrary composition rules',()=>{
 for(const pw of ['violet marmot lantern glacier octopus','R8!kY7#mT2@qV6%pL9','שבלול אורכידאה עפיפון מנדרינה'])assert.equal(passwordStrength(pw).ok,true,pw);
});
test('bounded Unicode inputs, useful safe feedback and no estimator result leaks',()=>{
 for(const pw of ['x'.repeat(257),'😀'.repeat(65),null,{},'a'.repeat(30000)]){const r=passwordStrength(pw);assert.equal(r.ok,false);assert.ok(r.feedback.length);assert.deepEqual(Object.keys(r).sort(),['feedback','ok','score']);}
 const r=passwordStrength('passwordpassword123!');assert.ok(r.feedback.length);assert.ok(!JSON.stringify(r).includes('passwordpassword123!'));
});
