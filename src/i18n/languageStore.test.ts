import { describe, it, expect, beforeEach } from 'vitest';
import {
  setLanguage,
  getLanguageSnapshot,
  formatTranslation,
  subscribeLanguage
} from './languageStore';

describe('languageStore', () => {
  beforeEach(() => {
    setLanguage('es');
  });

  it('updates language and notifies subscribers', () => {
    let notified = false;
    const unsubscribe = subscribeLanguage(() => {
      notified = true;
    });

    setLanguage('en');
    expect(getLanguageSnapshot()).toBe('en');
    expect(notified).toBe(true);

    unsubscribe();
  });

  it('formats translation with param replacement', () => {
    const formatted = formatTranslation({ key: 'edgeDistance', lang: 'en', params: { dist: 125 } });
    expect(formatted).toContain('125');
  });
});
