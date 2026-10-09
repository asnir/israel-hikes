import { Link } from "react-router-dom";
import {
  ArrowUpLeft,
  Mountain,
  Route,
  Clock,
  Bookmark,
  AlertTriangle,
} from "lucide-react";
import { categoryLabels, type Trail } from "../lib/catalog";
import { methodLabel, type Drive } from "../lib/drive";
export default function TrailCard({
  trail: t,
  drive,
  saved,
  onSave,
}: {
  trail: Trail;
  drive: Drive | null;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className={"trail-card " + (t.flag ? "flagged" : "")}>
      <div
        className={
          "card-landscape landscape-" +
          (t.category === "segment"
            ? "long"
            : t.landscape.join("").includes("מעיין") ||
                t.landscape.join("").includes("נחל")
              ? "water"
              : "forest")
        }
        aria-hidden="true"
      >
        <Mountain size={72} strokeWidth={0.7} />
        <span>{t.region}</span>
      </div>
      <div className="card-body">
        <div className="card-top">
          <span className={"badge " + t.category}>
            {categoryLabels[t.category]}
          </span>
          <button
            className={"icon-button " + (saved ? "saved" : "")}
            aria-label={saved ? "הסרת מסלול מהשמורים" : "שמירת מסלול"}
            onClick={onSave}
          >
            <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
        <Link className="card-title" to={"/trail/" + t.id}>
          <h3>{t.name}</h3>
        </Link>
        <div className="card-facts">
          <span>
            <Route size={15} />
            {t.km === null ? "אורך לא ידוע" : t.km + " ק״מ"}
          </span>
          <span>
            <Mountain size={15} />
            {t.level}
          </span>
          <span>{t.structure}</span>
        </div>
        <p className="card-summary">{t.summary}</p>
        {t.flag && (
          <p className="hazard">
            <AlertTriangle size={16} />
            בדיקת סגירות מ-9.10.2026: {t.flag}
          </p>
        )}
        <div className="tags">
          {t.landscape.slice(0, 2).map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <div className="card-bottom">
          <span title={drive ? methodLabel[drive.method] : ""}>
            <Clock size={15} />
            {drive
              ? "כ-" + drive.minutes + " דק׳ · " + drive.km + " ק״מ"
              : "נסיעה: לא ידוע"}
          </span>
          <Link to={"/trail/" + t.id} aria-label={"מידע על " + t.name}>
            <ArrowUpLeft size={22} />
          </Link>
        </div>
        <small>
          {t.provenance} · {drive ? "הערכה, ללא פקקים" : "המידע חסר"}
        </small>
      </div>
    </article>
  );
}
