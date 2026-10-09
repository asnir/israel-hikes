import { tr, display } from "../i18n";
import { Link } from "react-router-dom";
import { Compass, ExternalLink } from "lucide-react";
export const safetyLinks = [["עדכוני סגירה: רט״ג", "https://www.parks.org.il/category/newsflash/"], ["הודעות למטיילים: קק״ל", "https://www.kkl.org.il/recreation-and-tours/messages/"]];
export function Facts({
  items
}: {
  items: [string, string][];
}) {
  return <dl className="facts">
      {display(items.map(([label, value]) => <div key={label}>
          <dt>{display(label)}</dt>
          <dd>{display(value || "לא ידוע")}</dd>
        </div>))}
    </dl>;
}
export function Sources({
  refs
}: {
  refs: string[][];
}) {
  return <div className="source-links">
      {display(refs.filter(([, u]) => u).map(([l, u], i) => <a key={u + i} href={u} target="_blank" rel="noopener noreferrer">
            {display(l || "מקור")}
            <ExternalLink size={14} />
          </a>))}
    </div>;
}
export function Notice() {
  return <div className="notice">
      <Compass size={21} />
      <p>
        <b>{tr("רעיונות לתכנון, לא הבטחה לתנאי שטח.")}</b>{tr("חמש ההמלצות נבדקו ב-9.10.2026 בלבד. המאגר והמקטעים דורשים בדיקה מחדש לפני יציאה.")}</p>
      <Link to="/about">{tr("מה חשוב לדעת?")}</Link>
    </div>;
}
export function NotFound() {
  return <main id="main" className="page empty">
      <h1>{tr("המסלול לא נמצא")}</h1>
      <Link className="button" to="/">{tr("חזרה למאגר")}</Link>
    </main>;
}
