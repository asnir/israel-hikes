import type { PasswordHasher } from './admin-password';

const PASSWORD_BYTES_MAX = 256;
const SALT_BYTES = 16;
const TAG_BYTES = 32;
const MEMORY_KIB = 19456;
const PASSES = 2;
const PARALLELISM = 1;
let hasher: Promise<PasswordHasher> | undefined;

/**
 * Defer the official wrapper's RNG initialization until a request handler.
 * Failed initialization disables hashing until isolate replacement, without retries.
 * The wrapper does not guarantee wiping derived-output copies in WASM memory.
 * Caller-side wiping remains necessary, but is not complete internal zeroization.
 */
export function loadPasswordHasher(): Promise<PasswordHasher> {
  return (hasher ??= import('./vendor/libsodium/wrapper.mjs').then(
    async ({ default: sodium }) => {
      await sodium.ready;
      return (p) => {
        if (
          !(p.password instanceof Uint8Array) ||
          p.password.length > PASSWORD_BYTES_MAX ||
          !(p.salt instanceof Uint8Array) ||
          p.salt.length !== SALT_BYTES ||
          p.parallelism !== PARALLELISM ||
          p.passes !== PASSES ||
          p.memorySize !== MEMORY_KIB ||
          p.tagLength !== TAG_BYTES
        ) {
          throw Error('Invalid fixed KDF parameters');
        }
        return sodium.crypto_pwhash(
          TAG_BYTES,
          p.password,
          p.salt,
          PASSES,
          MEMORY_KIB * 1024,
          sodium.crypto_pwhash_ALG_ARGON2ID13,
        );
      };
    },
  ));
}
