import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Contact collection UI, routes, storage handler and public issue path absent',()=>{
 for(const p of ['worker/contact.ts','src/pages/Contact.tsx','src/pages/ContactInbox.tsx','CONTACT_SETUP.md'])assert.equal(fs.existsSync(p),false);
 const app=fs.readFileSync('src/App.tsx','utf8');assert.ok(!app.includes('/contact'));
 const worker=fs.readFileSync('worker/index.ts','utf8');assert.ok(!worker.includes('ContactGateway'));assert.ok(!worker.includes('/api/contact'));assert.ok(!worker.includes('api.github.com'));
 assert.ok(!fs.readFileSync('dist/sitemap.xml','utf8').includes('/contact'));
});
