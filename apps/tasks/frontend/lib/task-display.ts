import { attributeSearchText, instanceTitle } from '@shell/lib/work-instance.js';
import type { components } from '@shell/api/schema.js';

export type TaskItem = components['schemas']['Task'];

export function taskTitle(item: TaskItem, modelLabel: string): string {
  return instanceTitle(item.attributes, modelLabel);
}

export function taskSearchText(
  item: TaskItem,
  modelLabel: string,
  caseLabel: string,
): string {
  return [
    taskTitle(item, modelLabel),
    modelLabel,
    caseLabel,
    item.status,
    attributeSearchText(item.attributes),
  ]
    .join(' ')
    .toLowerCase();
}

export function formatTaskDate(iso: string, locale: string): string {
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
