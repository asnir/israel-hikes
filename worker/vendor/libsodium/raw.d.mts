interface RawSodium {
 HEAPU8: Uint8Array;
 __capturedMemory?: WebAssembly.Memory;
}
declare const factory: (options: Record<string, unknown>) => Promise<RawSodium>;
export default factory;
