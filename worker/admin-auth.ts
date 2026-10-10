import { SignJWT, jwtVerify } from "jose";
export interface AdminEnv {
  ADMIN_AUTH_ENABLED?: string;
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
  constructor(
    private storage: Storage,
    private env: AdminEnv,
    private waitUntil: (p: Promise<unknown>) => void = () => {},
    private now = () => Date.now(),
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
    if (Number(request.headers.get("Content-Length") || 0) > 1024)
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
            if (size > 1024) throw new Error("size");
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
  private config() {
    try {
      const allowed: unknown = JSON.parse(this.env.ADMIN_ALLOWLIST || "");
      const origin = new URL(this.env.ADMIN_ORIGIN || "");
      if (
        this.env.ADMIN_AUTH_ENABLED !== "true" ||
        !this.env.ADMIN_SECRET ||
        this.env.ADMIN_SECRET.length < 64 ||
        !this.env.ADMIN_EMAIL ||
        origin.protocol !== "https:" ||
        origin.origin !== this.env.ADMIN_ORIGIN ||
        !emailPattern.test(normalize(this.env.ADMIN_EMAIL_FROM)) ||
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
        row = await this.storage.get<{ email: string; expires: number }>(key);
      if (
        !row ||
        row.expires <= this.now() ||
        row.email !== payload.sub ||
        !(
          await Promise.all(cfg.allowed.map((e) => this.digest("email:" + e)))
        ).includes(row.email)
      )
        return null;
      return { key };
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
    ];
    if (path === "/admin" || path === "/admin/") {
      if (request.method !== "GET")
        return response({ error: "Method not allowed" }, 405);
      return new Response(page(!!(await this.session(request))), {
        headers: { ...baseHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
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
    if (Number(request.headers.get("Content-Length") || 0) > 1024)
      return response({ error: "Too large" }, 413);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw Error();
    } catch {
      return response({ error: "Invalid input" }, 400);
    }
    const fields = path.endsWith("/request")
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
    const email = normalize(data.email);
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
    });
    return response(
      { authenticated: true, readOnly: true },
      200,
      cookie("session", token, SESSION_SECONDS),
    );
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
function page(authenticated: boolean) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin login - Israel Hikes</title><link rel="stylesheet" href="/admin/login.css"><body><main><h1>Israel Hikes admin</h1>${authenticated ? '<p>Authenticated. Admin is read-only. Editing is not enabled.</p><button id="logout">Sign out</button>' : '<form id="login"><label>Email <input id="email" type="email" autocomplete="username" maxlength="254" required></label><button id="send" type="button">Send code</button><p><label>Login code <input id="code" aria-describedby="code-help" inputmode="numeric" pattern="[0-9]{8}" autocomplete="one-time-code" maxlength="8"></label></p><p id="code-help">Enter the 8-digit code from your email. It expires in 5 minutes.</p><button type="submit">Sign in</button></form>'}<p id="status" role="status" aria-live="polite"></p><p><a href="/">Return to trails</a></p></main><script src="/admin/login.js" defer></script></body></html>`;
}
const loginScript = `const status=document.getElementById('status');const email=document.getElementById('email');async function call(path,body){const r=await fetch('/api/admin/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('The request failed. Check the details or try again later.');return r.json()}document.getElementById('send')?.addEventListener('click',async()=>{if(!email.reportValidity())return;try{status.textContent=(await call('request',{email:email.value})).message}catch(e){status.textContent=e.message}});document.getElementById('login')?.addEventListener('submit',async e=>{e.preventDefault();try{await call('verify',{email:email.value,code:document.getElementById('code').value});location.reload()}catch(e){status.textContent=e.message}});document.getElementById('logout')?.addEventListener('click',async()=>{try{await call('logout',{});location.reload()}catch(e){status.textContent=e.message}});`;

const loginStyle = `*{box-sizing:border-box}body{margin:0;background:#f3f7f4;color:#19382a;font:18px/1.55 system-ui,sans-serif}main{width:min(100% - 32px,520px);margin:48px auto;padding:28px;background:white;border:1px solid #cad9ce;border-radius:16px}h1{font-size:28px;line-height:1.25;margin:0 0 24px}label{display:block;font-weight:600}input{display:block;width:100%;padding:12px;margin:8px 0 16px;border:1px solid #637a6b;border-radius:8px;font:inherit}button{min-height:44px;padding:10px 18px;background:#185f39;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer}a{color:#185f39}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #ad6400;outline-offset:3px}#status{min-height:28px}#code-help{font-size:16px;color:#394f42}@media(max-width:450px){main{margin:24px auto;padding:20px}h1{font-size:25px}}`;
