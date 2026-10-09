import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/validate.yml','utf8');
test('Preview and production are chained, main-only and require explicit enable',()=>{
 assert.match(workflow,/deploy-preview:[\s\S]*needs: \[validate, secrets, security\]/);assert.match(workflow,/deploy-production:[\s\S]*needs: \[validate, deploy-preview\]/);
 assert.equal((workflow.match(/vars\.CLOUDFLARE_DEPLOY_ENABLED == 'true'/g)||[]).length,2);assert.equal((workflow.match(/github.ref == 'refs\/heads\/main'/g)||[]).length,2);
 assert.match(workflow,/deploy-production:[\s\S]*environment:\s*name: production/);assert.ok(!workflow.includes('pull_request_target'));
});
test('Production uses the same preview artifact and only dedicated hiking Workers',()=>{
 assert.match(workflow,/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02[\s\S]*name: preview-dist/);assert.match(workflow,/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093[\s\S]*name: preview-dist/);
 assert.match(workflow,/deploy --config wrangler.preview.jsonc --name israel-hikes-preview/);assert.match(workflow,/deploy --config wrangler.jsonc --name israel-hikes/);assert.ok(!workflow.includes('sliding-puzzle'));
});
test('Both isolated Worker configs enable approved contact with exact hostname and SQLite state',()=>{
 for(const file of ['wrangler.jsonc','wrangler.preview.jsonc']){const s=fs.readFileSync(file,'utf8');assert.match(s,/"CONTACT_ENABLED":"true"/);assert.ok(s.includes("CONTACT_HOSTNAME"));assert.ok(s.includes("TURNSTILE_SITE_KEY"));assert.ok(!s.includes("CONTACT_ADMIN_SECRET"));assert.ok(!s.includes("TURNSTILE_SECRET_KEY"));assert.match(s,/new_sqlite_classes/);assert.ok(!s.includes('GITHUB_ISSUES_TOKEN'));}
 assert.match(fs.readFileSync('wrangler.preview.jsonc','utf8'),/"name": "israel-hikes-preview"/);
});
