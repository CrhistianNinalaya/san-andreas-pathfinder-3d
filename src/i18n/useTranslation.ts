import { useCallback, useSyncExternalStore } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

const STORAGE_KEY = 'sap_lang';

/**
 * Module-level language store.
 *
 * The selected language is shared process-wide rather than held in each hook's
 * own useState: useTranslation() is called independently by the header, route
 * cards, waypoint list, search box, actions, chart and the Leaflet nodes layer,
 * and per-instance state would leave every one of them on the previous language
 * after the switcher changed it.
 */
let currentLang: Language | null = null;
const listeners = new Set<() => void>();

function resolveInitialLanguage(): Language {
  // 1. URL parameter override (?l=es or ?l=en)
  const urlParam = new URLSearchParams(window.location.search).get('l');
  if (urlParam === 'en' || urlParam === 'es') return urlParam;

  // 2. Persisted local storage preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Ignore localStorage access failures (e.g. iframe sandbox)
  }

  // 3. Default to Spanish as the reference language
  return 'es';
}

function persistLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore localStorage access failures
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Must stay referentially stable between changes for useSyncExternalStore */
function getLanguageSnapshot(): Language {
  if (currentLang === null) {
    currentLang = resolveInitialLanguage();
    persistLanguage(currentLang);
  }
  return currentLang;
}

export function setLanguage(lang: Language): void {
  if (lang === getLanguageSnapshot()) return;
  currentLang = lang;
  persistLanguage(lang);
  listeners.forEach((listener) => listener());
}

export function useTranslation() {
  const lang = useSyncExternalStore(subscribe, getLanguageSnapshot, getLanguageSnapshot);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let str: string = translations[lang][key] || translations.es[key] || translations.en[key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, String(v));
      });
    }
    return str;
  }, [lang]);

  return { t, lang, setLang: setLanguage };
}
