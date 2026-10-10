# Best-effort WASM heap hygiene trial

Pinned official libsodium0.8.4core and wrapper body, no custom cryptographic ABI. Extractor hash-checks original files before enclosing the unchanged wrapper in a per-instance creation factory. Dependency changes must re-review that transformation, generated manifest and declarations.

Each fixed-parameter KDF uses a fresh instance. Memory pre-grown to32MiB before any password bytes enter it. Captured buffer must stay identical after computation, and returned output must be a standalone JS copy. Whole captured linear memory is overwritten in finally and the instance is never reused. One active instance, no unbounded queue. Transient init failures receive sanitized503with1second backoff; buffer-growth/copy-integrity failures lock out hashing until isolate recycle.

This is heap hygiene, not guaranteed zeroization. Request JSON strings, data.password, TextEncoder/body buffers, WebCrypto/V8/host copies and transient bytes are not fully controllable. No body logging, password-bearing error messages or claims about DO lifetime. Existing peppered HMAC,256-byte cap and caller-side awaited wipes remain required. Captured init-failure memory is wiped, but every host/init temporary cannot be proven erased.

Generated-wrapper review, pinned output-hash packaging checks, forced-overlap tests and real workerd fixed-parameter no-growth/load tests passed for the disabled-state implementation. Detected growth still means an unwipeable copy may already have existed in freed memory.

Activation still requires real AdminAuth DO measurements with strength dictionaries in the same isolate, dashboard CPU/sampled-memory percentiles, repeated-unavailability telemetry without inputs, and the remaining credential/lifecycle deployment decisions. Process RSS and forced Node GC are not isolate memory or workerd GC measurements. Auth remains disabled.
