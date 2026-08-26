import { useState, useEffect, useCallback } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => {
    // 1. URL parameter override (?l=es or ?l=en)
    const urlParam = new URLSearchParams(window.location.search).get('l');
    if (urlParam === 'en' || urlParam === 'es') return urlParam;

    // 2. Persisted local storage preference
    try {
      const saved = localStorage.getItem('sap_lang');
      if (saved === 'en' || saved === 'es') return saved;
    } catch {
      // Ignore localStorage access failures (e.g. iframe sandbox)
    }

    // 3. Default to Spanish as the reference language
    return 'es';
  });

  useEffect(() => {
    try {
      localStorage.setItem('sap_lang', lang);
    } catch {
      // Ignore localStorage access failures
    }
  }, [lang]);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let str: string = translations[lang][key] || translations.es[key] || translations.en[key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, String(v));
      });
    }
    return str;
  }, [lang]);

  return { t, lang, setLang };
}
