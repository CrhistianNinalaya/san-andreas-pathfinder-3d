import { useCallback, useSyncExternalStore } from 'react';
import type { TranslationKey } from './translations';
import {
  subscribeLanguage,
  getLanguageSnapshot,
  setLanguage,
  formatTranslation
} from './languageStore';

export { setLanguage };

/**
 * Custom hook providing localized translations and language switching state.
 */
export function useTranslation() {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, getLanguageSnapshot);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return formatTranslation({ key, lang, params });
    },
    [lang]
  );

  return { t, lang, setLang: setLanguage };
}
