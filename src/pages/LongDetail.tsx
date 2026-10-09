import { tr, display } from "../i18n";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { catalog, longTrails } from "../lib/catalog";
import TrailCard from "../components/TrailCard";
import { Facts, Sources, NotFound } from "../components/Common";
import { useSaved } from "../lib/saved";
export default function LongDetail() {
  const {
    id
  } = useParams();
  const t = longTrails.find(t => t.id === id);
  if (!t) return <NotFound />;
  const list = catalog.filter(s => s.longId === id);
  const {
    saved,
    toggle
  } = useSaved();
  return <main id="main" className="page detail">
      <Link className="back-link" to="/long">
        <ArrowRight size={18} />{tr("כל השבילים הארוכים")}</Link>
      <div className="section-intro">
        <span className="eyebrow">{tr("מסע שלם או מקטע אחד")}</span>
        <h1>{display(t.name)}</h1>
        <p>{display(t.tag)}</p>
      </div>
      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <Facts items={[["אורך לפי מקורות", t.total], ["משך וחלוקה", t.days], ["מתחיל", t.from], ["מסתיים", t.to], ["עונה", t.season], ["רמה", t.level], ["סימון", t.marking]]} />
          </section>
          <section className="detail-section">
            <h2>{tr("איך עושים מקטע כטיול יום?")}</h2>
            <ol className="steps">
              {display(t.howto.map((s, i) => <li key={i}>{display(s)}</li>))}
            </ol>
          </section>
          <section className="detail-section">
            <h2>{tr("לוגיסטיקה")}</h2>
            <p>{display(t.logistics)}</p>
          </section>
        </div>
        <aside>
          <section className="detail-section">
            <h2>{tr("גבולות המידע")}</h2>
            <p>{display(t.caveat)}</p>
            <p>{tr("לא נבדקו סגירות, הגבלות צבא או זמינות מים לאורך כל השביל. מידע המקורות נשמר מבדיקת 9.10.2026.")}</p>
          </section>
          <section className="detail-section">
            <h2>{tr("מקורות")}</h2>
            <Sources refs={t.sources} />
          </section>
        </aside>
      </div>
      <div className="section-heading">
        <h2>{display(list.length)}{tr("מקטעים וטיולי יום")}</h2>
        <Link className="text-link" to="/">{tr("חיפוש בכל המאגר")}</Link>
      </div>
      <div className="trail-grid">
        {display(list.map(s => <TrailCard key={s.id} trail={s} saved={saved.includes(s.id)} onSave={() => toggle(s.id)} />))}
      </div>
    </main>;
}
