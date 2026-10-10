import { publicText } from "../lib/public-text";
import trailPhotos from "../data/trail-photos.json";
import { language } from "../i18n";
import { tr, display, distance } from "../i18n";
import { Link } from "react-router-dom";
import { ArrowUpLeft, Mountain, Route, Bookmark, AlertTriangle } from "lucide-react";
import { type Trail } from "../lib/catalog";
export default function TrailCard({
  trail: t,
  saved,
  onSave
}: {
  trail: Trail;
  saved: boolean;
  onSave: () => void;
}) {
  const photo=(trailPhotos as Record<string, typeof trailPhotos.ofer>)[t.id];
  return <article className={"trail-card " + (t.flag ? "flagged" : "")}>
      {photo ? <Link className="card-photo" to={"/trail/"+t.id} title={language()==="he"?"פרטי המסלול וקרדיט לצילום":"Trail details and photo credit"}>
        <img src={photo.thumbSrc} alt={(language()==="he" ? photo.captionHe+" צילום: "+photo.author : photo.captionEn+" Photo: "+photo.authorEn)+" · "+photo.licence} loading="lazy" decoding="async" width="480" height="240" />
      </Link> : <div className={"card-landscape landscape-" + (t.category === "segment" ? "long" : t.landscape.join("").includes("מעיין") || t.landscape.join("").includes("נחל") ? "water" : "forest")} aria-hidden="true">
        <Mountain size={72} strokeWidth={0.7} />
        <span>{display(t.region)}</span>
      </div>}
      <div className="card-body">
        <div className="card-top">
          <button className={"icon-button " + (saved ? "saved" : "")} aria-label={display(saved ? "הסרת מסלול מהשמורים" : "שמירת מסלול")} onClick={onSave}>
            <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
        <Link className="card-title" to={"/trail/" + t.id}>
          <h3>{display(t.name)}</h3>
        </Link>
        <div className="card-facts">
          <span>
            <Route size={15} />
            {display(t.km === null ? "אורך לא ידוע" : distance(t.km))}
          </span>
          <span>
            <Mountain size={15} />
            {display(t.level)}
          </span>
          <span>{display(t.structure)}</span>
        </div>
        <p className="card-summary">{display(t.summary)}</p>
        {display(t.flag && <p className="hazard">
            <AlertTriangle size={16} />{tr("אזהרת גישה:")}{publicText(tr(t.flag))}
          </p>)}
        <div className="tags">
          {display(t.landscape.slice(0, 2).map(s => <span key={s}>{display(s)}</span>))}
        </div>
        <div className="card-bottom">
          <span>{tr("פרטי המסלול")}</span>
          <Link to={"/trail/" + t.id} aria-label={display("מידע על " + t.name)}>
            <ArrowUpLeft size={22} />
          </Link>
        </div>
      </div>
    </article>;
}
