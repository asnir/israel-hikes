import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpLeft,
  ArrowRight,
  Bookmark,
  AlertTriangle,
  Compass,
  Clock,
} from "lucide-react";
import { catalog, categoryLabels, type Trail } from "../lib/catalog";
import { cities, estimate, methodLabel } from "../lib/drive";

import { Facts, Sources, NotFound, safetyLinks } from "../components/Common";
import { useSaved } from "../lib/saved";
function AccessBlock({ trail: t }: { trail: Trail }) {
  const a = t.access;
  const [city, C] = useState("legacy");
  const d = estimate(t, city);
  return (
    <section className="detail-section">
      <h2>הגעה לנקודת ההתחלה</h2>
      <label className="filter-field">
        מוצא לאומדן
        <select value={city} onChange={(e) => C(e.target.value)}>
          <option value="legacy">רמת גן · אומדן קודם</option>
          <option value="jerusalem-legacy">ירושלים · אומדן קודם</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <p className="drive-large">
        <Clock size={22} />
        {d ? "כ-" + d.minutes + " דקות · כ-" + d.km + " ק״מ" : "לא ידוע"}
      </p>
      <p className="fine-print">
        {d
          ? methodLabel[d.method] + ". ללא פקקים."
          : "נקודת התחלה או מרחק לא אומתו."}{" "}
        האומדנים מרמת גן ומירושלים הם נתוני מוצא קודמים, ולא מדידה חדשה ממרכז העיר.
      </p>
      {a?.mapUrl && (
        <a
          className="button primary"
          href={a.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          ניווט להתחלה ב-Google Maps <ArrowUpLeft size={17} />
        </a>
      )}
      {a && (
        <p className="fine-print">
          יעד: {a.label}. תחילת התוואי אינה בהכרח חניה נגישה או אישור כניסה
          ברכב. אין כאן ניווט לאורך מסלול ההליכה.
        </p>
      )}
      {a?.source && <Sources refs={[["מקור נקודת ההתחלה", a.source]]} />}
    </section>
  );
}
export default function TrailDetail() {
  const { id } = useParams();
  const t = catalog.find((t) => t.id === id);
  const { saved, toggle } = useSaved();
  if (!t) return <NotFound />;
  const d = t.detail;
  return (
    <main id="main" className="page detail">
      <Link className="back-link" to="/">
        <ArrowRight size={17} />
        לכל המסלולים
      </Link>
      <div className="detail-heading">
        <span className={"badge " + t.category}>
          {categoryLabels[t.category]}
        </span>
        <h1>{t.name}</h1>
        <p>
          {t.region} · {t.level} · {t.structure}
        </p>
        <button className="button" onClick={() => toggle(t.id)}>
          <Bookmark size={17} />
          {saved.includes(t.id) ? "נשמר במכשיר" : "שמירת המסלול"}
        </button>
      </div>
      <p className="detail-lead">{t.summary}</p>
      <div className="notice">
        <Compass size={22} />
        <p>
          המידע נכון לבדיקת המקורות ב-9.10.2026, לא למצב השטח כיום. לפני יציאה
          בודקים סגירות, מזג אוויר וגישה.
        </p>
      </div>
      {t.flag && (
        <div className="hazard-block">
          <AlertTriangle />
          <b>בדיקת סגירות מ-9.10.2026: {t.flag}</b>
        </div>
      )}
      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <h2>במבט מהיר</h2>
            <Facts
              items={[
                ["אורך", t.km !== null ? t.km + " ק״מ" : "לא ידוע"],
                ["קושי", t.level],
                ["מבנה", t.structure],
                ["מים", t.water],
                [
                  "עונה",
                  t.category === "verified"
                    ? d.season
                    : t.seasons.join(" · ") || "לא ידוע",
                ],
                ["צל", t.shade],
                [
                  "עלייה מצטברת",
                  typeof d.climb === "number"
                    ? d.climb + " מ׳"
                    : d.climb || "לא ידוע",
                ],
                ["זמן הליכה", d.duration || "לא ידוע"],
              ]}
            />
          </section>
          {t.category === "verified" && (
            <>
              <section className="detail-section">
                <h2>הגעה, שעות ועלויות</h2>
                <Facts
                  items={[
                    ["התחלה וסיום", d.start],
                    ["עלות (בדיקה מ-9.10.2026)", d.entry],
                    ["שעות", d.hours],
                    ["רישום", d.registration],
                  ]}
                />
              </section>
              <section className="detail-section">
                <h2>מהלך ההליכה</h2>
                <ol className="steps">
                  {d.steps.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p className="fine-print">
                  תקציר תכנון בלבד. יש להוריד מפת ניווט מתאימה מהמקור לפני
                  יציאה.
                </p>
              </section>
              <section className="detail-section">
                <h2>מזג אוויר: מידע היסטורי בלבד</h2>
                <p>{d.weather}</p>
                <p className="fine-print">
                  התחזיות נשמרו מ-9.10.2026 לשבת 10.10.2026 בלבד. הן אינן תחזית
                  עדכנית ואין להסתמך עליהן לטיול אחר.
                </p>
              </section>
            </>
          )}
          {t.category === "segment" && (
            <section className="detail-section">
              <h2>מקטע מתוך שביל ארוך</h2>
              <Facts
                items={[
                  ["התחלה", d.from_],
                  ["סיום", d.to],
                  [
                    "טיול יום לפי אורך",
                    t.km !== null && t.km <= 20
                      ? "אפשרות לבדיקה, לא אישור התאמה"
                      : "דורש תכנון וקיצור לפי הצורך",
                  ],
                ]}
              />
              <p>
                מקטע קווי דורש בדרך כלל רכב שני או הקפצה. אין כאן בדיקת צבא,
                מים, לינה או סגירות.
              </p>
              <Link className="text-link" to={"/long/" + t.longId}>
                לתכנון השביל המלא <ArrowUpLeft size={18} />
              </Link>
            </section>
          )}
          <section className="detail-section">
            <h2>הערות וזהירות</h2>
            {t.notes.length ? (
              <ul>
                {t.notes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p>לא ידוע. יש לעיין במקור ולבדוק את תנאי השטח.</p>
            )}
            {t.category === "extended" && (
              <p className="fine-print">
                מסלולי המאגר הם רעיונות לבדיקה, לא המלצות מאומתות. תיאורי מאמץ
                אינם דירוג קושי רשמי. עצות לעקיפת חסימות אינן היתר גישה.
              </p>
            )}
          </section>
          <section className="detail-section">
            <h2>מקורות ומפות</h2>
            <Sources refs={t.refs} />
            <p className="fine-print">
              מקור: {t.provenance}. המסמך המשותף אינו מפורסם; מוצגים נתוני
              מסלולים בלבד. יש לבדוק מידע רשמי עדכני.
            </p>
            <Sources refs={safetyLinks} />
          </section>
        </div>
        <aside>
          <AccessBlock trail={t} />
          <section className="detail-section safety-card">
            <h3>לפני שיוצאים</h3>
            <ul>
              <li>בודקים סגירות וגישה אצל הגורם הרשמי.</li>
              <li>מתאימים את הטיול למזג האוויר וליכולת הקבוצה.</li>
              <li>לוקחים מים ומפה זמינה ללא קליטה.</li>
              <li>במסלול קווי מתכננים חזרה מראש.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
