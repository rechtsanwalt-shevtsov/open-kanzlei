import type { Locale } from '../foundation/i18n/locale.js';
import { isSupportedLocale } from '../foundation/i18n/locale.js';
import { badRequest } from '../api/errors.js';
import { displayNameFromTranslations } from '../foundation/i18n/display-name.js';

export type SelectOptionTranslations = Record<string, Record<string, string>>;

export function normalizeSelectOptionTranslations(raw: unknown): SelectOptionTranslations {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: SelectOptionTranslations = {};
  for (const [optionKey, locales] of Object.entries(raw as Record<string, unknown>)) {
    if (!optionKey.trim() || !locales || typeof locales !== 'object' || Array.isArray(locales)) {
      continue;
    }
    const labels: Record<string, string> = {};
    for (const [locale, label] of Object.entries(locales as Record<string, unknown>)) {
      if (typeof label !== 'string' || !label.trim()) continue;
      if (!isSupportedLocale(locale)) continue;
      labels[locale] = label.trim();
    }
    if (Object.keys(labels).length > 0) {
      result[optionKey.trim()] = labels;
    }
  }
  return result;
}

export function pruneSelectOptionTranslations(
  translations: SelectOptionTranslations,
  selectOptions: string[],
): SelectOptionTranslations {
  const allowed = new Set(selectOptions);
  const pruned: SelectOptionTranslations = {};
  for (const [key, labels] of Object.entries(translations)) {
    if (allowed.has(key)) {
      pruned[key] = labels;
    }
  }
  return pruned;
}

export function resolveSelectOptionLabels(
  selectOptions: string[],
  translations: SelectOptionTranslations,
  locale: Locale,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const option of selectOptions) {
    labels[option] = displayNameFromTranslations(translations[option], option, locale);
  }
  return labels;
}
