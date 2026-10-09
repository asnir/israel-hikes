import { catalog } from "../lib/catalog";
export const initialFilters = {
  category: "",
  region: "",
  length: "",
  difficulty: "",
  structure: "",
  water: "",
  season: "",
  shade: "",
  landscape: "",
  provenance: "",
  drive: "",
};
export type Filters = typeof initialFilters;
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">הכל</option>
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
}
export default function FilterFields({
  f,
  update,
  advanced,
}: {
  f: Filters;
  update: (k: keyof Filters, v: string) => void;
  advanced: boolean;
}) {
  return (
    <>
      <div className="category-tabs">
        {[
          ["", "כל המסלולים"],
          ["verified", `${catalog.filter(t=>t.category==="verified").length} מסלולים שנבדקו`],
          ["extended", `${catalog.filter(t=>t.category==="extended").length} רעיונות לבדיקה`],
          ["segment", `${catalog.filter(t=>t.category==="segment").length} מקטעי שבילים`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => update("category", id)}
            className={f.category === id ? "chosen" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="basic-filters">
        <Select
          label="אזור"
          value={f.region}
          onChange={(v) => update("region", v)}
          options={[...new Set(catalog.map((t) => t.region))].sort()}
        />
        <Select
          label="אורך"
          value={f.length}
          onChange={(v) => update("length", v)}
          options={["עד 7 ק״מ", "7–15 ק״מ", "מעל 15 ק״מ", "לא ידוע"]}
        />
        <Select
          label="קושי"
          value={f.difficulty}
          onChange={(v) => update("difficulty", v)}
          options={[...new Set(catalog.map((t) => t.level))].sort()}
        />
        <Select
          label="מבנה"
          value={f.structure}
          onChange={(v) => update("structure", v)}
          options={[...new Set(catalog.map((t) => t.structure))].sort()}
        />
      </div>
      {advanced && (
        <div className="advanced-filters">
          <Select
            label="מים (לא אישור רחצה)"
            value={f.water}
            onChange={(v) => update("water", v)}
            options={["מים מוזכרים", "אפשרות טבילה", "מעבר במים", "לא ידוע"]}
          />
          <Select
            label="עונה"
            value={f.season}
            onChange={(v) => update("season", v)}
            options={["אביב", "קיץ", "סתיו", "חורף", "לא ידוע"]}
          />
          <Select
            label="צל"
            value={f.shade}
            onChange={(v) => update("shade", v)}
            options={["צל מוזכר", "בעיקר חשוף", "לא ידוע"]}
          />
          <Select
            label="נוף"
            value={f.landscape}
            onChange={(v) => update("landscape", v)}
            options={["נחל", "מעיינות", "הר", "יער", "חוף", "מכתש", "מערות"]}
          />
          <Select
            label="מקור"
            value={f.provenance}
            onChange={(v) => update("provenance", v)}
            options={["מקורות פומביים", "מסמך משותף"]}
          />
          <Select
            label="נסיעה משוערת"
            value={f.drive}
            onChange={(v) => update("drive", v)}
            options={["עד 90 דקות", "מעל 90 דקות", "לא ידוע"]}
          />
          <p className="fine-print">
            מידע חסר הוא ״לא ידוע״, לא ״אין״. תגיות נוף נגזרות מתיאורי המקור.
          </p>
        </div>
      )}
    </>
  );
}
