import { tr, display } from "../i18n";
import { Link } from "react-router-dom";
import { ArrowUpLeft, ArrowRight, AlertTriangle, Compass } from "lucide-react";
import { longTrails } from "../lib/catalog";
import { Facts } from "../components/Common";
export default function LongHub() {
  return <main id="main" className="page">
      <Link className="back-link" to="/">
        <ArrowRight size={17} />{tr("לכל המסלולים")}</Link>
      <div className="section-intro">
        <span className="eyebrow">{tr("הדרך ארוכה. הבחירה גמישה.")}</span>
        <h1>{tr("שבילים ארוכים,")}<br />{tr("גם ליום אחד.")}</h1>
        <p>{tr("ארבעה שבילים ו-59 מקטעים. אפשר לתכנן מסע או לבחור קטע אחד.")}<br />{tr("ההתאמה לטיול יום היא הערכה לפי אורך, לא בדיקת גישה או בטיחות.")}</p>
      </div>
      <div className="long-grid">
        {display(longTrails.map((t, i) => <Link className="long-card" to={"/long/" + t.id} key={t.id}>
            <span className="long-number">0{display(i + 1)}</span>
            <Compass size={40} strokeWidth={1} />
            <h2>{display(t.name)}</h2>
            <p>{display(t.tag)}</p>
            <Facts items={[["אורך", t.total], ["חלוקה", t.days], ["עונה", t.season]]} />
            <span className="text-link">{tr("מקטעים ותכנון")}<ArrowUpLeft size={18} />
            </span>
          </Link>))}
      </div>
      <div className="notice">
        <AlertTriangle size={22} />
        <p>{tr("סגירות, צבא, מים ולינה לא נבדקו לכל מקטע. אין להסתמך על המאגר לבדו ליציאה לשטח.")}</p>
      </div>
    </main>;
}
