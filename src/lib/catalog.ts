import { english } from "../i18n";
import recommendations from "../data/recommendations.json";
import extended from "../data/extended.json";
import segments from "../data/segments.json";
import longTrails from "../data/long-trails.json";
import accessData from "../data/access.json";
export { recommendations, extended, segments, longTrails };
export type Access = {
  destination: string;
  label: string;
  source: string;
  basis: string;
  mapUrl?: string;
  mapType?: string;
  ramatGan?: { km: number; minutes: number } | null;
  jerusalem?: { km: number; minutes: number } | null;
};
export const access: Record<string, Access> = accessData;
export type Trail = {
  id: string;
  name: string;
  category: "verified" | "extended" | "segment";
  region: string;
  km: number | null;
  level: string;
  structure: string;
  water: string;
  seasons: string[];
  shade: string;
  landscape: string[];
  provenance: string;
  summary: string;
  notes: string[];
  flag: string;
  refs: string[][];
  access?: Access;
  longId?: string;
  detail: any;
};
const region = (s: string) =>
  s.includes("גולן") || s.includes("חרמון")
    ? "גולן וחרמון"
    : s.includes("ירושלים")
      ? "ירושלים והרי יהודה"
      : s.includes("מנשה") || s.includes("כרמל")
        ? "כרמל, מנשה וגלבוע"
        : s.includes("גליל")
          ? "גליל"
          : s.includes("נגב") || s.includes("ערבה") || s.includes("אילת")
            ? "נגב ואילת"
            : s.includes("יהודה") || s.includes("מלח")
              ? "מדבר יהודה וים המלח"
              : s;
export const catalog: Trail[] = [
  ...recommendations.map((t) => ({
    id: t.id,
    name: t.name,
    category: "verified" as const,
    region: region(t.area),
    km: t.km,
    level: t.level,
    structure: "מעגלי",
    water: t.water,
    seasons: t.season.includes("כל השנה")
      ? ["סתיו", "חורף", "אביב", "קיץ"]
      : ["סתיו", "חורף", "אביב", "קיץ"].filter((s) => t.season.includes(s)),
    shade: t.shade,
    landscape: [t.theme],
    provenance: "מקורות פומביים",
    summary: t.intro,
    notes: [t.caution],
    flag: "",
    refs: t.refs,
    access: access[t.id],
    detail: t,
  })),
  ...extended.map((t) => ({
    id: "ext-" + t.n,
    name: t.name,
    category: "extended" as const,
    region: t.region,
    km: t.km,
    level: t.level || "לא ידוע",
    structure: t.grp,
    water: t.water || "לא ידוע",
    seasons: t.seasons,
    shade: t.shade || "לא ידוע",
    landscape: t.landscape,
    provenance: t.src === "friend" ? "מסמך משותף" : "מקורות פומביים",
    summary:
      t.effort ||
      t.seasonNote ||
      t.notes[0] ||
      "רעיון לתכנון. נתוני שטח עדכניים לא נבדקו.",
    notes: [...t.notes, t.seasonNote, t.waterNote].filter(Boolean),
    flag: t.flag || "",
    refs: [...t.links, ...(t.infoUrl ? [[t.infoSource, t.infoUrl]] : [])],
    access: access[String(t.n)],
    detail: t,
  })),
  ...segments.map((t) => ({
    id: "seg-" + t.id,
    name: t.name,
    category: "segment" as const,
    region: region(t.region),
    km: t.km,
    level: t.level || "לא ידוע",
    structure: t.note.includes("מעגלי:") ? "מעגלי" : "קווי",
    water: "לא ידוע",
    seasons: [],
    shade: "לא ידוע",
    landscape: [],
    provenance: "מקורות פומביים",
    summary: t.note,
    notes: [
      t.note,
      "התאמה לטיול יום היא הערכה לפי אורך בלבד. סגירות, צבא ומים לא נבדקו.",
    ],
    flag: "",
    refs: [[t.src, t.url]],
    access: access[t.id],
    longId: t.trail,
    detail: t,
  })),
];
export function coordinates(t: Trail): [number, number] | null {
  const s = t.access?.destination;
  if (!s || !/^\d+\.\d+,\d+\.\d+$/.test(s)) return null;
  const [lat, lng] = s.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
export const categoryLabels = {
  verified: "נבדקו ב-9.10.2026",
  extended: "רעיונות לבדיקה",
  segment: "מקטעי שבילים",
};
export const unknown = "לא ידוע";
export function searchText(t: Trail) {
  return [
    t.name,
    t.region,
    t.level,
    t.structure,
    t.water,
    ...t.seasons,
    t.shade,
    ...t.landscape,
    t.provenance,
    t.summary,
    ...t.notes,
  ]
    .join(" ")
    .toLocaleLowerCase("he") + " " + [t.name,t.region,t.summary,...t.notes,...t.landscape].map(english).join(" ").toLowerCase();
}
