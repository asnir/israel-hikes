import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { catalog, longTrails } from "../lib/catalog";
import { estimate } from "../lib/drive";
import TrailCard from "../components/TrailCard";

import { Facts, Sources, NotFound } from "../components/Common";
import { useSaved } from "../lib/saved";
export default function LongDetail() {
  const { id } = useParams();
  const t = longTrails.find((t) => t.id === id);
  if (!t) return <NotFound />;
  const list = catalog.filter((s) => s.longId === id);
  const { saved, toggle } = useSaved();
  return (
    <main id="main" className="page detail">
      <Link className="back-link" to="/long">
        <ArrowRight size={18} />
        כל השבילים הארוכים
      </Link>
      <div className="section-intro">
        <span className="eyebrow">מסע שלם או מקטע אחד</span>
        <h1>{t.name}</h1>
        <p>{t.tag}</p>
      </div>
      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <Facts
              items={[
                ["אורך לפי מקורות", t.total],
                ["משך וחלוקה", t.days],
                ["מתחיל", t.from],
                ["מסתיים", t.to],
                ["עונה", t.season],
                ["רמה", t.level],
                ["סימון", t.marking],
              ]}
            />
          </section>
          <section className="detail-section">
            <h2>איך עושים מקטע כטיול יום?</h2>
            <ol className="steps">
              {t.howto.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
          <section className="detail-section">
            <h2>לוגיסטיקה</h2>
            <p>{t.logistics}</p>
          </section>
        </div>
        <aside>
          <section className="detail-section">
            <h2>גבולות המידע</h2>
            <p>{t.caveat}</p>
            <p>
              לא נבדקו סגירות, הגבלות צבא או זמינות מים לאורך כל השביל. מידע
              המקורות נשמר מבדיקת 9.10.2026.
            </p>
          </section>
          <section className="detail-section">
            <h2>מקורות</h2>
            <Sources refs={t.sources} />
          </section>
        </aside>
      </div>
      <div className="section-heading">
        <h2>{list.length} מקטעים וטיולי יום</h2>
        <Link className="text-link" to="/">
          חיפוש בכל המאגר
        </Link>
      </div>
      <div className="trail-grid">
        {list.map((s) => (
          <TrailCard
            key={s.id}
            trail={s}
            drive={estimate(s, "legacy")}
            saved={saved.includes(s.id)}
            onSave={() => toggle(s.id)}
          />
        ))}
      </div>
    </main>
  );
}
