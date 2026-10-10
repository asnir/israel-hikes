import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import setup from 'argon2id/lib/setup.js';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['worker/password-runtime.ts'],
  outfile: '/tmp/libsodium-runtime-node.mjs',
  bundle: true, format: 'esm', platform: 'node',
  plugins: [{
    name: 'node-wasm-fixture',
    setup(b) {
      b.onResolve({ filter: /sodium\.wasm$/ }, () => ({
        path: 'sodium-node', namespace: 'fixture',
      }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: `import fs from 'node:fs';export default new WebAssembly.Module(fs.readFileSync(${JSON.stringify(process.cwd() + '/worker/vendor/libsodium/sodium.wasm')}));`,
        loader: 'js',
      }));
    },
  }],
});
const { loadPasswordHasher } = await import('/tmp/libsodium-runtime-node.mjs');
const raw = fs.readFileSync('node_modules/argon2id/dist/no-simd.wasm');
const reference = await setup(
  async (i) => WebAssembly.instantiate(raw, i),
  async (i) => WebAssembly.instantiate(raw, i),
);
const p = {
  password: new TextEncoder().encode('synthetic Unicode סיסמה 🔒\0'),
  salt: new Uint8Array(16).fill(1),
  passes: 2, memorySize: 19456, parallelism: 1, tagLength: 32,
};

test('loader deduplicates, matches independent KDF, bounds inputs', async () => {
  const hs = await Promise.all(Array.from({ length: 30 }, () => loadPasswordHasher()));
  assert.equal(new Set(hs).size, 1);
  assert.deepEqual(hs[0](p), reference(p));
  const invalid = [
    { parallelism: 2 }, { memorySize: 1e9 }, { passes: 1 }, { tagLength: 64 },
    { password: new Uint8Array(257) }, { salt: new Uint8Array(15) },
  ];
  for (const patch of invalid) assert.throws(() => hs[0]({ ...p, ...patch }));
  const out = hs[0](p);
  hs[0]({ ...p, password: new Uint8Array(256) });
  assert.deepEqual(out, reference(p));
});

test('extraction reproduces pinned manifest and rejects altered upstream', () => {
  const path = 'node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs';
  const orig = fs.readFileSync(path);
  const manifest = fs.readFileSync('worker/vendor/libsodium/manifest.json');
  try {
    fs.appendFileSync(path, '\n// synthetic test\n');
    assert.notEqual(spawnSync(process.execPath, ['scripts/extract-libsodium.mjs']).status, 0);
    assert.deepEqual(fs.readFileSync('worker/vendor/libsodium/manifest.json'), manifest);
  } finally {
    fs.writeFileSync(path, orig);
  }
  assert.equal(spawnSync(process.execPath, ['scripts/extract-libsodium.mjs']).status, 0);
  assert.deepEqual(fs.readFileSync('worker/vendor/libsodium/manifest.json'), manifest);
});
