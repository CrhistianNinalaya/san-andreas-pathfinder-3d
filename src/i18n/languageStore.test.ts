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

  it('translates alternativeRoute and vehicle short names in both languages', () => {
    const altEs = formatTranslation({ key: 'alternativeRoute', lang: 'es', params: { index: 1 } });
    const altEn = formatTranslation({ key: 'alternativeRoute', lang: 'en', params: { index: 1 } });
    expect(altEs).toBe('Ruta alternativa 1');
    expect(altEn).toBe('Alternative Route 1');

    const bikeEs = formatTranslation({ key: 'vehShort_bike', lang: 'es' });
    const bikeEn = formatTranslation({ key: 'vehShort_bike', lang: 'en' });
    expect(bikeEs).toBe('Motocicleta');
    expect(bikeEn).toBe('Motorcycle');
  });
});
