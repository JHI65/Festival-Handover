import { createContext, useContext } from "react";
import { DICT } from "./dict";

// Idiomas soportados. El español es el idioma "base": las claves de traducción
// SON el texto en español, así que lo no traducido cae a español sin romper nada.
export const LANGS = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

export const LANG_CODES = LANGS.map(l => l.code);

// Locale para formateo de fechas/horas según el idioma de la app
export const localeOf = (lang) => ({ es: "es", en: "en-GB", fr: "fr" }[lang] || "es");

export const LangCtx = createContext({ lang: "es", setLang: () => {}, t: (k) => k });
export const useLang = () => useContext(LangCtx);

// Autodetección: preferencia guardada > idioma del navegador > español
export function detectLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved && LANG_CODES.includes(saved)) return saved;
  } catch { /* localStorage no disponible */ }
  const n = (navigator.language || navigator.userLanguage || "es").toLowerCase();
  if (n.startsWith("en")) return "en";
  if (n.startsWith("fr")) return "fr";
  return "es";
}

// Crea la función de traducción para un idioma.
// t(key)            → traduce
// t(key, { n: 3 })  → traduce e interpola {n}
export function makeT(lang) {
  const table = DICT[lang];
  return (key, params) => {
    let str = (lang === "es" || !table) ? key : (table[key] ?? key);
    if (params) {
      for (const p in params) str = String(str).split(`{${p}}`).join(params[p]);
    }
    return str;
  };
}
