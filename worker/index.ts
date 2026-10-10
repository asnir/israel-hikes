import {loadPasswordHasher} from "./password-runtime";
import {AdminAuth,type AdminEnv} from "./admin-auth";
import {catalogResponse} from "./catalog";
import {ContactHandler,enabled,type ContactEnv} from "./contact";
import { DurableObject } from "cloudflare:workers";
/** Cloudflare Worker: static SPA + rate-limited, cached upstream services. */
interface Env extends ContactEnv, AdminEnv {
  ADMIN_AUTH: DurableObjectNamespace;
  CONTACT: DurableObjectNamespace;
  ASSETS: Fetcher;
  UPSTREAM: DurableObjectNamespace;
  NOMINATIM_URL?: string;
  OSRM_URL?: string;
  SERVICE_ENABLED?: string;
  CONTACT_URL?: string;
}
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if(url.pathname==="/admin"||url.pathname.startsWith("/admin/")||url.pathname==="/api/admin"||url.pathname.startsWith("/api/admin/"))return env.ADMIN_AUTH.get(env.ADMIN_AUTH.idFromName("admin-auth")).fetch(request);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const catalogRead=await catalogResponse(request,env.ASSETS);
    if(catalogRead)return catalogRead;
    if(url.pathname==="/api/contact-config")return Response.json({enabled:enabled(env),siteKey:enabled(env)?env.TURNSTILE_SITE_KEY:null},{headers:{"Cache-Control":"no-store"}});
    if(url.pathname==="/api/contact"||url.pathname.startsWith("/api/contact-inbox"))return env.CONTACT.get(env.CONTACT.idFromName("contact")).fetch(request);
    if (env.SERVICE_ENABLED === "false")
      return Response.json({ error: "Services disabled" }, { status: 503 });
    if (
      request.method === "POST" &&
      request.headers.get("Origin") !== url.origin
    )
      return new Response("Forbidden", { status: 403 });
    if (url.pathname != "/api/geocode" && url.pathname != "/api/route")
      return new Response("Not found", { status: 404 });
    return env.UPSTREAM.get(env.UPSTREAM.idFromName(url.pathname)).fetch(
      request,
    );
  },
};
export class UpstreamGateway extends DurableObject<Env> {
  private running: Promise<unknown> = Promise.resolve();
  async fetch(request: Request) {
    const url = new URL(request.url);
    let upstream: string;
    let key: string;
    let routeIds: string[] = [];
    try {
      if (url.pathname === "/api/geocode") {
        if (request.method !== "GET")
          return new Response("Method not allowed", { status: 405 });
        const q = url.searchParams.get("q")?.trim() || "";
        if (q.length < 3 || q.length > 160)
          return Response.json({ error: "Invalid query" }, { status: 400 });
        const lang = url.searchParams.get("lang") === "en" ? "en" : "he";
        const base =
          this.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
        upstream =
          base +
          "/search?format=jsonv2&limit=5&countrycodes=il&accept-language=" + lang + "&q=" +
          encodeURIComponent(q);
        key = "geo:" + lang + ":" + q.toLocaleLowerCase();
      } else {
        if (request.method !== "POST")
          return new Response("Method not allowed", { status: 405 });
        if (Number(request.headers.get("Content-Length")) > 16000)
          return new Response("Too large", { status: 413 });
        const body: any = await request.json();
        const valid = (p: any) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every(Number.isFinite) &&
          p[0] >= 29 &&
          p[0] <= 34 &&
          p[1] >= 34 &&
          p[1] <= 36.5;
        if (
          !valid(body.origin) ||
          !Array.isArray(body.targets) ||
          body.targets.length > 60 ||
          !body.targets.length ||
          body.targets.some(
            (t: any) =>
              !valid(t.point) || typeof t.id !== "string" || t.id.length > 80,
          )
        )
          return Response.json(
            { error: "Invalid coordinates" },
            { status: 400 },
          );
        routeIds = body.targets.map((t: any) => t.id);
        const points = [body.origin, ...body.targets.map((t: any) => t.point)]
          .map((p) => [p[1], p[0]].join(","))
          .join(";");
        upstream =
          (this.env.OSRM_URL || "https://router.project-osrm.org") +
          "/table/v1/driving/" +
          points +
          "?sources=0&annotations=distance,duration";
        key = "route:" + JSON.stringify(body);
      }
      const cached = await this.ctx.storage.get<{ expires: number; data: any }>(
        key,
      );
      if (cached && cached.expires > Date.now())
        return Response.json(cached.data, {
          headers: { "Cache-Control": "private, max-age=3600" },
        });
      // One durable object per service serializes ALL users; cap demand instead of building a queue.
      let release: () => void = () => {};
      const previous = this.running;
      this.running = new Promise<void>((r) => (release = r));
      await previous;
      try {
        const cachedAgain = await this.ctx.storage.get<{
          expires: number;
          data: any;
        }>(key);
        if (cachedAgain && cachedAgain.expires > Date.now())
          return Response.json(cachedAgain.data);
        const lastRequest =
          (await this.ctx.storage.get<number>("lastRequest")) || 0;
        const gap = Date.now() - lastRequest;
        if (gap < 1100)
          return Response.json(
            { error: "Please retry later" },
            { status: 429, headers: { "Retry-After": "2" } },
          );
        await this.ctx.storage.put("lastRequest", Date.now());
        const response = await fetch(upstream, {
          headers: {
            "User-Agent":
              "IsraelHikes/1.0 (trail planning; " +
              (this.env.CONTACT_URL || url.origin) +
              ")",
          },
          signal: AbortSignal.timeout(14000),
        });
        if (!response.ok)
          return Response.json(
            { error: "Upstream unavailable" },
            { status: 503 },
          );
        const raw: any = await response.json();
        let data: any;
        if (url.pathname === "/api/geocode")
          data = raw.map((r: any) => ({
            label: r.display_name,
            lat: Number(r.lat),
            lon: Number(r.lon),
          }));
        else {
          if (raw.code !== "Ok")
            return Response.json({ error: "No route" }, { status: 503 });
          data = {};
          routeIds.forEach((id, i) => {
            const m = raw.distances?.[0]?.[i + 1],
              s = raw.durations?.[0]?.[i + 1];
            if (m != null && s != null)
              data[id] = {
                km: Math.round(m / 1000),
                minutes: Math.round(s / 60),
                method: "osrm",
              };
          });
        }
        await this.ctx.storage.put(key, {
          expires: Date.now() + 7 * 86400000,
          data,
        });
        if (!(await this.ctx.storage.getAlarm()))
          await this.ctx.storage.setAlarm(Date.now() + 86400000);
        return Response.json(data, {
          headers: { "Cache-Control": "private, max-age=3600" },
        });
      } finally {
        release();
      }
    } catch {
      return Response.json({ error: "Service unavailable" }, { status: 503 });
    }
  }
  async alarm() {
    const entries = await this.ctx.storage.list<{ expires: number }>();
    const expired = [...entries]
      .filter(([, v]) => v.expires < Date.now())
      .map(([k]) => k);
    if (expired.length) await this.ctx.storage.delete(expired);
    if (entries.size > expired.length + 1)
      await this.ctx.storage.setAlarm(Date.now() + 86400000);
  }
}

export class ContactGateway extends DurableObject<Env>{private handler=new ContactHandler(this.ctx.storage,this.env);fetch(request:Request){return this.handler.fetch(request)}alarm(){return this.handler.alarm()}}

export class AdminAuthGateway extends DurableObject<Env>{private handler=new AdminAuth(this.ctx.storage,this.env,p=>this.ctx.waitUntil(p),()=>Date.now(),loadPasswordHasher);fetch(request:Request){return this.handler.fetch(request)}alarm(){return this.handler.alarm()}}
