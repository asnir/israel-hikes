import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { coordinates, type Trail } from "../lib/catalog";
export default function TrailMap({
  trails,
  selected,
  onSelect,
}: {
  trails: Trail[];
  selected: Trail | null;
  onSelect: (t: Trail | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current) return;
    let disposed = false;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(
      [31.8, 35],
      7,
    );
    map.current = m;
    fetch("/services.json")
      .then((r) => r.json())
      .then(
        (config) =>
          !disposed &&
          L.tileLayer(config.tileUrl, {
            maxZoom: 18,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          }).addTo(m),
      )
      .catch(
        () =>
          !disposed &&
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          }).addTo(m),
      );
    layer.current = L.layerGroup().addTo(m);
    return () => {
      disposed = true;
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    for (const t of trails) {
      const c = coordinates(t);
      if (!c) continue;
      bounds.push(c);
      const marker = L.circleMarker(c, {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: t.flag
          ? "#b43f35"
          : t.category === "verified"
            ? "#dcaa57"
            : "#235c49",
        fillOpacity: 0.95,
      });
      marker
        .bindTooltip(t.name, { direction: "top" })
        .on("click", () => onSelect(t))
        .addTo(layer.current);
    }
    if (bounds.length)
      map.current?.fitBounds(L.latLngBounds(bounds), {
        padding: [30, 30],
        maxZoom: 12,
      });
  }, [trails]);
  const missing = trails.filter((t) => !coordinates(t)).length;
  return (
    <section className="map-wrap">
      <div
        ref={el}
        className="trail-map"
        role="region"
        aria-label="מפת נקודות התחלה"
      />
      <p className="map-note">
        סיכות התחלה בלבד, לא תוואי הליכה. {missing} תוצאות ללא נקודת התחלה
        מאומתת אינן מוצגות במפה.{" "}
        <a
          href="https://www.openstreetmap.org/fixthemap"
          target="_blank"
          rel="noreferrer"
        >
          דיווח על בעיית מפה
        </a>
      </p>
      {selected && (
        <div className="map-selected">
          <b>{selected.name}</b>
          <p>
            {selected.region} · {selected.km ?? "לא ידוע"} ק״מ ·{" "}
            {selected.level}
          </p>
          <Link className="button primary" to={"/trail/" + selected.id}>
            לפרטי המסלול
          </Link>
          <button className="button" onClick={() => onSelect(null)}>
            סגירה
          </button>
        </div>
      )}
    </section>
  );
}
