import i18n, { tr, display } from "../i18n";
import { matches } from "../lib/filter";
import { lazy, Suspense, useMemo, useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Map, LayoutGrid, ArrowUpLeft, Bookmark, Compass } from "lucide-react";
import { catalog, longTrails, type Trail } from "../lib/catalog";
import { estimate, roughEstimate, routeBatch, type Drive } from "../lib/drive";
import TrailCard from "../components/TrailCard";
import OriginSearch from "../components/OriginSearch";
import { isFreshLocation, locationMaxAge, type LocationFix } from "../lib/location";
const TrailMap = lazy(() => import("../components/TrailMap"));
import { useSaved } from "../lib/saved";
import Hero from "../components/Hero";
import FilterFields, { initialFilters, type Filters } from "../components/Filters";
export default function Home() {
  const [q, Q] = useState(""),
    [f, F] = useState<Filters>(initialFilters),
    [view, V] = useState<"grid" | "map">("grid"),
    [lim, L] = useState(24),
    [advanced, A] = useState(false),
    [city, C] = useState("legacy"),
    [origin, O] = useState<{
      point: [number, number];
      label: string;
      fix?: LocationFix;
    } | null>(null),
    [routed, R] = useState<Record<string, Drive>>({}),
    [routing, BR] = useState(false),
    [routingStatus, RS] = useState(""),
    [selected, S] = useState<Trail | null>(null),
    [onlySaved, OS] = useState(false),
    [sort, Sort] = useState("default");
  const {
    saved,
    toggle
  } = useSaved();
  const originVersion = useRef(0);
  const update = (k: keyof Filters, v: string) => {
    F({
      ...f,
      [k]: v
    });
    L(24);
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!origin?.fix) return;
    const expires = setTimeout(() => setNow(Date.now()), Math.max(0, origin.fix.observedAt + locationMaxAge - Date.now()));
    return () => clearTimeout(expires);
  }, [origin]);
  const staleLocation = !!origin?.fix && !isFreshLocation(origin.fix.observedAt, now);
  const driveFor = (t: Trail) => staleLocation ? null : origin ? routed[t.id] || roughEstimate(t, origin.point) : estimate(t, city);
  const filtered = useMemo(() => {
    const list = catalog.filter(t => {
      const d = driveFor(t);
      return (!onlySaved || saved.includes(t.id)) && matches(t, q, f, d);
    });
    if (sort === "distance") list.sort((a, b) => (driveFor(a)?.km ?? Infinity) - (driveFor(b)?.km ?? Infinity));
    if (sort === "length") list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [q, f, city, origin, routed, staleLocation, onlySaved, saved, sort]);
  const shown = filtered.slice(0, lim);
  const active = Object.values(f).filter(Boolean).length;
  async function calculate() {
    if (!origin || (origin.fix && !isFreshLocation(origin.fix.observedAt))) return;
    const version = originVersion.current;
    BR(true);
    RS("");
    try {
      const result = await routeBatch(origin.point, shown);
      if (version !== originVersion.current || (origin.fix && !isFreshLocation(origin.fix.observedAt))) return;
      R(prev => ({
        ...prev,
        ...result
      }));
      RS("חישוב כביש הושלם למסלולים המוצגים. ללא מידע על פקקים.");
    } catch {
      RS("שירות הניתוב אינו זמין. מוצגים אומדנים גסים לפי מרחק אווירי; אלה אינם מרחקי כביש.");
    } finally {
      BR(false);
    }
  }
  return <>
      <Hero />
      <main id="main" className="page home">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{tr("בדיוק בקצב שלכם")}</span>
            <h2>{tr("לאן מתחשק לצאת?")}</h2>
          </div>
          <Link className="text-link" to="/long">{tr("לגלות שבילים ארוכים")}<ArrowUpLeft size={17} />
          </Link>
        </div>
        <section className="search-panel" aria-label={tr("חיפוש וסינון")}>
          <div className="search-row">
            <label className="search-box">
              <Search size={21} />
              <input dir="auto" aria-label={tr("חיפוש מסלולים")} placeholder={tr("שם מסלול, אזור, מעיין או נוף…")} value={q} onChange={e => {
              Q(e.target.value);
              L(24);
            }} />
            </label>
            <button className={"button filter-toggle " + (advanced ? "active" : "")} onClick={() => A(!advanced)} aria-expanded={advanced}>
              <SlidersHorizontal size={18} />{tr("סינון")}{display(active > 0 && <span className="count">{display(active)}</span>)}
            </button>
          </div>
          <FilterFields f={f} update={update} advanced={advanced} />
          <OriginSearch city={city} setCity={v => {
          C(v);
          originVersion.current++;
          O(null);
          R({});
          RS("");
        }} onOrigin={(point, label, fix) => {
          originVersion.current++;
          C("custom");
          O({
            point,
            label, fix
          });
          setNow(Date.now());
          Sort("distance"); L(24);
          R({});
          RS("");
        }} />
          {display(origin && <div className="dynamic-origin">
              <span>{tr("מוצא:")} <bdi>{origin.label}</bdi></span>
              <button className="button" onClick={calculate} disabled={routing || staleLocation}>
                {display(routing ? "מחשב…" : i18n.t("roadCount", { count: shown.length }))}
              </button>
              {origin.fix && <p className="location-age" role="status">{tr(staleLocation ? "המיקום ישן. רעננו לפני סינון לפי מרחק או חישוב כביש." : "מיקום שנמדד לפני")} {!staleLocation && <>{Math.max(0, Math.floor((now - origin.fix.observedAt) / 60000))} {tr("דקות")} · {tr("דיוק משוער:")} {Math.round(origin.fix.accuracy)} {tr("מטרים")}</>}</p>}
              <small>{tr("ברירת המחדל: אומדן מרחק אווירי × 1.35, לא מרחק כביש. החישוב דורש שירות זמין.")}</small>
              <small>{tr("בלחיצה על חישוב כביש, נקודת המוצא נשלחת לשירות OSRM. אין שליחה אוטומטית.")}</small>
              {display(routingStatus && <p role="status">{display(routingStatus)}</p>)}
            </div>)}
          <div className="filter-footer">
            <p>{tr("מרחקים תלויים בנקודת המוצא שנבחרה. אלה אומדנים, לא אורך מסלול ההליכה.")}</p>
            {display((active > 0 || q) && <button onClick={() => {
            F(initialFilters);
            Q("");
            L(24);
          }}>{tr("ניקוי סינון")}</button>)}
          </div>
        </section>
        <div className="notice">
          <Compass size={21} />
          <p>
            <b>{tr("רעיונות לתכנון, לא הבטחה לתנאי שטח.")}</b>{tr("חמש ההמלצות נבדקו ב-9.10.2026 בלבד. המאגר והמקטעים דורשים בדיקה מחדש לפני יציאה.")}</p>
          <Link to="/about">{tr("מה חשוב לדעת?")}</Link>
        </div>
        <div className="results-toolbar">
          <p aria-live="polite">
            <b>{display(filtered.length)}</b>{tr("מסלולים ומקטעים")}</p>
          <div className="result-controls">
            <button className={"button saved-filter " + (onlySaved ? "active" : "")} onClick={() => OS(!onlySaved)}>
              <Bookmark size={16} />{i18n.t("savedCount", { count:saved.length })}
            </button>
            <select aria-label={tr("מיון תוצאות")} value={sort} onChange={e => Sort(e.target.value)}>
              <option value="default">{tr("סדר המאגר")}</option>
              <option value="distance">{tr("מרחק נסיעה קצר קודם")}</option>
              <option value="length">{tr("מסלול קצר קודם")}</option>
            </select>
            <div className="view-switch">
              <button aria-label={tr("תצוגת כרטיסים")} aria-pressed={view === "grid"} onClick={() => V("grid")}>
                <LayoutGrid size={19} />
              </button>
              <button aria-label={tr("תצוגת מפה")} aria-pressed={view === "map"} onClick={() => V("map")}>
                <Map size={19} />
              </button>
            </div>
          </div>
        </div>
        {display(filtered.length === 0 ? <div className="empty">
            <Search size={36} />
            <h3>{tr("אין מסלולים שמתאימים לכל הבחירות")}</h3>
            <p>{tr("אפשר להסיר מסנן או לשנות את החיפוש.")}</p>
            <button className="button" onClick={() => {
          F(initialFilters);
          Q("");
          OS(false);
        }}>{tr("התחלה מחדש")}</button>
          </div> : view === "map" ? <Suspense fallback={<p>{tr("טוען מפה…")}</p>}>
            <TrailMap trails={filtered} selected={selected} onSelect={S} />
          </Suspense> : <div className="trail-grid">
            {display(shown.map(t => <TrailCard key={t.id} trail={t} saved={saved.includes(t.id)} onSave={() => toggle(t.id)} />))}
          </div>)}
        {display(view === "grid" && filtered.length > lim && <div className="load-more">
            <button className="button" onClick={() => L(lim + 24)}>{tr("עוד מסלולים")}<span>({display(filtered.length - lim)}{tr("נוספים)")}</span>
            </button>
          </div>)}
        <section className="long-invitation">
          <div>
            <span className="eyebrow">{tr("לא חייבים ללכת את הכל")}</span>
            <h2>{tr("שביל ארוך.")}<br />{tr("יום אחד שלכם.")}</h2>
            <p>{tr("שביל הגולן, ים אל ים, שביל ישראל ושביל ירושלים.")}<br />{tr("בוחרים מקטע, בודקים לוגיסטיקה ומתכננים יום בקצב שלכם.")}</p>
            <Link className="button primary" to="/long">{tr("לשבילים ולמקטעים")}<ArrowUpLeft size={18} />
            </Link>
          </div>
          <div className="long-mini-list">
            {display(longTrails.map(t => <Link key={t.id} to={"/long/" + t.id}>
                <span>
                  {display(t.name)}
                  <small>{display(t.total)}</small>
                </span>
                <ArrowUpLeft size={20} />
              </Link>))}
          </div>
        </section>
      </main>
    </>;
}
