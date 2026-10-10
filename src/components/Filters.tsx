import i18n, { tr, display } from "../i18n";
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
  drive: ""
};
export type Filters = typeof initialFilters;
export function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return <label className="filter-field">
      {display(label)}
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{tr("הכל")}</option>
        {display(options.map(v => <option key={v} value={v}>{display(v)}</option>))}
      </select>
    </label>;
}
export default function FilterFields({
  f,
  update,
  advanced
}: {
  f: Filters;
  update: (k: keyof Filters, v: string) => void;
  advanced: boolean;
}) {
  return <>
      <div className="category-tabs">
        {display([["", "כל המסלולים"], ["walking", i18n.t("walkingCount", { count: catalog.filter(t => t.category !== "segment").length })], ["segment", i18n.t("segmentCount", { count: catalog.filter(t => t.category === "segment").length })]].map(([id, label]) => <button key={id} onClick={() => update("category", id)} className={f.category === id ? "chosen" : ""}>
            {display(label)}
          </button>))}
      </div>
      <div className="basic-filters">
        <Select label="אזור" value={f.region} onChange={v => update("region", v)} options={[...new Set(catalog.map(t => t.region))].sort()} />
        <Select label="אורך" value={f.length} onChange={v => update("length", v)} options={["עד 7 ק״מ", "7–15 ק״מ", "מעל 15 ק״מ", "לא ידוע"]} />
        <Select label="קושי" value={f.difficulty} onChange={v => update("difficulty", v)} options={[...new Set(catalog.map(t => t.level))].sort()} />
        <Select label="מבנה" value={f.structure} onChange={v => update("structure", v)} options={[...new Set(catalog.map(t => t.structure))].sort()} />
      </div>
      {display(advanced && <div className="advanced-filters">
          <Select label="מים (לא אישור רחצה)" value={f.water} onChange={v => update("water", v)} options={["מים מוזכרים", "אפשרות טבילה", "מעבר במים", "לא ידוע"]} />
          <Select label="עונה" value={f.season} onChange={v => update("season", v)} options={["אביב", "קיץ", "סתיו", "חורף", "לא ידוע"]} />
          <Select label="צל" value={f.shade} onChange={v => update("shade", v)} options={["צל מוזכר", "בעיקר חשוף", "לא ידוע"]} />
          <Select label="נוף" value={f.landscape} onChange={v => update("landscape", v)} options={["נחל", "מעיינות", "הר", "יער", "חוף", "מכתש", "מערות"]} />
          <Select label="מרחק נסיעה משוער" value={f.drive} onChange={v => update("drive", v)} options={["עד 100 ק״מ", "מעל 100 ק״מ", "לא ידוע"]} />
          <p className="fine-print">{tr("מידע חסר הוא ״לא ידוע״, לא ״אין״. תגיות נוף נגזרות מתיאורי המקור.")}</p>
        </div>)}
    </>;
}
