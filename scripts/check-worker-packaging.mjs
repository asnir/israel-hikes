import fs from 'node:fs';
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
