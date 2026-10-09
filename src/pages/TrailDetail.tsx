import RouteMap from "../components/RouteMap";
import NavigationMenu from "../components/NavigationMenu";
import TrailGallery from "../components/TrailGallery";
import trailPhotos from "../data/trail-photos.json";
import AreaPhoto from "../components/AreaPhoto";
import { tr, display, driveText } from "../i18n";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpLeft, ArrowRight, Bookmark, AlertTriangle, Compass, Car } from "lucide-react";
import { catalog, categoryLabels, type Trail } from "../lib/catalog";
import { cities, estimate, methodLabel } from "../lib/drive";
import { Facts, Sources, NotFound, safetyLinks } from "../components/Common";
import { useSaved } from "../lib/saved";
function AccessBlock({
  trail: t
}: {
  trail: Trail;
}) {
  const a = t.access;
  const [city, C] = useState("legacy");
  const d = estimate(t, city);
  const origin = city === "legacy" ? "רמת גן" : city === "jerusalem-legacy" ? "ירושלים" : cities.find(c => c.id === city)?.name || "לא ידוע";
  return <section className="detail-section access-section" aria-labelledby="arrival-heading">
      <h2 id="arrival-heading"><Car size={23} aria-hidden="true" />{tr("הגעה ברכב")}</h2>
      <p>{tr("נסיעה לנקודת ההתחלה, לא אורך המסלול או זמן ההליכה.")}</p>
      <label className="filter-field">{tr("מוצא לאומדן")}<select value={city} onChange={e => C(e.target.value)}>
          <option value="legacy">{tr("רמת גן · אומדן קודם")}</option>
          <option value="jerusalem-legacy">{tr("ירושלים · אומדן קודם")}</option>
          {display(cities.map(c => <option key={c.id} value={c.id}>
              {display(c.name)}
            </option>))}
        </select>
      </label>
      <p className="drive-large">
        <span>{tr("נסיעה ממוצא:")} <strong>{display(origin)}</strong><br />{d ? driveText(d.minutes, d.km) : tr("אומדן נסיעה לא ידוע")}</span>
      </p>
      <p className="fine-print">
        {display(d ? methodLabel[d.method] + ". ללא פקקים." : "נקודת התחלה או מרחק לא אומתו.")}{display(" ")}{tr("האומדנים מרמת גן ומירושלים הם נתוני מוצא קודמים, ולא מדידה חדשה ממרכז העיר.")}</p>
      <NavigationMenu trail={t} />
      {display(a && <p className="fine-print">{tr("יעד:")}{display(a.label)}{tr(". תחילת התוואי אינה בהכרח חניה נגישה או אישור כניסה ברכב. אין כאן ניווט לאורך מסלול ההליכה.")}</p>)}
      {display(a?.source && <Sources refs={[["מקור נקודת ההתחלה", a.source]]} />)}
    </section>;
}
export default function TrailDetail() {
  const {
    id
  } = useParams();
  const t = catalog.find(t => t.id === id);
  const {
    saved,
    toggle
  } = useSaved();
  if (!t) return <NotFound />;
  const d = t.detail;
  const photos = (trailPhotos as Record<string, typeof trailPhotos.ofer>)[t.id]?.gallery;
  return <main id="main" className="page detail">
      <Link className="back-link" to="/">
        <ArrowRight size={17} />{tr("לכל המסלולים")}</Link>
      <div className="detail-heading">
        <span className={"badge " + t.category}>
          {display(categoryLabels[t.category])}
        </span>
        <h1>{display(t.name)}</h1>
        <p>
          {display(t.region)} · {display(t.level)} · {display(t.structure)}
        </p>
        <button className="button" onClick={() => toggle(t.id)}>
          <Bookmark size={17} />
          {display(saved.includes(t.id) ? "נשמר במכשיר" : "שמירת המסלול")}
        </button>
      </div>
      {photos?.length ? <TrailGallery photos={photos} /> : <AreaPhoto trail={t} />}
      <p className="detail-lead">{display(t.summary)}</p>
      <div className="notice">
        <Compass size={22} />
        <p>{tr("המידע נכון לבדיקת המקורות ב-9.10.2026, לא למצב השטח כיום. לפני יציאה בודקים סגירות, מזג אוויר וגישה.")}</p>
      </div>
      {display(t.flag && <div className="hazard-block">
          <AlertTriangle />
          <b>{tr("בדיקת סגירות מ-9.10.2026:")}{display(t.flag)}</b>
        </div>)}
      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <h2>{tr("במבט מהיר")}</h2>
            <Facts items={[["אורך", t.km !== null ? t.km + " ק״מ" : "לא ידוע"], ["קושי", t.level], ["מבנה", t.structure], ["מים", t.water], ["עונה", t.category === "verified" ? d.season : t.seasons.join(" · ") || "לא ידוע"], ["צל", t.shade], ["עלייה מצטברת", typeof d.climb === "number" ? d.climb + " מ׳" : d.climb || "לא ידוע"], ["זמן הליכה", d.duration || "לא ידוע"]]} />
          </section>
          {display(t.category === "verified" && <>
              <section className="detail-section">
                <h2>{tr("הגעה, שעות ועלויות")}</h2>
                <Facts items={[["התחלה וסיום", d.start], ["עלות (בדיקה מ-9.10.2026)", d.entry], ["שעות", d.hours], ["רישום", d.registration]]} />
              </section>
              <section className="detail-section">
                <h2>{tr("מהלך ההליכה")}</h2>
                <ol className="steps">
                  {display(d.steps.map((s: string, i: number) => <li key={i}>{display(s)}</li>))}
                </ol>
                <p className="fine-print">{tr("תקציר תכנון בלבד. יש להוריד מפת ניווט מתאימה מהמקור לפני יציאה.")}</p>
              </section>
              <section className="detail-section">
                <h2>{tr("מזג אוויר: מידע היסטורי בלבד")}</h2>
                <p>{display(d.weather)}</p>
                <p className="fine-print">{tr("התחזיות נשמרו מ-9.10.2026 לשבת 10.10.2026 בלבד. הן אינן תחזית עדכנית ואין להסתמך עליהן לטיול אחר.")}</p>
              </section>
            </>)}
          {display(t.category === "segment" && <section className="detail-section">
              <h2>{tr("מקטע מתוך שביל ארוך")}</h2>
              <Facts items={[["התחלה", d.from_], ["סיום", d.to], ["טיול יום לפי אורך", t.km !== null && t.km <= 20 ? "אפשרות לבדיקה, לא אישור התאמה" : "דורש תכנון וקיצור לפי הצורך"]]} />
              <p>{tr("מקטע קווי דורש בדרך כלל רכב שני או הקפצה. אין כאן בדיקת צבא, מים, לינה או סגירות.")}</p>
              <Link className="text-link" to={"/long/" + t.longId}>{tr("לתכנון השביל המלא")}<ArrowUpLeft size={18} />
              </Link>
            </section>)}
          <section className="detail-section">
            <h2>{tr("הערות וזהירות")}</h2>
            {display(t.notes.length ? <ul>
                {display(t.notes.map((s, i) => <li key={i}>{display(s)}</li>))}
              </ul> : <p>{tr("לא ידוע. יש לעיין במקור ולבדוק את תנאי השטח.")}</p>)}
            {display(t.category === "extended" && <p className="fine-print">{tr("מסלולי המאגר הם רעיונות לבדיקה, לא המלצות מאומתות. תיאורי מאמץ אינם דירוג קושי רשמי. עצות לעקיפת חסימות אינן היתר גישה.")}</p>)}
          </section>
          <section className="detail-section">
            <RouteMap trail={t} />
            <h2>{tr("מקורות ומפות")}</h2>
            <Sources refs={t.refs} />
            <p className="fine-print">{tr("מקור:")}{display(t.provenance)}{tr(". המסמך המשותף אינו מפורסם; מוצגים נתוני מסלולים בלבד. יש לבדוק מידע רשמי עדכני.")}</p>
          </section>
        </div>
        <aside>
          <AccessBlock trail={t} />
          <section className="detail-section safety-card">
            <h3>{tr("לפני שיוצאים")}</h3>
            <Sources refs={safetyLinks} />
            <ul>
              <li>{tr("בודקים סגירות וגישה אצל הגורם הרשמי.")}</li>
              <li>{tr("מתאימים את הטיול למזג האוויר וליכולת הקבוצה.")}</li>
              <li>{tr("לוקחים מים ומפה זמינה ללא קליטה.")}</li>
              <li>{tr("במסלול קווי מתכננים חזרה מראש.")}</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>;
}
