import { Routes, Route, Link } from "react-router-dom";
import { Mountain } from "lucide-react";
import { safetyLinks } from "./components/Common";
import Home from "./pages/Home";
import TrailDetail from "./pages/TrailDetail";
import LongHub from "./pages/LongHub";
import LongDetail from "./pages/LongDetail";
import About from "./pages/About";
import { NotFound } from "./components/Common";
function Header() {
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="brand-icon">
          <Mountain size={26} />
        </span>
        <span>
          שביל<small>יוצאים לטבע</small>
        </span>
      </Link>
      <nav aria-label="ניווט ראשי">
        <Link to="/">מסלולים</Link>
        <Link to="/long">שבילים ארוכים</Link>
        <Link to="/about">על המאגר</Link>
      </nav>
    </header>
  );
}
function Footer() {
  return (
    <footer className="footer">
      <Link className="brand" to="/">
        <Mountain size={22} /> שביל
      </Link>
      <p>רעיון טוב מתחיל במידע. טיול טוב מתחיל בבדיקה.</p>
      <div>
        <Link to="/about">מידע, מקורות ופרטיות</Link>
        {safetyLinks.map(([l, u]) => (
          <a key={u} href={u} target="_blank" rel="noopener noreferrer">
            {l}
          </a>
        ))}
      </div>
      <small>
        מידע נבדק לאחרונה ב-9.10.2026. המידע אינו מתעדכן אוטומטית. המפה מציגה
        נקודות התחלה, לא שבילי ניווט.
      </small>
    </footer>
  );
}
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        דלגו לתוכן
      </a>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/long" element={<LongHub />} />
        <Route path="/long/:id" element={<LongDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  );
}
