import { translations, type Language, type TranslationKey } from './translations';

export const STORAGE_KEY = 'sap_lang';

let currentLang: Language | null = null;
const listeners = new Set<() => void>();

/**
 * Resolves the initial language from URL params, localStorage, or fallback.
 */
export function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'es';
  }

  const urlParam = new URLSearchParams(window.location.search).get('l');
  if (urlParam === 'en' || urlParam === 'es') {
    return urlParam;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') {
      return saved;
    }
  } catch {
    return 'es';
  }

  return 'es';
}

/**
 * Persists selected language to localStorage.
 */
export function persistLanguage(lang: Language): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
  }
}

/**
 * Subscribes listener to language store updates.
 */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns current language snapshot for useSyncExternalStore.
 */
export function getLanguageSnapshot(): Language {
  if (currentLang === null) {
    currentLang = resolveInitialLanguage();
    persistLanguage(currentLang);
  }
  return currentLang;
}

/**
 * Sets current language and notifies listeners.
 */
export function setLanguage(lang: Language): void {
  if (lang === getLanguageSnapshot()) return;
  currentLang = lang;
  persistLanguage(lang);
  listeners.forEach((listener) => listener());
}

export interface FormatTranslationOptions {
  key: TranslationKey;
  lang: Language;
  params?: Record<string, string | number>;
}

/**
 * Formats translation string with param substitution.
 */
export function formatTranslation({ key, lang, params }: Readonly<FormatTranslationOptions>): string {
  let str: string = translations[lang][key] ?? translations.es[key] ?? translations.en[key] ?? String(key);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, String(v));
    });
  }
  return str;
}
