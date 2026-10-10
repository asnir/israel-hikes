import factory from './vendor/libsodium/raw.mjs';
import wasm from './vendor/libsodium/sodium.wasm';

/** Upstream instantiateWasm hook. Failed initialization wipes the captured memory. */
export default async function configuredFactory(options: Record<string, unknown>) {
  let memory: WebAssembly.Memory | undefined;
  try {
    const raw = await factory({
      ...options,
      instantiateWasm(
        imports: WebAssembly.Imports,
        receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
      ) {
        const instance = new WebAssembly.Instance(wasm, imports);
        const memories = Object.values(instance.exports).filter(v => v instanceof WebAssembly.Memory);
        if (memories.length !== 1) throw Error('Unexpected WASM memory exports');
        memory = memories[0] as WebAssembly.Memory;
        const pages = Math.ceil((32 * 1024 * 1024 - memory.buffer.byteLength) / 65536);
        if (pages > 0) memory.grow(pages);
        receive(instance, wasm);
        return instance.exports;
      },
    });
    if (!memory) throw Error('WASM integrity failure');
    raw.__capturedMemory = memory;
    return raw;
  } catch (error) {
    if (memory) new Uint8Array(memory.buffer).fill(0);
    throw error;
  }
}
