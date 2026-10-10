import {strengthClient} from './strength-client.generated';
import {PasswordLifecycle,type LifecycleStorage,type LifecycleTransaction} from './password-lifecycle';
import {
  verifyPassword,
  validCredential,
  validPassword,
  dummyCredential,
  type Credential,
  type PasswordHasher,
} from "./admin-password";
import { SignJWT, jwtVerify } from "jose";
export interface AdminEnv {
  ADMIN_AUTH_ENABLED?: string;
  ADMIN_LIFECYCLE_ENABLED?: string;
  ADMIN_LIFECYCLE_SECRET?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
  ADMIN_PASSWORD_ENABLED?: string;
  ADMIN_PASSWORD_PEPPER?: string;
  ADMIN_OTP_ENABLED?: string;
  ADMIN_ORIGIN?: string;
  ADMIN_SECRET?: string;
  ADMIN_ALLOWLIST?: string;
  ADMIN_EMAIL_FROM?: string;
  ADMIN_EMAIL?: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<unknown>;
  };
}
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string | string[]): Promise<unknown>;
  list(): Promise<Map<string, { expires: number }>>;
  transaction?<T>(callback:(txn:LifecycleTransaction)=>Promise<T>):Promise<T>;
  getAlarm(): Promise<number | null>;
  setAlarm(time: number): Promise<unknown>;
}
type Challenge = {
  digest: string;
  email: string;
  expires: number;
  attempts: number;
};
const encoder = new TextEncoder(),
  SESSION_SECONDS = 900,
  CODE_MS = 300000;
const emailPattern =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;
const normalize = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";
const hex = (v: ArrayBuffer) =>
  Array.from(new Uint8Array(v), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
function code() {
  const n = new Uint32Array(1);
  do {
    crypto.getRandomValues(n);
  } while (n[0] >= 4200000000);
  return String(n[0] % 100000000).padStart(8, "0");
}
const baseHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
function response(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: { ...baseHeaders, ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
}
function cookie(name: string, value: string, age: number) {
  return `__Host-admin-${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
function readCookie(request: Request, name: string) {
  const values = (request.headers.get("Cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`__Host-admin-${name}=`));
  return values.length === 1 ? values[0].slice(values[0].indexOf("=") + 1) : "";
}
export class AdminAuth {
  private running: Promise<unknown> = Promise.resolve();
  private lifecycle?:PasswordLifecycle;
  constructor(
    private storage: Storage,
    private env: AdminEnv,
    private waitUntil: (p: Promise<unknown>) => void = () => {},
    private now = () => Date.now(),
    private passwordHasher?: () => Promise<PasswordHasher>,
  ) {}
  private serialize<T>(f: () => Promise<T>): Promise<T> {
    const p = this.running.then(f, f);
    this.running = p.catch(() => {});
    return p;
  }
  async fetch(request: Request): Promise<Response> {
    const cfg = this.config();
    if (!cfg) return response({ error: "Admin unavailable" }, 503);
    const url = new URL(request.url);
    if (url.origin !== cfg.origin) return response({ error: "Forbidden" }, 403);
    if (
      ![
        "/api/admin/auth/request",
        "/api/admin/auth/verify",
        "/api/admin/auth/logout",
        "/api/admin/auth/password",
        "/api/admin/auth/link",
        "/api/admin/auth/bootstrap",
        "/api/admin/auth/complete",
      ].includes(url.pathname)
    )
      return this.serialize(() => this.handle(request));
    if (request.method !== "POST")
      return response({ error: "Method not allowed" }, 405);
    if (
      request.headers.get("Origin") !== cfg.origin ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )
      return response({ error: "Forbidden" }, 403);
    if (
      request.headers.get("Content-Type")?.split(";")[0].trim() !==
      "application/json"
    )
      return response({ error: "JSON required" }, 415);
    if (Number(request.headers.get("Content-Length") || 0) > (url.pathname.endsWith("/complete")?4096:1024))
      return response({ error: "Too large" }, 413);
    const reader = request.body?.getReader();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const read = async () => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader)
          while (true) {
            const r = await reader.read();
            if (r.done) break;
            size += r.value.byteLength;
            if (size > (url.pathname.endsWith("/complete")?4096:1024)) throw new Error("size");
            chunks.push(r.value);
          }
        const buffer = new Uint8Array(size);
        let at = 0;
        for (const c of chunks) {
          buffer.set(c, at);
          at += c.length;
        }
        return new TextDecoder().decode(buffer);
      };
      const text = await Promise.race([
        read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 2000);
        }),
      ]);
      return await this.serialize(() => this.handle(request, text));
    } catch (e) {
      void reader?.cancel().catch(() => {});
      return response(
        { error: "Invalid body" },
        e instanceof Error && e.message === "timeout"
          ? 408
          : e instanceof Error && e.message === "size"
            ? 413
            : 400,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  private otpReady() {
    return (
      this.env.ADMIN_OTP_ENABLED !== "false" &&
      !!this.env.ADMIN_EMAIL &&
      emailPattern.test(normalize(this.env.ADMIN_EMAIL_FROM))
    );
  }
  private passwordReady() {
    return (
      this.env.ADMIN_PASSWORD_ENABLED === "true" &&
      !!this.passwordHasher &&
      !!this.env.ADMIN_PASSWORD_PEPPER &&
      this.env.ADMIN_PASSWORD_PEPPER.length >= 64 &&
      this.env.ADMIN_PASSWORD_PEPPER !== this.env.ADMIN_SECRET
    );
  }
  private config() {
    try {
      const allowed: unknown = JSON.parse(this.env.ADMIN_ALLOWLIST || "");
      const origin = new URL(this.env.ADMIN_ORIGIN || "");
      if (
        this.env.ADMIN_AUTH_ENABLED !== "true" ||
        !this.env.ADMIN_SECRET ||
        this.env.ADMIN_SECRET.length < 64 ||
        (!this.otpReady() && !this.passwordReady()) ||
        origin.protocol !== "https:" ||
        origin.origin !== this.env.ADMIN_ORIGIN ||
        !Array.isArray(allowed) ||
        allowed.length !== 2 ||
        new Set(allowed).size !== 2 ||
        !allowed.every(
          (v) =>
            typeof v === "string" && normalize(v) === v && emailPattern.test(v),
        )
      )
        return null;
      return {
        allowed: allowed as string[],
        origin: origin.origin,
        secret: encoder.encode(this.env.ADMIN_SECRET),
      };
    } catch {
      return null;
    }
  }
  private async digest(value: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.env.ADMIN_SECRET!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  }
  private async matches(value: string, expected: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.env.ADMIN_SECRET!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const bytes = Uint8Array.from(expected.match(/../g) || [], (v) =>
      parseInt(v, 16),
    );
    return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(value));
  }
  private async budgetAvailable(key: string, limit: number, window: number) {
    const bucket = Math.floor(this.now() / window);
    const row = await this.storage.get<{ count: number }>(
      `rate:${key}:${bucket}`,
    );
    return !row || row.count < limit;
  }
  private async budget(
    key: string,
    limit: number,
    window: number,
    cooldown = 0,
  ) {
    const now = this.now(),
      bucket = Math.floor(now / window);
    const id = `rate:${key}:${bucket}`;
    const old = await this.storage.get<{ count: number; last: number }>(id);
    if (old && (old.count >= limit || now - old.last < cooldown)) return false;
    await this.storage.put(id, {
      count: (old?.count || 0) + 1,
      last: now,
      expires: (bucket + 1) * window,
    });
    return true;
  }
  private async session(request: Request) {
    const cfg = this.config();
    if (!cfg) return null;
    const token = readCookie(request, "session");
    if (!token || token.length > 2048) return null;
    try {
      const { payload } = await jwtVerify(token, cfg.secret, {
        algorithms: ["HS256"],
        issuer: cfg.origin,
        audience: "hikes-admin",
        requiredClaims: ["sub", "jti", "iat", "exp"],
        maxTokenAge: SESSION_SECONDS,
        clockTolerance: 0,
        currentDate: new Date(this.now()),
      });
      if (
        typeof payload.jti !== "string" ||
        typeof payload.sub !== "string" ||
        payload.exp! - payload.iat! > SESSION_SECONDS
      )
        return null;
      const key = "session:" + (await this.digest("session:" + payload.jti)),
        row = await this.storage.get<{
          email: string;
          expires: number;
          credentialRevision?: string;
          passwordKeyTag?: string;
          authenticatedAt?:number;
          method?:string;
        }>(key);
      if (
        !row ||
        row.expires <= this.now() ||
        row.email !== payload.sub ||
        !(
          await Promise.all(cfg.allowed.map((e) => this.digest("email:" + e)))
        ).includes(row.email)
      )
        return null;
      if (row.credentialRevision) {
        const credential = await this.storage.get<Credential>(
          "credential:" + row.email,
        );
        if (
          !this.passwordReady() ||
          !validCredential(credential) ||
          credential.revision !== row.credentialRevision ||
          row.passwordKeyTag !==
            (await this.digest(
              "password-pepper:" + this.env.ADMIN_PASSWORD_PEPPER,
            ))
        )
          return null;
      }
      return { key, email:row.email, authenticatedAt:row.authenticatedAt||0, method:row.method };
    } catch {
      return null;
    }
  }
  private async handle(request: Request, text = ""): Promise<Response> {
    const cfg = this.config();
    if (!cfg) return response({ error: "Admin unavailable" }, 503);
    const url = new URL(request.url);
    if (url.origin !== cfg.origin) return response({ error: "Forbidden" }, 403);
    const path = url.pathname;
    const posts = [
      "/api/admin/auth/request",
      "/api/admin/auth/verify",
      "/api/admin/auth/logout",
      "/api/admin/auth/password",
        "/api/admin/auth/link",
        "/api/admin/auth/bootstrap",
        "/api/admin/auth/complete",
    ];
    if(path==="/admin/setup") {
      if(request.method!=="GET")return response({},405);
      if(!this.lifecycleReady())return response({error:"Admin unavailable"},503);
      return new Response(setupPage,{headers:{...baseHeaders,"Content-Type":"text/html; charset=utf-8"}});
    }
    if(path==="/admin/strength.js") {
      if(request.method!=="GET")return response({},405);
      if(!this.lifecycleReady())return response({},503);
      return new Response(strengthClient,{headers:{...baseHeaders,"Content-Type":"text/javascript; charset=utf-8"}});
    }
    if(path==="/admin/setup.js") {
      if(request.method!=="GET")return response({},405);
      if(!this.lifecycleReady())return response({error:"Admin unavailable"},503);
      return new Response(setupScript,{headers:{...baseHeaders,"Content-Type":"text/javascript; charset=utf-8"}});
    }
    if (path === "/admin" || path === "/admin/") {
      if (request.method !== "GET")
        return response({ error: "Method not allowed" }, 405);
      return new Response(
        page(
          !!(await this.session(request)),
          this.otpReady(),
          this.passwordReady(),
          this.lifecycleReady(),
        ),
        {
          headers: {
            ...baseHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    }
    if (path === "/admin/login.css") {
      if (request.method !== "GET") return response({}, 405);
      return new Response(loginStyle, {
        headers: { ...baseHeaders, "Content-Type": "text/css; charset=utf-8" },
      });
    }
    if (path === "/admin/login.js") {
      if (request.method !== "GET") return response({}, 405);
      return new Response(loginScript, {
        headers: {
          ...baseHeaders,
          "Content-Type": "text/javascript; charset=utf-8",
        },
      });
    }
    if (path === "/api/admin/session") {
      if (request.method !== "GET") return response({}, 405);
      return (await this.session(request))
        ? response({ authenticated: true, readOnly: true })
        : response({ error: "Unauthorized" }, 401);
    }
    if (!posts.includes(path)) return response({ error: "Not found" }, 404);
    if (request.method !== "POST")
      return response({ error: "Method not allowed" }, 405);
    if (
      request.headers.get("Origin") !== cfg.origin ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )
      return response({ error: "Forbidden" }, 403);
    if (
      request.headers.get("Content-Type")?.split(";")[0].trim() !==
      "application/json"
    )
      return response({ error: "JSON required" }, 415);
    if (Number(request.headers.get("Content-Length") || 0) > (url.pathname.endsWith("/complete")?4096:1024))
      return response({ error: "Too large" }, 413);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw Error();
    } catch {
      return response({ error: "Invalid input" }, 400);
    }
    if(["/api/admin/auth/link","/api/admin/auth/bootstrap","/api/admin/auth/complete"].includes(path))return this.handleLifecycle(request,data);
    const fields = path.endsWith("/password")
      ? ["username", "password"]
      : path.endsWith("/request")
        ? ["email"]
        : path.endsWith("/verify")
          ? ["email", "code"]
          : [];
    if (
      Object.keys(data).some((k) => !fields.includes(k)) ||
      fields.some((k) => typeof data[k] !== "string")
    )
      return response({ error: "Invalid input" }, 400);
    if (path.endsWith("/logout")) {
      const s = await this.session(request);
      if (s) await this.storage.delete(s.key);
      return response({ ok: true }, 200, cookie("session", "", 0));
    }
    const passwordMode = path.endsWith("/password");
    if (
      (passwordMode && !this.passwordReady()) ||
      (!passwordMode && !this.otpReady())
    )
      return response({ error: "Admin unavailable" }, 503);
    const email = normalize(passwordMode ? data.username : data.email);
    if (email.length > 254 || !emailPattern.test(email))
      return response({ error: "Invalid input" }, 400);
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip || ip.length > 64)
      return response({ error: "Admin unavailable" }, 503);
    const now = this.now(),
      ipKey = await this.digest("ip:" + ip),
      emailKey = await this.digest("email:" + email);
    await this.prune();
    const rows = await this.storage.list();
    if (rows.size >= 500) return response({ error: "Admin unavailable" }, 503);
    const alarm = await this.storage.getAlarm();
    if (alarm === null || alarm > now + 3600000)
      await this.storage.setAlarm(now + 3600000);
    if (passwordMode) {
      if (!validPassword(data.password))
        return response({ error: "Invalid credentials" }, 401);
      const window = 900000;
      if (
        !(await this.budgetAvailable("password-ip:" + ipKey, 5, window)) ||
        !(await this.budgetAvailable("password-global", 20, window)) ||
        (cfg.allowed.includes(email) &&
          !(await this.budgetAvailable(
            "password-account:" + emailKey,
            5,
            window,
          )))
      )
        return response({ error: "Invalid credentials" }, 401);
      await this.budget("password-ip:" + ipKey, 5, window);
      await this.budget("password-global", 20, window);
      if (cfg.allowed.includes(email))
        await this.budget("password-account:" + emailKey, 5, window);
      const credential = cfg.allowed.includes(email)
        ? await this.storage.get<Credential>("credential:" + emailKey)
        : undefined;
      const candidate = validCredential(credential)
        ? credential
        : dummyCredential;
      let valid: boolean;
      try {
        valid = await verifyPassword(
          data.password,
          candidate,
          await this.passwordHasher!(),
          this.env.ADMIN_PASSWORD_PEPPER!,
        );
      } catch {
        return response({ error: "Admin unavailable" }, 503);
      }
      if (
        !valid ||
        !validCredential(credential) ||
        !cfg.allowed.includes(email)
      )
        return response({ error: "Invalid credentials" }, 401);
      return this.createSession(emailKey, cfg, credential.revision);
    }
    if (path.endsWith("/request")) {
      const id = random(),
        ck = cookie("challenge", id, 300),
        generic = () =>
          response(
            {
              message:
                "If this address is allowed, a code will arrive shortly.",
            },
            202,
            ck,
          );
      if (!(await this.budget("requests", 100, 3600000))) return generic();
      if (
        !(await this.budget("request-ip:" + ipKey, 10, 3600000, 60000)) ||
        !cfg.allowed.includes(email)
      )
        return generic();
      if (
        !(await this.budget("mail-hour:" + emailKey, 3, 3600000, 60000)) ||
        !(await this.budget("mail-day:" + emailKey, 10, 86400000)) ||
        !(await this.budget("mail-global", 20, 86400000))
      )
        return generic();
      const prev = await this.storage.get<{ id: string }>("active:" + emailKey);
      if (prev) await this.storage.delete("challenge:" + prev.id);
      const otp = code(),
        idKey = await this.digest("challenge-id:" + id),
        digest = await this.digest(`otp:${id}:${emailKey}:${otp}`);
      await this.storage.put("challenge:" + idKey, {
        digest,
        email: emailKey,
        attempts: 0,
        expires: now + CODE_MS,
      });
      await this.storage.put("active:" + emailKey, {
        id: idKey,
        expires: now + CODE_MS,
      });
      const job = Promise.resolve()
        .then(() =>
          this.env.ADMIN_EMAIL!.send({
            from: this.env.ADMIN_EMAIL_FROM!,
            to: email,
            subject: "Israel Hikes admin login code",
            text: `Your login code is ${otp}. It expires in 5 minutes. If you did not request it, ignore this email.`,
          }),
        )
        .catch(() =>
          this.serialize(async () => {
            await this.storage.delete("challenge:" + idKey);
          }),
        );
      this.waitUntil(job);
      return generic();
    }
    if (typeof data.code !== "string" || !/^\d{8}$/.test(data.code))
      return response({ error: "Invalid code" }, 401);
    if (
      !(await this.budget("verify-global", 300, 900000)) ||
      !(await this.budget("verify-ip:" + ipKey, 30, 900000))
    )
      return response({ error: "Invalid code" }, 401);
    const id = readCookie(request, "challenge");
    if (!/^[a-f0-9]{64}$/.test(id))
      return response({ error: "Invalid code" }, 401);
    const key = "challenge:" + (await this.digest("challenge-id:" + id)),
      row = await this.storage.get<Challenge>(key);
    if (
      !row ||
      row.expires <= now ||
      row.attempts >= 3 ||
      row.email !== emailKey ||
      !cfg.allowed.includes(email)
    )
      return response({ error: "Invalid code" }, 401);
    row.attempts++;
    await this.storage.put(key, row);
    if (
      !(await this.matches(`otp:${id}:${emailKey}:${data.code}`, row.digest))
    ) {
      if (row.attempts >= 3) await this.storage.delete(key);
      return response({ error: "Invalid code" }, 401);
    }
    await this.storage.delete(key);
    return this.createSession(emailKey, cfg);
  }
  private async createSession(
    emailKey: string,
    cfg: { secret: Uint8Array; origin: string },
    revision?: string,
  ) {
    const now = this.now();
    const jti = random(),
      expires = now + SESSION_SECONDS * 1000;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(emailKey)
      .setIssuer(cfg.origin)
      .setAudience("hikes-admin")
      .setJti(jti)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(expires / 1000))
      .sign(cfg.secret);
    await this.storage.put("session:" + (await this.digest("session:" + jti)), {
      email: emailKey,
      expires,
      authenticatedAt:now,
      method:revision?"password":"otp",
      ...(revision
        ? {
            credentialRevision: revision,
            passwordKeyTag: await this.digest(
              "password-pepper:" + this.env.ADMIN_PASSWORD_PEPPER,
            ),
          }
        : {}),
    });
    return response(
      { authenticated: true, readOnly: true },
      200,
      cookie("session", token, SESSION_SECONDS),
    );
  }
  private lifecycleReady() {
    return this.env.ADMIN_LIFECYCLE_ENABLED==="true"&&this.passwordReady()&&!!this.storage.transaction&&!!this.env.ADMIN_LIFECYCLE_SECRET&&this.env.ADMIN_LIFECYCLE_SECRET.length>=64&&this.env.ADMIN_LIFECYCLE_SECRET!==this.env.ADMIN_SECRET&&this.env.ADMIN_LIFECYCLE_SECRET!==this.env.ADMIN_PASSWORD_PEPPER;
  }
  private async handleLifecycle(request: Request, data: Record<string, unknown>) {
    if (!this.lifecycleReady()) return response({ error: "Admin unavailable" }, 503);
    const cfg = this.config()!, path = new URL(request.url).pathname;
    const complete = path.endsWith('/complete'), bootstrap = path.endsWith('/bootstrap');
    const fields = complete ? ['token', 'password'] : bootstrap ? ['username', 'secret'] : ['username', 'purpose', 'password'];
    if (Object.keys(data).some(k => !fields.includes(k)) || fields.some(k => typeof data[k] !== 'string')) {
      return response({ error: "Invalid input" }, 400);
    }
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || ip.length > 64) return response({ error: "Admin unavailable" }, 503);
    await this.prune();
    const window = 900000, ipKey = await this.digest('ip:' + ip);
    const failureKey = 'lifecycle-failure-ip:' + ipKey;
    if (!await this.budgetAvailable(failureKey, 30, window)) return response({ error: "Request failed" }, 429);
    const fail = async (status = 403) => {
      // Bound anonymous failure buckets independently from credential/session capacity.
      const rates = [...await this.storage.list()].filter(([key]) => key.startsWith('rate:lifecycle-failure-ip:'));
      if (rates.length < 100 || rates.some(([key]) => key.startsWith('rate:' + failureKey + ':'))) {
        await this.budget(failureKey, 30, window);
      }
      return response({ error: "Request failed" }, status);
    };
    const alarm = await this.storage.getAlarm();
    if (alarm === null || alarm > this.now() + 3600000) await this.storage.setAlarm(this.now() + 3600000);
    this.lifecycle ??= new PasswordLifecycle(this.storage as LifecycleStorage, {
      origin: cfg.origin, secret: this.env.ADMIN_LIFECYCLE_SECRET!, pepper: this.env.ADMIN_PASSWORD_PEPPER!,
    }, this.now, this.passwordHasher!);
    if (complete) {
      const context = cfg.allowed.flatMap(email => [email, ...email.split(/[@.]/)]);
      const result = await this.lifecycle.consume(data.token, data.password, context,
        await Promise.all(cfg.allowed.map(email => this.digest('email:' + email))));
      if (result.unavailable) return response({ error: "Admin unavailable" }, 503);
      if (result.ok) return response({ ok: true, message: "Password saved. Sign in separately." });
      // Valid-link strength feedback is cheap and does not consume failure budget.
      if (result.feedback) return response({ error: result.feedback }, 400);
      return fail(400);
    }
    let actor: string, purpose: 'setup' | 'reset' | 'invite';
    if (bootstrap) {
      const secret = this.env.ADMIN_BOOTSTRAP_SECRET;
      if (!secret || secret.length < 64 || secret === this.env.ADMIN_SECRET ||
        secret === this.env.ADMIN_PASSWORD_PEPPER || secret === this.env.ADMIN_LIFECYCLE_SECRET ||
        typeof data.secret !== 'string' || data.secret.length > 128 || !await this.matches('bootstrap:' + data.secret, await this.digest('bootstrap:' + secret))) {
        return fail();
      }
      actor = ''; purpose = 'setup';
    } else {
      const session = await this.session(request);
      if (!session) return fail();
      actor = session.email;
      if (!['setup', 'reset', 'invite'].includes(String(data.purpose))) return fail();
      purpose = data.purpose as typeof purpose;
      if (session.method === 'otp') {
        if (this.now() - session.authenticatedAt > 300000 || data.password !== '') return fail();
      } else {
        const reauthKey = 'lifecycle-reauth-account:' + actor;
        if (!await this.budgetAvailable(reauthKey, 5, window)) return response({ error: "Request failed" }, 429);
        const credential = await this.storage.get('credential:' + actor);
        if (!validPassword(data.password) || !validCredential(credential)) {
          await this.budget(reauthKey, 5, window); return fail();
        }
        try {
          if (!await verifyPassword(data.password, credential, await this.passwordHasher!(), this.env.ADMIN_PASSWORD_PEPPER!)) {
            await this.budget(reauthKey, 5, window); return fail();
          }
        } catch { return response({ error: "Admin unavailable" }, 503); }
      }
    }
    // Authenticate first, then check membership with uniform failure status.
    const target = normalize(data.username);
    if (!cfg.allowed.includes(target)) return fail();
    const targetKey = await this.digest('email:' + target);
    if (bootstrap) actor = targetKey;
    // Peer-admin bearer delivery is not enabled without recipient-owned delivery.
    if (actor !== targetKey) return fail();
    if (!await this.budgetAvailable('lifecycle-issued:' + actor, 5, window)) return response({ error: "Request failed" }, 429);
    try {
      const token = await this.lifecycle.issue({ target: targetKey, actor, purpose, bootstrap });
      await this.budget('lifecycle-issued:' + actor, 5, window);
      return response({ url: cfg.origin + '/admin/setup#' + token, expiresIn: 900, purpose, role: 'admin-read-only' });
    } catch { return response({ error: "Request failed" }, 400); }
  }
  private async prune() {
    const rows = await this.storage.list();
    const expired = [...rows]
      .filter(([, v]) => v.expires <= this.now())
      .map(([k]) => k);
    if (expired.length) await this.storage.delete(expired);
  }
  alarm() {
    return this.serialize(async () => {
      await this.prune();
      await this.storage.setAlarm(this.now() + 3600000);
    });
  }
}
function page(authenticated: boolean, otp = true, password = false, lifecycle=false) {
  const otpForm = otp
    ? '<section aria-labelledby="otp-title"><h2 id="otp-title">Email code</h2><form id="login"><label>Email <input id="email" type="email" autocomplete="username" maxlength="254" required></label><button id="send" type="button">Send code</button><p><label>Login code <input id="code" aria-describedby="code-help" inputmode="numeric" pattern="[0-9]{8}" autocomplete="one-time-code" maxlength="8"></label></p><p id="code-help">Enter the 8-digit code from your email. It expires in 5 minutes.</p><button type="submit">Sign in</button></form></section>'
    : "";
  const passwordForm = password
    ? '<section aria-labelledby="password-title"><h2 id="password-title">Password</h2><form id="password-login"><label>Username (email) <input id="username" type="email" autocomplete="username" maxlength="254" required></label><label>Password <input id="password" type="password" autocomplete="current-password" maxlength="256" required></label><button type="submit">Sign in with password</button></form><p>No public registration or password reset is available.</p></section>'
    : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin login - Israel Hikes</title><link rel="stylesheet" href="/admin/login.css"><body><main><h1>Israel Hikes admin</h1>${authenticated ? '<p>Authenticated. Admin is read-only. Editing is not enabled.</p><button id="logout">Sign out</button>'+ (lifecycle?issuerForm:'') : otpForm + passwordForm}<p id="status" role="status" aria-live="polite"></p><p><a href="/">Return to trails</a></p></main><script src="/admin/login.js" defer></script></body></html>`;
}
const loginScript = `document.getElementById('link-issuer')?.addEventListener('submit',async e=>{e.preventDefault();const pw=document.getElementById('reauth');const result=document.getElementById('link-result');result.textContent='';try{const r=await call('link',{username:document.getElementById('recipient').value,purpose:document.getElementById('purpose').value,password:pw.value});const a=document.createElement('a');a.href=r.url;a.textContent=r.url;result.replaceChildren(a)}catch(e){result.textContent=e.message}finally{pw.value=''}});document.getElementById('password-login')?.addEventListener('submit',async e=>{e.preventDefault();const field=document.getElementById('password');try{await call('password',{username:document.getElementById('username').value,password:field.value});field.value='';location.reload()}catch(e){field.value='';status.textContent=e.message}});const status=document.getElementById('status');const email=document.getElementById('email');async function call(path,body){const r=await fetch('/api/admin/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('The request failed. Check the details or try again later.');return r.json()}document.getElementById('send')?.addEventListener('click',async()=>{if(!email.reportValidity())return;try{status.textContent=(await call('request',{email:email.value})).message}catch(e){status.textContent=e.message}});document.getElementById('login')?.addEventListener('submit',async e=>{e.preventDefault();try{await call('verify',{email:email.value,code:document.getElementById('code').value});location.reload()}catch(e){status.textContent=e.message}});document.getElementById('logout')?.addEventListener('click',async()=>{try{await call('logout',{});location.reload()}catch(e){status.textContent=e.message}});`;

const loginStyle = `*{box-sizing:border-box}body{margin:0;background:#f3f7f4;color:#19382a;font:18px/1.55 system-ui,sans-serif}main{width:min(100% - 32px,520px);margin:48px auto;padding:28px;background:white;border:1px solid #cad9ce;border-radius:16px}h1{font-size:28px;line-height:1.25;margin:0 0 24px}label{display:block;font-weight:600}input{display:block;width:100%;padding:12px;margin:8px 0 16px;border:1px solid #637a6b;border-radius:8px;font:inherit}button{min-height:44px;padding:10px 18px;background:#185f39;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer}a{color:#185f39}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #ad6400;outline-offset:3px}#status{min-height:28px}#code-help{font-size:16px;color:#394f42}@media(max-width:450px){main{margin:24px auto;padding:20px}h1{font-size:25px}}`;

const issuerForm=`<section><h2>Your password links</h2><form id="link-issuer"><label>Your username <input id="recipient" type="email" autocomplete="off" required></label><label>Operation <select id="purpose"><option value="setup">Initial setup</option><option value="reset">Password reset</option></select></label><label>Your current password <input id="reauth" type="password" autocomplete="current-password"></label><p>For email-code login, sign in again within 5 minutes and leave password empty. Links expire in 15 minutes. Only self-service links are enabled. Links do not add identities or roles.</p><button>Create private link</button></form><p id="link-result" role="status"></p><p>Send this private link only to the named recipient. Anyone with the link can set your password. Peer invitations need a recipient-owned delivery flow before they can be enabled. New identities require separate approval and configuration.</p></section>`;
const setupPage=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set password - Israel Hikes</title><link rel="stylesheet" href="/admin/login.css"><body><main><h1>Set your password</h1><form id="setup"><label>New password <input id="new-password" type="password" autocomplete="new-password" aria-describedby="strength" required></label><p id="strength" role="status">Use at least 15 characters. Choose several unrelated words or a password manager-generated password. Common and predictable passwords are rejected.</p><label>Confirm password <input id="confirm-password" type="password" autocomplete="new-password" required></label><button>Save password</button></form><p id="status" role="status" aria-live="polite"></p><a href="/admin">Sign in</a></main><script src="/admin/setup.js"></script></body></html>`;
const setupScript=`let token=location.hash.slice(1);history.replaceState(null,'',location.pathname);import('/admin/strength.js').then(m=>m.attachStrength());const form=document.getElementById('setup'),pw=document.getElementById('new-password'),confirm=document.getElementById('confirm-password'),status=document.getElementById('status');if(!token){form.hidden=true;status.textContent='Link missing. Ask for a new private link.'}form.addEventListener('submit',async e=>{e.preventDefault();if(pw.value!==confirm.value){status.textContent='Passwords do not match.';return}const value=pw.value;pw.value='';confirm.value='';try{const r=await fetch('/api/admin/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:value})});const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed');token='';form.hidden=true;status.textContent='Password saved. Sign in separately.'}catch(e){status.textContent=e.message}});`;
