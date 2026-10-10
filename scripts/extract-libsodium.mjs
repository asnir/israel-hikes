import fs from 'node:fs';
import crypto from 'node:crypto';

const OUTPUT = 'worker/vendor/libsodium';
const sha256 = (bytes) =>
  crypto.createHash('sha256').update(bytes).digest('hex');
const raw = fs.readFileSync(
  'node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs',
  'utf8',
);
const wrapper = fs.readFileSync(
  'node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-wrappers.mjs',
  'utf8',
);
const expected = {
  raw: '4c94708f7e78eac7a32b29e2ce0ff96f4bd599d78c129f27bf8a061e20776c8c',
  wrapper: '40de1ef7cb8f2caae02c2a8f04809151904fa28cb9364cadedc57af89a6c9284',
  wasm: '29dd7daf12daec2afdf7b73101e50679bfe9c38861aa1f0de50ae505ccba99bd',
};
if (sha256(raw) !== expected.raw || sha256(wrapper) !== expected.wrapper) {
  throw Error('Pinned upstream source mismatch');
}
const found = [...raw.matchAll(/"(AGFzbQ[A-Za-z0-9+/=]+)"/g)];
if (found.length !== 1) throw Error('Unexpected asset layout');
const wasm = Buffer.from(found[0][1], 'base64');
if (sha256(wasm) !== expected.wasm || !WebAssembly.validate(wasm)) {
  throw Error('WASM integrity mismatch');
}
const upstreamImport = 'import e from"libsodium-sumo";';
if (!wrapper.startsWith(upstreamImport)) {
  throw Error('Unexpected wrapper import');
}
fs.mkdirSync(OUTPUT, { recursive: true });
fs.writeFileSync(`${OUTPUT}/sodium.wasm`, wasm);
for (const name of ['libsodium-sumo', 'libsodium-wrappers-sumo']) {
  fs.copyFileSync(`node_modules/${name}/LICENSE`, `${OUTPUT}/${name}-LICENSE`);
}
// Remove only pinned inline bytes. The required hook prevents fallback loading.
fs.writeFileSync(`${OUTPUT}/raw.mjs`, raw.replace(found[0][0], '""'));
fs.writeFileSync(
  `${OUTPUT}/wrapper.mjs`,
  wrapper.replace(upstreamImport, 'import e from"../../sodium-factory";'),
);
const outputs = Object.fromEntries(
  ['sodium.wasm', 'raw.mjs', 'wrapper.mjs'].map((name) => [
    name,
    {
      sha256: sha256(fs.readFileSync(`${OUTPUT}/${name}`)),
      bytes: fs.statSync(`${OUTPUT}/${name}`).size,
    },
  ]),
);
const manifest = { version: '0.8.4', upstream: expected, outputs };
fs.writeFileSync(`${OUTPUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest);
