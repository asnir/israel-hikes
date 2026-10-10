export function createSodium(): Promise<{
 libsodium: { HEAPU8: Uint8Array; __capturedMemory: WebAssembly.Memory };
 crypto_pwhash_ALG_ARGON2ID13: number;
 crypto_pwhash(out: number, password: Uint8Array, salt: Uint8Array, ops: number, mem: number, alg: number): Uint8Array;
}>;
