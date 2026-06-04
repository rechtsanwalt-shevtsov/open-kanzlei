import { attributeSearchText, instanceTitle } from '@shell/lib/work-instance.js';
import type { components } from '@shell/api/schema.js';

export type CaseItem = components['schemas']['Case'];

export function caseTitle(item: CaseItem, modelLabel: string): string {
  return instanceTitle(item.attributes, modelLabel);
}

export function caseSearchText(item: CaseItem, modelLabel: string): string {
  return [
    caseTitle(item, modelLabel),
    modelLabel,
    item.status,
    attributeSearchText(item.attributes),
  ]
    .join(' ')
    .toLowerCase();
}

export function formatCaseDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function formatFieldValue(
  dataType: string,
  value: string | number | boolean | string[] | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (dataType === 'multi_select' && Array.isArray(value)) return value.join(', ');
  if (dataType === 'boolean') return value === true ? 'true' : 'false';
  return String(value);
}
