import { matches } from "../lib/filter";
import { lazy, Suspense, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  Map,
  LayoutGrid,
  ArrowUpLeft,
  Bookmark,
  Compass,
} from "lucide-react";
import { catalog, longTrails, type Trail } from "../lib/catalog";
import { estimate, roughEstimate, routeBatch, type Drive } from "../lib/drive";
import TrailCard from "../components/TrailCard";
import OriginSearch from "../components/OriginSearch";
const TrailMap = lazy(() => import("../components/TrailMap"));

import { useSaved } from "../lib/saved";
import Hero from "../components/Hero";
import FilterFields, {
  initialFilters,
  type Filters,
} from "../components/Filters";
export default function Home() {
  const [q, Q] = useState(""),
    [f, F] = useState<Filters>(initialFilters),
    [view, V] = useState<"grid" | "map">("grid"),
    [lim, L] = useState(24),
    [advanced, A] = useState(false),
    [city, C] = useState("legacy"),
    [origin, O] = useState<{ point: [number, number]; label: string } | null>(
      null,
    ),
    [routed, R] = useState<Record<string, Drive>>({}),
    [routing, BR] = useState(false),
    [routingStatus, RS] = useState(""),
    [selected, S] = useState<Trail | null>(null),
    [onlySaved, OS] = useState(false),
    [sort, Sort] = useState("default");
  const { saved, toggle } = useSaved();
  const originVersion = useRef(0);
  const update = (k: keyof Filters, v: string) => {
    F({ ...f, [k]: v });
    L(24);
  };
  const driveFor = (t: Trail) =>
    origin ? routed[t.id] || roughEstimate(t, origin.point) : estimate(t, city);
  const filtered = useMemo(() => {
    const list = catalog.filter((t) => {
      const d = driveFor(t);
      return (!onlySaved || saved.includes(t.id)) && matches(t, q, f, d);
    });
    if (sort === "distance")
      list.sort(
        (a, b) =>
          (driveFor(a)?.minutes ?? Infinity) -
          (driveFor(b)?.minutes ?? Infinity),
      );
    if (sort === "length")
      list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [q, f, city, origin, routed, onlySaved, saved, sort]);
  const shown = filtered.slice(0, lim);
  const active = Object.values(f).filter(Boolean).length;
  async function calculate() {
    if (!origin) return;
    const version = originVersion.current;
    BR(true);
    RS("");
    try {
      const result = await routeBatch(origin.point, shown);
      if (version !== originVersion.current) return;
      R((prev) => ({ ...prev, ...result }));
      RS("חישוב כביש הושלם למסלולים המוצגים. ללא מידע על פקקים.");
    } catch {
      RS(
        "שירות הניתוב אינו זמין. מוצגים אומדנים גסים לפי מרחק אווירי; אלה אינם מרחקי כביש.",
      );
    } finally {
      BR(false);
    }
  }
  return (
    <>
      <Hero />
      <main id="main" className="page home">
        <div className="section-heading">
          <div>
            <span className="eyebrow">בדיוק בקצב שלכם</span>
            <h2>לאן מתחשק לצאת?</h2>
          </div>
          <Link className="text-link" to="/long">
            לגלות שבילים ארוכים <ArrowUpLeft size={17} />
          </Link>
        </div>
        <section className="search-panel" aria-label="חיפוש וסינון">
          <div className="search-row">
            <label className="search-box">
              <Search size={21} />
              <input
                aria-label="חיפוש מסלולים"
                placeholder="שם מסלול, אזור, מעיין או נוף…"
                value={q}
                onChange={(e) => {
                  Q(e.target.value);
                  L(24);
                }}
              />
            </label>
            <button
              className={"button filter-toggle " + (advanced ? "active" : "")}
              onClick={() => A(!advanced)}
              aria-expanded={advanced}
            >
              <SlidersHorizontal size={18} />
              סינון {active > 0 && <span className="count">{active}</span>}
            </button>
          </div>
          <FilterFields f={f} update={update} advanced={advanced} />
          <OriginSearch
            city={city}
            setCity={(v) => {
              C(v);
              originVersion.current++;
              O(null);
              R({});
              RS("");
            }}
            onOrigin={(point, label) => {
              originVersion.current++;
              O({ point, label });
              R({});
              RS("");
            }}
          />
          {origin && (
            <div className="dynamic-origin">
              <span>מוצא: {origin.label}</span>
              <button className="button" onClick={calculate} disabled={routing}>
                {routing
                  ? "מחשב…"
                  : "חישוב כביש ל-" + shown.length + " המסלולים המוצגים"}
              </button>
              <small>
                ברירת המחדל: אומדן מרחק אווירי × 1.35, לא מרחק כביש. החישוב דורש
                שירות זמין.
              </small>
              {routingStatus && <p role="status">{routingStatus}</p>}
            </div>
          )}
          <div className="filter-footer">
            <p>זמני נסיעה הם אומדנים ללא פקקים, עצירות או הקפצת רכבים.</p>
            {(active > 0 || q) && (
              <button
                onClick={() => {
                  F(initialFilters);
                  Q("");
                  L(24);
                }}
              >
                ניקוי סינון
              </button>
            )}
          </div>
        </section>
        <div className="notice">
          <Compass size={21} />
          <p>
            <b>רעיונות לתכנון, לא הבטחה לתנאי שטח.</b> חמש ההמלצות נבדקו
            ב-9.10.2026 בלבד. המאגר והמקטעים דורשים בדיקה מחדש לפני יציאה.
          </p>
          <Link to="/about">מה חשוב לדעת?</Link>
        </div>
        <div className="results-toolbar">
          <p aria-live="polite">
            <b>{filtered.length}</b> מסלולים ומקטעים
          </p>
          <div className="result-controls">
            <button
              className={"button saved-filter " + (onlySaved ? "active" : "")}
              onClick={() => OS(!onlySaved)}
            >
              <Bookmark size={16} />
              שמורים ({saved.length})
            </button>
            <select
              aria-label="מיון תוצאות"
              value={sort}
              onChange={(e) => Sort(e.target.value)}
            >
              <option value="default">סדר המאגר</option>
              <option value="distance">נסיעה קצרה קודם</option>
              <option value="length">מסלול קצר קודם</option>
            </select>
            <div className="view-switch">
              <button
                aria-label="תצוגת כרטיסים"
                aria-pressed={view === "grid"}
                onClick={() => V("grid")}
              >
                <LayoutGrid size={19} />
              </button>
              <button
                aria-label="תצוגת מפה"
                aria-pressed={view === "map"}
                onClick={() => V("map")}
              >
                <Map size={19} />
              </button>
            </div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <Search size={36} />
            <h3>אין מסלולים שמתאימים לכל הבחירות</h3>
            <p>אפשר להסיר מסנן או לשנות את החיפוש.</p>
            <button
              className="button"
              onClick={() => {
                F(initialFilters);
                Q("");
                OS(false);
              }}
            >
              התחלה מחדש
            </button>
          </div>
        ) : view === "map" ? (
          <Suspense fallback={<p>טוען מפה…</p>}>
            <TrailMap trails={filtered} selected={selected} onSelect={S} />
          </Suspense>
        ) : (
          <div className="trail-grid">
            {shown.map((t) => (
              <TrailCard
                key={t.id}
                trail={t}
                drive={driveFor(t)}
                saved={saved.includes(t.id)}
                onSave={() => toggle(t.id)}
              />
            ))}
          </div>
        )}
        {view === "grid" && filtered.length > lim && (
          <div className="load-more">
            <button className="button" onClick={() => L(lim + 24)}>
              עוד מסלולים <span>({filtered.length - lim} נוספים)</span>
            </button>
          </div>
        )}
        <section className="long-invitation">
          <div>
            <span className="eyebrow">לא חייבים ללכת את הכל</span>
            <h2>
              שביל ארוך.
              <br />
              יום אחד שלכם.
            </h2>
            <p>
              שביל הגולן, ים אל ים, שביל ישראל ושביל ירושלים.
              <br />
              בוחרים מקטע, בודקים לוגיסטיקה ומתכננים יום בקצב שלכם.
            </p>
            <Link className="button primary" to="/long">
              לשבילים ולמקטעים <ArrowUpLeft size={18} />
            </Link>
          </div>
          <div className="long-mini-list">
            {longTrails.map((t) => (
              <Link key={t.id} to={"/long/" + t.id}>
                <span>
                  {t.name}
                  <small>{t.total}</small>
                </span>
                <ArrowUpLeft size={20} />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
