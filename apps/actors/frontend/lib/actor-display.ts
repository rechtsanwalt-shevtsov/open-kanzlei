import type { components } from '@shell/api/schema.js';

export type ActorItem = components['schemas']['Actor'];

export function actorTitle(item: ActorItem, modelLabel: string): string {
  const name = item.attributes?.name;
  const firstName = item.attributes?.first_name;
  const parts = [firstName, name].filter((v) => typeof v === 'string' && v.trim());
  if (parts.length > 0) return parts.join(' ');
  return modelLabel;
}

export function actorSearchText(item: ActorItem, modelLabel: string): string {
  return [
    actorTitle(item, modelLabel),
    item.attributes?.email,
    item.attributes?.phone,
    item.attributes?.address,
    item.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function formatActorDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
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
