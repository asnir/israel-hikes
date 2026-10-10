import factory from './vendor/libsodium/raw.mjs';
import wasm from './vendor/libsodium/sodium.wasm';

/** Upstream loader hook only. No adapter-owned C ABI. */
export default function configuredFactory(options: Record<string, unknown>) {
  return factory({
    ...options,
    instantiateWasm(
      imports: WebAssembly.Imports,
      receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) {
      const instance = new WebAssembly.Instance(wasm, imports);
      receive(instance, wasm);
      return instance.exports;
    },
  });
}
