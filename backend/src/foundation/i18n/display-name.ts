import type { Locale } from './locale.js';

export function displayNameFromTranslations(
  translations: Record<string, string> | undefined,
  key: string,
  locale: Locale,
): string {
  const t = translations ?? {};
  return t[locale] ?? t.de ?? t.en ?? key;
}
