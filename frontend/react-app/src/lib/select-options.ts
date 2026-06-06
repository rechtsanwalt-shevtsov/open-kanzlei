import type { AttributeDefinition } from './attribute-api.js';
import type { Locale } from '../i18n/locale.js';
import { labelFromTranslations } from './model-label.js';

export type SelectOptionRow = {
  /** Stable React row id */
  id: string;
  /** Stable option key in select_options; empty until derived from label */
  key: string;
  label: string;
};

export function createEmptySelectOptionRow(): SelectOptionRow {
  return { id: crypto.randomUUID(), key: '', label: '' };
}

export function toSelectOptionRows(
  attribute: Pick<AttributeDefinition, 'select_options' | 'select_option_translations'> | undefined,
  locale: Locale,
): SelectOptionRow[] {
  return (attribute?.select_options ?? []).map((key) => ({
    id: key,
    key,
    label: labelFromTranslations(attribute?.select_option_translations?.[key], key, locale),
  }));
}

export function slugifyOptionKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
}

function allocateUniqueOptionKey(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (true) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
    n += 1;
  }
}

/** Assign stable keys for new rows from label; drop rows without label/key. */
export function normalizeSelectOptionRows(rows: SelectOptionRow[]): SelectOptionRow[] {
  const used = new Set<string>();
  const result: SelectOptionRow[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    let key = row.key;
    if (!key) {
      key = slugifyOptionKey(label);
      if (!key) continue;
    }
    key = allocateUniqueOptionKey(key, used);
    used.add(key);
    result.push({ ...row, key, label });
  }
  return result;
}

export function buildSelectOptionsPayload(
  rows: SelectOptionRow[],
  locale: Locale,
  existing?: Pick<AttributeDefinition, 'select_option_translations'>,
): {
  select_options: string[];
  select_option_translations: Record<string, Record<string, string>>;
  normalized: SelectOptionRow[];
} {
  const normalized = normalizeSelectOptionRows(rows);
  const select_options = normalized.map((row) => row.key);
  const select_option_translations: Record<string, Record<string, string>> = {};
  for (const row of normalized) {
    const prev = existing?.select_option_translations?.[row.key] ?? {};
    select_option_translations[row.key] = { ...prev, [locale]: row.label.trim() };
  }
  return { select_options, select_option_translations, normalized };
}

export function reorderSelectOptionRows(
  rows: SelectOptionRow[],
  fromIndex: number,
  toIndex: number,
): SelectOptionRow[] {
  if (fromIndex === toIndex) return rows;
  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return rows;
  next.splice(toIndex, 0, moved);
  return next;
}
