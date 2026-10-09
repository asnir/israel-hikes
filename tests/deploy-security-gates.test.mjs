import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=()=>readFileSync('.github/workflows/validate.yml','utf8');
test('preview cannot run before validation, secret scan and security analysis',()=>{
 const source=workflow();
 assert.match(source,/deploy-preview:\s+needs: \[validate, secrets, security\]/);
 assert.match(source,/secrets:\s+uses: \.\/\.github\/workflows\/secrets\.yml/);
 assert.match(source,/security:\s+uses: \.\/\.github\/workflows\/security\.yml/);
});
test('security workflows run once through Validate on the same commit',()=>{
 for(const path of ['secrets','security']) {
  const source=readFileSync(`.github/workflows/${path}.yml`,'utf8');
  assert.match(source,/on:\s+workflow_call:/);
  assert.doesNotMatch(source,/pull_request:|push:/);
 }
 assert.match(workflow(),/security:\s+uses:[^\n]+\n\s+permissions:\s+contents: read\s+security-events: write/);
 assert.match(workflow(),/deploy-production:\s+needs: \[validate, deploy-preview\]/);
});
