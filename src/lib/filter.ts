import { searchText, type Trail } from "./catalog";
import { type Filters } from "../components/Filters";
import { type Drive } from "./drive";
export function matches(t: Trail, q: string, f: Filters, d: Drive | null) {
  return (
    (!q || searchText(t).includes(q.trim().toLocaleLowerCase("he"))) &&
    (!f.category || t.category === f.category) &&
    (!f.region || t.region === f.region) &&
    (!f.length ||
      (f.length === "לא ידוע"
        ? t.km === null
        : t.km !== null &&
          (f.length === "עד 7 ק״מ"
            ? t.km <= 7
            : f.length === "7–15 ק״מ"
              ? t.km > 7 && t.km <= 15
              : t.km > 15))) &&
    (!f.difficulty || t.level === f.difficulty) &&
    (!f.structure || t.structure === f.structure) &&
    (!f.water ||
      (f.water === "לא ידוע"
        ? t.water === "לא ידוע"
        : f.water === "מים מוזכרים"
          ? t.water !== "לא ידוע" && !t.water.includes("לא טיול מים")
          : t.water.includes(f.water))) &&
    (!f.season ||
      (f.season === "לא ידוע"
        ? !t.seasons.length
        : t.seasons.includes(f.season))) &&
    (!f.shade ||
      (f.shade === "לא ידוע"
        ? t.shade === "לא ידוע"
        : f.shade === "צל מוזכר"
          ? t.shade.includes("צל") || t.shade.includes("חורש")
          : t.shade.includes(f.shade))) &&
    (!f.landscape || t.landscape.some((l) => l.includes(f.landscape))) &&
    (!f.provenance || t.provenance === f.provenance) &&
    (!f.drive ||
      (f.drive === "לא ידוע"
        ? !d
        : !!d && (f.drive === "עד 100 ק״מ" ? d.km <= 100 : d.km > 100)))
  );
}
