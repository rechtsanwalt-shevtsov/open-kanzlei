import type { Locale } from '../i18n/locale.js';

export function labelFromTranslations(
  translations: Record<string, string> | undefined,
  key: string,
  locale: Locale,
): string {
  const t = translations ?? {};
  return t[locale] ?? t.de ?? t.en ?? key;
}
