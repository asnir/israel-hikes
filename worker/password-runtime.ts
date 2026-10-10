import setupWasm from "argon2id/lib/setup.js";
import wasm from "argon2id/dist/no-simd.wasm";
import type { PasswordHasher } from "./admin-password";
let hasher: Promise<PasswordHasher> | undefined;
export function loadPasswordHasher() {
  return (hasher ??= setupWasm(
    async (imports) => ({
      module: wasm,
      instance: await WebAssembly.instantiate(wasm, imports),
    }),
    async (imports) => ({
      module: wasm,
      instance: await WebAssembly.instantiate(wasm, imports),
    }),
  ));
}
