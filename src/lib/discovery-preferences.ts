import { catalog } from "./catalog";
import { cities } from "./drive";
import { initialFilters, type Filters } from "../components/Filters";
export const preferencesKey = "shvil-discovery-v1";
export type Preferences = { city: string; search: string; filters: Filters; sort: string; view: "grid" | "map"; onlySaved: boolean };
export function defaultPreferences(): Preferences {
 return { city: "", search: "", filters: {...initialFilters}, sort: "default", view: "grid", onlySaved: false };
}
const values: Record<keyof Filters, string[]> = {
 category: ["walking", "segment"], region: [...new Set(catalog.map(t=>t.region))],
 length: ["עד 7 ק״מ","7–15 ק״מ","מעל 15 ק״מ","לא ידוע"], difficulty: [...new Set(catalog.map(t=>t.level))],
 structure: [...new Set(catalog.map(t=>t.structure))], water: ["מים מוזכרים","אפשרות טבילה","מעבר במים","לא ידוע"],
 season: ["אביב","קיץ","סתיו","חורף","לא ידוע"], shade: ["צל מוזכר","בעיקר חשוף","לא ידוע"],
 landscape: ["נחל","מעיינות","הר","יער","חוף","מכתש","מערות"], provenance: [], drive: ["עד 100 ק״מ","מעל 100 ק״מ","לא ידוע"]
};
export function parsePreferences(raw: string | null): Preferences {
 const result = defaultPreferences();
 try {
  if (!raw || raw.length > 10000) return result;
  const stored = JSON.parse(raw);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return result;
  if (cities.some(c=>c.id===stored.city)) result.city=stored.city;
  if (typeof stored.search === "string") result.search=stored.search.slice(0,160);
  for (const key of Object.keys(initialFilters) as (keyof Filters)[]) {
   if (values[key].includes(stored.filters?.[key])) result.filters[key]=stored.filters[key];
  }
  // Driving filters depend on an origin. Never restore them against missing GPS/address data.
  if (!result.city) result.filters.drive="";
  if (["default","distance","length"].includes(stored.sort)) result.sort=stored.sort;
  if (stored.view === "map") result.view="map";
  result.onlySaved=stored.onlySaved===true;
 } catch { /* Malformed storage is ignored. */ }
 return result;
}
export function loadPreferences(): Preferences {
 try { return parsePreferences(localStorage.getItem(preferencesKey)); } catch { return defaultPreferences(); }
}
export function savePreferences(value: Preferences): boolean {
 try { localStorage.setItem(preferencesKey,JSON.stringify(parsePreferences(JSON.stringify(value))));return true; } catch { return false; }
}
