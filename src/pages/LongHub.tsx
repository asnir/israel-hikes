import { Link } from "react-router-dom";
import { ArrowUpLeft, ArrowRight, AlertTriangle, Compass } from "lucide-react";
import { longTrails } from "../lib/catalog";

import { Facts } from "../components/Common";

export default function LongHub() {
  return (
    <main id="main" className="page">
      <Link className="back-link" to="/">
        <ArrowRight size={17} />
        לכל המסלולים
      </Link>
      <div className="section-intro">
        <span className="eyebrow">הדרך ארוכה. הבחירה גמישה.</span>
        <h1>
          שבילים ארוכים,
          <br />
          גם ליום אחד.
        </h1>
        <p>
          ארבעה שבילים ו-59 מקטעים. אפשר לתכנן מסע או לבחור קטע אחד.
          <br />
          ההתאמה לטיול יום היא הערכה לפי אורך, לא בדיקת גישה או בטיחות.
        </p>
      </div>
      <div className="long-grid">
        {longTrails.map((t, i) => (
          <Link className="long-card" to={"/long/" + t.id} key={t.id}>
            <span className="long-number">0{i + 1}</span>
            <Compass size={40} strokeWidth={1} />
            <h2>{t.name}</h2>
            <p>{t.tag}</p>
            <Facts
              items={[
                ["אורך", t.total],
                ["חלוקה", t.days],
                ["עונה", t.season],
              ]}
            />
            <span className="text-link">
              מקטעים ותכנון <ArrowUpLeft size={18} />
            </span>
          </Link>
        ))}
      </div>
      <div className="notice">
        <AlertTriangle size={22} />
        <p>
          סגירות, צבא, מים ולינה לא נבדקו לכל מקטע. אין להסתמך על המאגר לבדו
          ליציאה לשטח.
        </p>
      </div>
    </main>
  );
}
