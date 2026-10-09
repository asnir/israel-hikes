import { tr, display } from "../i18n";
import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { cities, geocode } from "../lib/drive";
export default function OriginSearch({
  city,
  setCity,
  onOrigin
}: {
  city: string;
  setCity: (s: string) => void;
  onOrigin: (p: [number, number], label: string) => void;
}) {
  const [q, Q] = useState(""),
    [results, R] = useState<{
      label: string;
      lat: number;
      lon: number;
    }[]>([]),
    [busy, B] = useState(false),
    [error, E] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || q.trim().length < 3) return;
    B(true);
    E("");
    R([]);
    try {
      R(await geocode(q.trim()));
    } catch {
      E("חיפוש הכתובת אינו זמין כרגע. אפשר לבחור עיר ולהשתמש באומדנים הקבועים.");
    } finally {
      B(false);
    }
  }
  return <div className="origin-panel">
      <label className="origin-city">
        <MapPin size={18} />
        <span>{tr("מאיפה יוצאים?")}</span>
        <select aria-label={tr("עיר מוצא")} value={city} onChange={e => {
        setCity(e.target.value);
        R([]);
        E("");
      }}>
          <option value="legacy">{tr("רמת גן · אומדן קודם")}</option>
          <option value="jerusalem-legacy">{tr("ירושלים · אומדן קודם")}</option>
          {display(cities.map(c => <option key={c.id} value={c.id}>
              {display(c.name)}{tr("· מרכז בקירוב")}</option>))}
        </select>
      </label>
      <details>
        <summary>{tr("או חיפוש כתובת אחרת")}</summary>
        <p className="privacy-note">{tr("כתובת החיפוש נשלחת ל-OpenStreetMap ולשירות ניתוב. אין להזין מידע אישי או סודי. החיפוש מתבצע רק בלחיצה, לא תוך כדי הקלדה.")}</p>
        <form className="address-form" onSubmit={submit}>
          <input dir="auto" aria-label={tr("כתובת לחישוב נסיעה")} value={q} onChange={e => Q(e.target.value)} placeholder={tr("עיר, רחוב או נקודת מוצא")} maxLength={160} minLength={3} />
          <button disabled={busy || q.trim().length < 3} className="button primary">
            <Search size={17} />
            {display(busy ? "מחפש…" : "חיפוש")}
          </button>
        </form>
        {display(error && <p role="status">{display(error)}</p>)}
        {display(results.length > 0 && <div className="address-results">
            {display(results.map(r => <button key={r.label} onClick={() => {
          onOrigin([r.lat, r.lon], r.label);
          R([]);
        }}>
                <bdi>{display(r.label)}</bdi>
              </button>))}
          </div>)}
        <small>{tr("לאחר בחירת נקודה, אומדני מרחק גסים יופיעו מיד. חישוב כביש זמין בנפרד למסלולים המוצגים.")}</small>
      </details>
    </div>;
}
