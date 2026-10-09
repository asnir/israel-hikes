import trailPhotos from "../data/trail-photos.json";
import { language } from "../i18n";
import { tr, display, distance, driveText } from "../i18n";
import { Link } from "react-router-dom";
import { ArrowUpLeft, Mountain, Route, Clock, Bookmark, AlertTriangle } from "lucide-react";
import { categoryLabels, type Trail } from "../lib/catalog";
import { methodLabel, type Drive } from "../lib/drive";
export default function TrailCard({
  trail: t,
  drive,
  saved,
  onSave
}: {
  trail: Trail;
  drive: Drive | null;
  saved: boolean;
  onSave: () => void;
}) {
  const photo=(trailPhotos as Record<string, typeof trailPhotos.ofer>)[t.id];
  return <article className={"trail-card " + (t.flag ? "flagged" : "")}>
      {photo ? <figure className="card-photo">
        <img src={photo.thumbSrc} alt={language()==="he" ? photo.captionHe : photo.captionEn} loading="lazy" decoding="async" width="480" height="240" />
        <figcaption><span>{language()==="he" ? "צילום אתר ארכיוני · " : "Archive site photo · "}</span><a href={photo.source} target="_blank" rel="noopener noreferrer">{language()==="he" ? photo.author : photo.authorEn}</a> · <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer">{photo.licence}</a> · {language()==="he" ? "חיתוך לתצוגה" : "Cropped thumbnail"}</figcaption>
      </figure> : <div className={"card-landscape landscape-" + (t.category === "segment" ? "long" : t.landscape.join("").includes("מעיין") || t.landscape.join("").includes("נחל") ? "water" : "forest")} aria-hidden="true">
        <Mountain size={72} strokeWidth={0.7} />
        <span>{display(t.region)}</span>
      </div>}
      <div className="card-body">
        <div className="card-top">
          <span className={"badge " + t.category}>
            {display(categoryLabels[t.category])}
          </span>
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
            <AlertTriangle size={16} />{tr("בדיקת סגירות מ-9.10.2026:")}{display(t.flag)}
          </p>)}
        <div className="tags">
          {display(t.landscape.slice(0, 2).map(s => <span key={s}>{display(s)}</span>))}
        </div>
        <div className="card-bottom">
          <span title={display(drive ? methodLabel[drive.method] : "")}>
            <Clock size={15} />
            {display(drive ? driveText(drive.minutes, drive.km) : "נסיעה: לא ידוע")}
          </span>
          <Link to={"/trail/" + t.id} aria-label={display("מידע על " + t.name)}>
            <ArrowUpLeft size={22} />
          </Link>
        </div>
        <small>
          {display(t.provenance)} · {display(drive ? "הערכה, ללא פקקים" : "המידע חסר")}
        </small>
      </div>
    </article>;
}
