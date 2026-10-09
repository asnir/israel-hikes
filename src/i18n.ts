import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import he from "./locales/he.json";
import en from "./locales/en.json";
import keys from "./locales/source-keys.json";
import type { ReactNode } from "react";
export type Language = "he" | "en";
export const languageKey = "shvil-language";
function initialLanguage(): Language {
  if (typeof window === "undefined") return "he";
  const explicit = new URLSearchParams(window.location.search).get("lang");
  if (explicit === "he" || explicit === "en") return explicit;
  try { return localStorage.getItem(languageKey) === "en" ? "en" : "he"; }
  catch { return "he"; }
}
i18n.use(initReactI18next).init({
  resources: { he: { translation: he }, en: { translation: en } },
  lng: initialLanguage(), fallbackLng: "he", supportedLngs: ["he", "en"],
  interpolation: { escapeValue: false }, returnEmptyString: false,
});
export function language(): Language { return i18n.resolvedLanguage === "en" ? "en" : "he"; }
function applyLanguage() {
  if (typeof document === "undefined") return;
  const lng = language();
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "he" ? "rtl" : "ltr";
  document.title = lng === "he" ? "שביל | מסלולים ומקטעים בישראל" : "Shvil | Trails and walking sections in Israel";
  try { localStorage.setItem(languageKey, lng); } catch { /* Private browsing may disable storage. */ }
}
i18n.on("languageChanged", applyLanguage);
applyLanguage();
const compositePhrases=Object.keys(keys).filter(k=>/[א-ת]/.test(k)).sort((a,b)=>b.length-a.length);
export function tr(source: string): string {
  if (/^https?:/.test(source)) return source;
  const key = (keys as Record<string, string>)[source];
  if (key) return String(i18n.t(key));
  if (language() === "en" && /[א-ת]/.test(source)) {
    // Legacy composite labels are rendered from stable values; match longest phrases first.
    let result = source;
    for (const phrase of compositePhrases) {
      if (result.includes(phrase)) result = result.split(phrase).join(String(i18n.t((keys as Record<string,string>)[phrase])));
    }
    return result;
  }
  return source;
}
/** Translate only rendered text, never filter values, IDs, URLs or route geometry. */
export function display(value: string): string;
export function display(value: ReactNode): ReactNode;
export function display(value: ReactNode): ReactNode {
  if (typeof value === "string") return tr(value);
  if (Array.isArray(value)) return value.map(display);
  return value;
}
export function english(source: string): string {
  const key = (keys as Record<string, string>)[source];
  return key ? (en as Record<string,string>)[key] || source : source;
}
export function fmtNumber(value: number) { return new Intl.NumberFormat(language() === "he" ? "he-IL" : "en-GB").format(value); }
export function distance(km: number) { return i18n.t("distance", { value: fmtNumber(km) }); }
export function driveText(minutes: number, km: number) { return i18n.t("drive", { minutes: fmtNumber(minutes), km: fmtNumber(km) }); }
export default i18n;
