import { SignJWT, jwtVerify } from 'jose';
import { makeCredential, validCredential, type PasswordHasher } from './admin-password';
import { passwordStrength } from './password-strength';

export interface LifecycleTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string | string[]): Promise<unknown>;
  list(): Promise<Map<string, { target?: string; email?: string; expires: number }>>;
}
export interface LifecycleStorage extends LifecycleTransaction {
  transaction<T>(callback: (txn: LifecycleTransaction) => Promise<T>): Promise<T>;
}
export type Purpose = 'setup' | 'reset' | 'invite';
type Link = { target: string; actor: string; purpose: Purpose; revision: string; expires: number };
const encoder = new TextEncoder();
const LINK_MS = 900000;
const keyPattern = /^[a-f0-9]{64}$/;
const purposes = ['setup', 'invite', 'reset'];
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),
  b => b.toString(16).padStart(2, '0')).join('');
const revisionOf = (value: unknown) => validCredential(value) ? value.revision : 'unprovisioned';

/** Called only through AdminAuth's serialized, same-origin, bounded request path. */
export class PasswordLifecycle {
  private running: Promise<unknown> = Promise.resolve();
  constructor(
    private storage: LifecycleStorage,
    private cfg: { origin: string; secret: string; pepper: string },
    private now: () => number,
    private hasher: () => Promise<PasswordHasher>,
  ) {}
  private serialize<T>(f: () => Promise<T>): Promise<T> {
    const p = this.running.then(f, f);
    this.running = p.catch(() => {});
    return p;
  }
  private async reference(jti: string) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(this.cfg.secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode('password-link:' + jti));
    return 'lifecycle:' + Array.from(new Uint8Array(bytes),
      b => b.toString(16).padStart(2, '0')).join('');
  }
  async issue(input: { target: string; actor: string; purpose: Purpose; bootstrap?: boolean }) {
    return this.serialize(async () => {
      if (!keyPattern.test(input.target) || !keyPattern.test(input.actor) || !purposes.includes(input.purpose)) {
        throw Error('Invalid operation');
      }
      const current = await this.storage.get('credential:' + input.target);
      if (input.purpose === 'reset' ? !validCredential(current) : validCredential(current)) {
        throw Error('Invalid operation');
      }
      const now = this.now(), expires = now + LINK_MS, jti = random(), revision = revisionOf(current);
      const token = await new SignJWT({ purpose: input.purpose, revision, role: 'admin-read-only' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(input.target)
        .setIssuer(this.cfg.origin).setAudience('hikes-password-' + input.purpose)
        .setJti(jti).setIssuedAt(Math.floor(now / 1000)).setExpirationTime(Math.floor(expires / 1000))
        .sign(encoder.encode(this.cfg.secret));
      await this.storage.transaction(async txn => {
        const latest = await txn.get('credential:' + input.target);
        if (revision !== revisionOf(latest)) throw Error('Invalid operation');
        const marker = await txn.get<{expires:number}>('bootstrap:' + input.target);
        if (input.bootstrap && marker && marker.expires > now) throw Error('Bootstrap already used');
        const rows = await txn.list();
        const stale = [...rows].filter(([k, v]) => k.startsWith('lifecycle:') &&
          (v.target === input.target || v.expires <= now)).map(([k]) => k);
        if (stale.length) await txn.delete(stale);
        if (rows.size - stale.length >= 500) throw Error('Unavailable');
        await txn.put(await this.reference(jti), {
          target: input.target, actor: input.actor, purpose: input.purpose, revision, expires,
        });
        if (input.bootstrap) await txn.put('bootstrap:' + input.target, { expires });
      });
      return token;
    });
  }
  async consume(token: unknown, password: unknown, context: string[] = [], allowedTargets?: string[]): Promise<{ ok: boolean; feedback?: string; unavailable?: boolean; invalidLink?: boolean }> {
    return this.serialize(async () => {
      if (typeof token !== 'string' || token.length > 2048) return { ok: false };
      let ref: string, row: Link;
      try {
        const { payload, protectedHeader } = await jwtVerify(token, encoder.encode(this.cfg.secret), {
          algorithms: ['HS256'], issuer: this.cfg.origin,
          requiredClaims: ['sub', 'jti', 'iat', 'exp', 'aud', 'purpose', 'revision', 'role'],
          maxTokenAge: LINK_MS / 1000, clockTolerance: 0, currentDate: new Date(this.now()),
        });
        if (protectedHeader.typ !== 'JWT') return { ok: false, invalidLink: true };
        if (typeof payload.jti !== 'string' || !keyPattern.test(payload.jti) ||
          typeof payload.sub !== 'string' || !keyPattern.test(payload.sub) ||
          !purposes.includes(String(payload.purpose)) ||
          payload.aud !== 'hikes-password-' + payload.purpose || payload.role !== 'admin-read-only' ||
          payload.exp! - payload.iat! > LINK_MS / 1000) return { ok: false };
        if (allowedTargets && !allowedTargets.includes(payload.sub)) return { ok: false };
        ref = await this.reference(payload.jti);
        const found = await this.storage.get<Link>(ref);
        if (!found || found.expires <= this.now() || found.target !== payload.sub ||
          found.purpose !== payload.purpose || found.revision !== payload.revision) return { ok: false };
        row = found;
        const current = await this.storage.get('credential:' + row.target);
        if (row.revision !== revisionOf(current)) return { ok: false };
      } catch { return { ok: false }; }
      const strength = passwordStrength(password, context);
      if (!strength.ok) return { ok: false, feedback: strength.feedback };
      let credential;
      try { credential = await makeCredential(password as string, await this.hasher(), this.cfg.pepper); }
      catch { return { ok: false, unavailable: true }; }
      return this.storage.transaction(async txn => {
        const latest = await txn.get<Link>(ref), old = await txn.get('credential:' + row.target);
        if (!latest || latest.expires <= this.now() || latest.revision !== revisionOf(old)) return { ok: false };
        const rows = await txn.list();
        const remove = [...rows].filter(([k, v]) =>
          (k.startsWith('lifecycle:') && v.target === row.target) ||
          ((k.startsWith('session:') || k.startsWith('challenge:')) && v.email === row.target) ||
          k === 'active:' + row.target).map(([k]) => k);
        await txn.put('credential:' + row.target, credential);
        await txn.delete('bootstrap:' + row.target);
        if (remove.length) await txn.delete(remove);
        return { ok: true };
      });
    });
  }
}
