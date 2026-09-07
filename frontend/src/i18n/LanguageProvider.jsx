import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGES, STRINGS } from "./strings";

const LanguageContext = createContext(null);
const STORAGE_KEY = "saathi.lang";

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch {
    // Storage blocked; fall through to the browser's preference.
  }
  // Someone whose browser is set to Hindi should not have to find a toggle.
  if (typeof navigator !== "undefined" && /^hi\b/i.test(navigator.language || "")) return "hi";
  return "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLanguage);

  // `data-lang` on <body> drives the Devanagari font stack in index.css.
  useEffect(() => {
    document.body.dataset.lang = lang;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not persisting is fine; the choice still holds for this session.
    }
  }, [lang]);

  const t = useCallback(
    (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLang must be used inside a LanguageProvider");
  return context;
}

/** The EN / हिं switch used in the page headers. */
export function LanguageSwitch({ compact = false, className = "" }) {
  const { lang, setLang, languages } = useLang();

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex overflow-hidden rounded-full border border-line ${className}`}
    >
      {languages.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          aria-pressed={lang === option.code}
          className={[
            compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-1.5 text-[13px]",
            "font-semibold transition-colors",
            lang === option.code
              ? "bg-accent-soft text-accent-strong"
              : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {compact ? option.short : option.label}
        </button>
      ))}
    </div>
  );
}
