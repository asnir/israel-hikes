# Adapter security notes

The integrity-checked assets come from libsodium-sumo and libsodium-wrappers-sumo0.8.4. Extraction preserves upstream license notices and uses the official high-level crypto_pwhash wrapper with its instantiateWasm loader hook. This packaging adapter has not had an independent cryptographic audit.

Initialization must occur in a handler. Failed initialization disables password hashing until isolate replacement; later/concurrent calls share the same rejected promise and do not retry RNG work or choose another algorithm. Auth fails closed without creating a session.

The official wrapper does not fully wipe derived output in WASM memory. Caller-side wiping cannot promise complete internal zeroization. This residual risk needs an explicit security decision before enabling auth. Preview auth stays disabled.

Generated assets are ignored and must be regenerated with the verified extractor before every Worker bundle/deploy, including the production job that promotes already-tested static assets. Static dist promotion stays unchanged. The old argon2id package is a dev-only independent test fixture, not the production runtime.
