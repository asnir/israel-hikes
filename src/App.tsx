import AccessibilityMenu from "./components/AccessibilityMenu";
import AccessibilityStatement from "./pages/AccessibilityStatement";
import { useTranslation } from "react-i18next";
import i18n, { tr, display, language } from "./i18n";
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
  return <header className="site-header">
      <Link className="brand" to="/">
        <span className="brand-icon">
          <Mountain size={26} />
        </span>
        <span>{tr("שביל")}<small>{tr("יוצאים לטבע")}</small>
        </span>
      </Link>
      <nav aria-label={tr("ניווט ראשי")}>
        <Link to="/">{tr("מסלולים")}</Link>
        <Link to="/long">{tr("שבילים ארוכים")}</Link>
        <Link to="/about">{tr("על המאגר")}</Link>
      </nav>
      <div className="language-switch" role="group" aria-label={language() === "he" ? "שפת האתר" : "Site language"}>
        <button type="button" lang="he" aria-pressed={language() === "he"} onClick={() => i18n.changeLanguage("he")}>עברית</button>
        <button type="button" lang="en" aria-pressed={language() === "en"} onClick={() => i18n.changeLanguage("en")}>English</button>
      </div>
    </header>;
}
function Footer() {
  return <footer className="footer">
      <Link className="brand" to="/">
        <Mountain size={22} />{tr("שביל")}</Link>
      <p>{tr("רעיון טוב מתחיל במידע. טיול טוב מתחיל בבדיקה.")}</p>
      <div>
        <Link to="/about">{tr("מידע, מקורות ופרטיות")}</Link>
        <Link to="/accessibility">{language()==="he"?"הצהרת נגישות":"Accessibility statement"}</Link>
        {display(safetyLinks.map(([l, u]) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">
            {display(l)}
          </a>))}
      </div>
      <small>{tr("מידע נבדק לאחרונה ב-9.10.2026. המידע אינו מתעדכן אוטומטית. המפה מציגה נקודות התחלה, לא שבילי ניווט.")}</small>
    </footer>;
}
export default function App() {
  useTranslation();
  return <>
      <a className="skip-link" href="#main">{tr("דלגו לתוכן")}</a>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/long" element={<LongHub />} />
        <Route path="/long/:id" element={<LongDetail />} />
        <Route path="/accessibility" element={<AccessibilityStatement />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <AccessibilityMenu />
    </>;
}
