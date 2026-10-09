import { tr, display } from "../i18n";
import { catalog, longTrails } from '../lib/catalog';
import { Compass } from "lucide-react";
export default function Hero() {
  return <section className="hero">
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 1300 450" preserveAspectRatio="xMidYMid slice">
          <rect width="1300" height="450" fill="#153e35" />
          <circle cx="280" cy="95" r="54" fill="#e0b870" opacity=".85" />
          <path d="M0 350 160 150 290 295 460 130 610 295 760 95 1000 330 1160 170 1300 350V450H0" fill="#799982" opacity=".5" />
          <path d="M0 360 240 255 420 360 630 210 890 355 1130 220 1300 330V450H0" fill="#254f41" />
          <path d="M0 440 Q250 250 600 410T1300 360V450H0" fill="#123b30" />
          <path d="M350 450Q630 350 590 340T760 280" fill="none" stroke="#e0b870" strokeWidth="3" strokeDasharray="7 9" opacity=".6" />
        </svg>
      </div>
      <div className="hero-content">
        <span className="eyebrow">{tr("מסלולים. מקורות. קצת אוויר.")}</span>
        <h1>{tr("הדרך לטיול הבא")}<br />
          <em>{tr("מתחילה כאן.")}</em>
        </h1>
        <p>{tr("מהליכה קצרה בחורש ועד מקטע של שביל ארוך.")}<br />{tr("בוחרים מה מתאים, קוראים את הפרטים ויוצאים מוכנים.")}</p>
        <div className="hero-stats">
          <span>
            <b>{display(catalog.length)}</b>{tr("מסלולים ומקטעים")}</span>
          <span>
            <b>{display(longTrails.length)}</b>{tr("שבילים ארוכים")}</span>
          <span>
            <Compass size={16} />{tr("בכל הארץ")}</span>
        </div>
      </div>
      <span className="art-caption">{tr("איור נוף, לא צילום של מסלול")}</span>
    </section>;
}
