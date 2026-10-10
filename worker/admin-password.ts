/** Password KDF parameters are fixed, not caller-selectable. No password logging. */
export type PasswordHasher = (params: {
  password: Uint8Array;
  salt: Uint8Array;
  parallelism: number;
  passes: number;
  memorySize: number;
  tagLength: number;
}) => Uint8Array | Promise<Uint8Array>;
export interface Credential {
  algorithm: "argon2id";
  version: 19;
  memory: 19456;
  passes: 2;
  parallelism: 1;
  salt: string;
  digest: string;
  revision: string;
  expires: number;
}
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const bytes = (hex: string) =>
  Uint8Array.from(hex.match(/../g) || [], (v) => parseInt(v, 16));
export function validPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    [...value].length >= 15 &&
    encoder.encode(value).length <= 256
  );
}
export function validCredential(value: unknown): value is Credential {
  if (!value || typeof value !== "object") return false;
  const c = value as Credential;
  return (
    c.algorithm === "argon2id" &&
    c.version === 19 &&
    c.memory === 19456 &&
    c.passes === 2 &&
    c.parallelism === 1 &&
    /^[a-f0-9]{32}$/.test(c.salt) &&
    /^[a-f0-9]{64}$/.test(c.digest) &&
    /^[a-f0-9]{64}$/.test(c.revision) &&
    c.expires === Number.MAX_SAFE_INTEGER
  );
}
async function pepperKey(secret: string, usage: "sign" | "verify") {
  if (secret.length < 64) throw Error("Invalid configuration");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}
async function derive(password: string, salt: string, hash: PasswordHasher) {
  const input = encoder.encode(password);
  try {
    return await hash({
      password: input,
      salt: bytes(salt),
      parallelism: 1,
      passes: 2,
      memorySize: 19456,
      tagLength: 32,
    });
  } finally {
    input.fill(0);
  }
}
export async function makeCredential(
  password: string,
  hash: PasswordHasher,
  secret: string,
): Promise<Credential> {
  if (!validPassword(password)) throw Error("Invalid password");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16))),
    derived = await derive(password, salt, hash);
  try {
    const digest = hex(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await pepperKey(secret, "sign"),
          derived,
        ),
      ),
    );
    return {
      algorithm: "argon2id",
      version: 19,
      memory: 19456,
      passes: 2,
      parallelism: 1,
      salt,
      digest,
      revision: hex(crypto.getRandomValues(new Uint8Array(32))),
      expires: Number.MAX_SAFE_INTEGER,
    };
  } finally {
    derived.fill(0);
  }
}
export async function verifyPassword(
  password: string,
  credential: unknown,
  hash: PasswordHasher,
  secret: string,
) {
  if (!validPassword(password) || !validCredential(credential)) return false;
  const derived = await derive(password, credential.salt, hash);
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await pepperKey(secret, "verify"),
      bytes(credential.digest),
      derived,
    );
  } finally {
    derived.fill(0);
  }
}
/** Unknown/unprovisioned users perform the same KDF without a valid credential. */
export const dummyCredential: Credential = {
  algorithm: "argon2id",
  version: 19,
  memory: 19456,
  passes: 2,
  parallelism: 1,
  salt: "00".repeat(16),
  digest: "00".repeat(32),
  revision: "00".repeat(32),
  expires: Number.MAX_SAFE_INTEGER,
};
