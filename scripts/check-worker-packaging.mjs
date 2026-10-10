import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const generated = ['raw.mjs', 'wrapper.mjs', 'sodium.wasm', 'manifest.json'];
const directory = 'worker/vendor/libsodium';
for (const name of generated) fs.rmSync(`${directory}/${name}`, { force: true });
const extraction = spawnSync(process.execPath, ['scripts/extract-libsodium.mjs'], {
  encoding: 'utf8',
});
if (extraction.status !== 0) throw Error(extraction.stderr || 'Extraction failed');
for (const name of generated) {
  if (!fs.existsSync(`${directory}/${name}`)) throw Error(`Missing ${name}`);
}
const pinned=JSON.parse(fs.readFileSync('scripts/libsodium-output-hashes.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(`${directory}/manifest.json`,'utf8'));
for(const [name,hash] of Object.entries(pinned)){
 assert.equal(createHash('sha256').update(fs.readFileSync(`${directory}/${name}`)).digest('hex'),hash);
 assert.equal(manifest.outputs[name].sha256,hash);
}
assert.ok(fs.readFileSync(`${directory}/wrapper.mjs`,'utf8').includes('export async function createSodium()'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-packaging-'));
try {
  for (const config of ['wrangler.preview.jsonc', 'wrangler.jsonc']) {
    const result = spawnSync('node_modules/.bin/wrangler', [
      'deploy', '--config', config, '--dry-run', '--outdir',
      path.join(temporary, config),
    ], { encoding: 'utf8' });
    if (result.status !== 0) throw Error(result.stderr || result.stdout);
    console.log(`Clean generated-assets packaging passed: ${config}`);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
