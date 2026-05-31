export type Locale = 'de' | 'en';

const STORAGE_KEY = 'openkanzlei.locale';

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'de' || stored === 'en') return stored;
  const browser = navigator.language.split('-')[0];
  return browser === 'en' ? 'en' : 'de';
}

export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}
