import photos from "../data/photos.json";
import { language, tr } from "../i18n";
import type { Trail } from "../lib/catalog";
function photoRegion(t: Trail): string {
  const r=t.region;
  if (t.id.startsWith("seg-y2y-")) return "galilee";
  if (t.id.startsWith("seg-jer-")) return "jerusalem";
  if (/גולן/.test(r)) return "golan";
  if (/גליל/.test(r)) return "galilee";
  if (/גלבוע|פארק המעיינות|מצפה אבינדב/.test(t.name)) return "gilboa";
  if (/מנשה|השופט/.test(t.name)) return "menashe";
  if (/כרמל/.test(r)) return "carmel";
  if (/ירושלים|הרי יהודה/.test(r)) return "jerusalem";
  if (/מדבר יהודה|מלח/.test(r)) return "judea";
  if (/חוף/.test(r)) return "coast";
  return /נגב/.test(r) ? "negev" : "missing";
}
export default function AreaPhoto({trail}:{trail:Trail}) {
  const p=(photos as Record<string, typeof photos.carmel>)[photoRegion(trail)];
  if (!p) return <p className="fine-print">{language()==="he"?"טרם נוספה תמונת אזור עם רישיון שנבדק.":"A region photo with a checked reuse licence has not been added yet."}</p>;
  return <figure className="area-photo">
    <img src={p.src} alt={language()==="he" ? `תצלום נוף אזורי: ${tr(trail.region)}, לא תיעוד של המסלול` : `Regional landscape: ${tr(trail.region)}. Not a photograph of this specific trail.`} loading="lazy" width="1400" height="700" />
    <figcaption>
      <span>{language()==="he" ? "נוף אזורי להמחשה, לא תיעוד של המסלול או של מצב השטח כיום." : "Regional landscape for context, not the specific trail or current conditions."}</span>
      <small><a href={p.source} target="_blank" rel="noopener noreferrer">{p.title}</a> · {p.author} · <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer">{p.licence}</a> · {language()==="he" ? "הוקטן, הומר ל-WebP ונחתך לתצוגה" : p.changes}</small>
    </figcaption>
  </figure>;
}
