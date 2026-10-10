import type { PasswordHasher } from './admin-password';

let wrapperModule: Promise<typeof import('./vendor/libsodium/wrapper.mjs')> | undefined;
let unavailableUntil = 0;
let integrityFailed = false;
let active = false;

/** Lazy one-use instance, no queue. Best-effort WASM heap hygiene, not all-copy erasure. */
export async function loadPasswordHasher(): Promise<PasswordHasher> {
  return async p => {
    if (integrityFailed || Date.now() < unavailableUntil || active) throw Error('Password runtime unavailable');
    if (!(p.password instanceof Uint8Array) || p.password.length > 256 ||
      !(p.salt instanceof Uint8Array) || p.salt.length !== 16 || p.parallelism !== 1 ||
      p.passes !== 2 || p.memorySize !== 19456 || p.tagLength !== 32) {
      throw Error('Invalid fixed KDF parameters');
    }
    active = true;
    let sodium: Awaited<ReturnType<typeof import('./vendor/libsodium/wrapper.mjs')['createSodium']>> | undefined;
    let before: ArrayBuffer | undefined;
    try {
      const module = await (wrapperModule ??= import('./vendor/libsodium/wrapper.mjs'));
      sodium = await module.createSodium();
      const memory = sodium.libsodium.__capturedMemory;
      if (!(memory instanceof WebAssembly.Memory)) { integrityFailed = true; throw Error('Missing captured memory'); }
      before = memory.buffer;
      const out = sodium.crypto_pwhash(32, p.password, p.salt, 2, 19456 * 1024,
        sodium.crypto_pwhash_ALG_ARGON2ID13);
      if (memory.buffer !== before || out.buffer === memory.buffer) {
        integrityFailed = true;
        out.fill(0);
        throw Error('Password runtime integrity failure');
      }
      return out;
    } catch {
      // Transient initialization/import/allocation failures get bounded backoff.
      // Never cache external error objects or stacks that can retain request frames.
      unavailableUntil = Date.now() + 1000;
      wrapperModule = undefined;
      throw Error('Password runtime unavailable');
    } finally {
      active = false;
      const memory = sodium?.libsodium?.__capturedMemory;
      if (memory) new Uint8Array(memory.buffer).fill(0);
      else if (sodium) integrityFailed = true;
      if (before && before.byteLength) new Uint8Array(before).fill(0);
    }
  };
}
