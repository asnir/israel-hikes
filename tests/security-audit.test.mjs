import test from 'node:test';
import assert from 'node:assert/strict';
import {unexpectedAdvisories} from '../scripts/audit-dependencies.mjs';
const url = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const lock = {packages:{'node_modules/braces':{dev:true}}};
const report = (name, _dev, advisoryUrl) => ({metadata:{}, vulnerabilities:{[name]:{isDirect:false, nodes:['node_modules/braces'], via:[{severity:'high',url:advisoryUrl}]}}});
test('Only the exact accepted dev-only braces advisory is exempt', () => {
  assert.deepEqual(unexpectedAdvisories(report('braces',true,url),lock), []);
  assert.equal(unexpectedAdvisories(report('braces',false,url),{packages:{'node_modules/braces':{dev:false}}}).length, 1);
  assert.equal(unexpectedAdvisories(report('braces',true,'https://example.invalid/other'),lock).length, 1);
  assert.equal(unexpectedAdvisories(report('another-package',true,url),lock).length, 1);
});
test('Malformed or failed audit results fail closed', () => {
  assert.throws(() => unexpectedAdvisories({}));
  assert.throws(() => unexpectedAdvisories({error:'network'}));
});
