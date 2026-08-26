import { useState, useCallback } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => {
    const urlParam = new URLSearchParams(window.location.search).get('l');
    if (urlParam === 'en' || urlParam === 'es') return urlParam;
    return navigator.language.startsWith('es') ? 'es' : 'en';
  });

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let str: string = translations[lang][key] || translations.en[key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  }, [lang]);

  return { t, lang, setLang };
}
