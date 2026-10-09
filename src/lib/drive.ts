import citiesData from "../data/cities.json";
import matrix from "../data/city-estimates.json";
import { coordinates, type Trail } from "./catalog";
export const cities = citiesData;
export type Drive = {
  km: number;
  minutes: number;
  method: "legacy" | "road-estimate" | "air-estimate" | "osrm";
};
export function haversine(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180,
    dlat = (b[0] - a[0]) * r,
    dlon = (b[1] - a[1]) * r;
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dlon / 2) ** 2,
      ),
    )
  );
}
export function estimate(t: Trail, city: string): Drive | null {
  if (city === "legacy") {
    const d = t.access?.ramatGan;
    return d ? { ...d, method: "legacy" } : null;
  }
  if (city === "jerusalem-legacy") {
    const d = t.access?.jerusalem;
    return d ? { ...d, method: "legacy" } : null;
  }
  const m = (
    matrix as Record<string, Record<string, { km: number; minutes: number }>>
  )[city]?.[t.id];
  return m ? { ...m, method: "road-estimate" } : null;
}
export function roughEstimate(
  t: Trail,
  origin: [number, number],
): Drive | null {
  const target = coordinates(t);
  if (!target) return null;
  const km = Math.round(haversine(origin, target) * 1.35);
  return { km, minutes: Math.round(km / 5) * 5, method: "air-estimate" };
}
export const methodLabel = {
  legacy: "אומדן קודם לפי ק״מ בכביש",
  "road-estimate": "אומדן ק״מ בכביש / 60 קמ״ש",
  "air-estimate": "מרחק אווירי × 1.35; לא מרחק כביש",
  osrm: "OSRM, ללא תנועה בזמן אמת",
};
const geocache = new Map<
  string,
  { label: string; lat: number; lon: number }[]
>();
export async function geocode(query: string) {
  const key = query.trim().toLocaleLowerCase();
  if (geocache.has(key)) return geocache.get(key)!;
  const r = await fetch("/api/geocode?q=" + encodeURIComponent(query), {
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error("Geocoding unavailable");
  const data = (await r.json()) as {
    label: string;
    lat: number;
    lon: number;
  }[];
  geocache.set(key, data);
  return data;
}
export async function routeBatch(origin: [number, number], trails: Trail[]) {
  const targets = trails.filter((t) => coordinates(t));
  const results: Record<string, Drive> = {};
  for (let i = 0; i < targets.length; i += 60) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    const part = targets.slice(i, i + 60);
    const r = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        targets: part.map((t) => ({ id: t.id, point: coordinates(t) })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error("Routing unavailable");
    Object.assign(results, await r.json());
  }
  return results;
}
