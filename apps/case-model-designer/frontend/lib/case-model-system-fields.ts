import type { components } from '@shell/api/schema.js';
import type { MessageKey } from '@shell/i18n/messages.js';
import type { Locale } from '@shell/i18n/locale.js';
import { caseModelStatusLabel } from './case-model-status.js';

type CaseModel = components['schemas']['CaseModel'];

export type SystemFieldKey =
  | 'id'
  | 'key'
  | 'status'
  | 'translations'
  | 'description'
  | 'display_name'
  | 'created_at'
  | 'updated_at';

export const MODEL_TAB_SYSTEM_FIELDS: SystemFieldKey[] = [
  'translations',
  'description',
  'status',
];

export const MODEL_TAB_ADVANCED_FIELDS: SystemFieldKey[] = [
  'id',
  'key',
  'display_name',
  'created_at',
  'updated_at',
];

export const LOCKED_SYSTEM_FIELDS = new Set<SystemFieldKey>([
  'id',
  'key',
  'created_at',
  'updated_at',
]);

export const READ_ONLY_SYSTEM_FIELDS = new Set<SystemFieldKey>([
  ...LOCKED_SYSTEM_FIELDS,
  'display_name',
]);

export type SystemFieldRow = {
  kind: 'system';
  id: string;
  fieldKey: SystemFieldKey;
  labelKey: MessageKey;
  typeKey: MessageKey;
  locked: boolean;
  readOnly: boolean;
  valueText: string;
};

const FIELD_LABELS: Record<SystemFieldKey, MessageKey> = {
  id: 'cmdFieldId',
  key: 'cmdFieldKey',
  status: 'cmdFieldStatus',
  translations: 'cmdModelName',
  description: 'cmdFieldDescription',
  display_name: 'cmdFieldDisplayName',
  created_at: 'cmdFieldCreatedAt',
  updated_at: 'cmdFieldUpdatedAt',
};

const FIELD_TYPES: Record<SystemFieldKey, MessageKey> = {
  id: 'cmdFieldTypeUuid',
  key: 'cmdFieldTypeText',
  status: 'cmdFieldTypeEnum',
  translations: 'cmdFieldTypeText',
  description: 'cmdFieldTypeText',
  display_name: 'cmdFieldTypeText',
  created_at: 'cmdFieldTypeDateTime',
  updated_at: 'cmdFieldTypeDateTime',
};

export function buildModelTabSystemFieldRows(
  model: CaseModel,
  locale: Locale,
  msg: (key: MessageKey) => string,
  advanced: boolean,
): SystemFieldRow[] {
  const keys = advanced
    ? [...MODEL_TAB_SYSTEM_FIELDS, ...MODEL_TAB_ADVANCED_FIELDS]
    : MODEL_TAB_SYSTEM_FIELDS;
  return buildSystemFieldRowsForKeys(model, locale, msg, keys);
}

function buildSystemFieldRowsForKeys(
  model: CaseModel,
  locale: Locale,
  msg: (key: MessageKey) => string,
  keys: SystemFieldKey[],
): SystemFieldRow[] {
  return keys.map((fieldKey) => {
    let valueText = '—';
    switch (fieldKey) {
      case 'id':
        valueText = model.id;
        break;
      case 'key':
        valueText = model.key;
        break;
      case 'status':
        valueText = caseModelStatusLabel(model.status, msg);
        break;
      case 'translations':
        valueText = model.translations?.[locale] ?? model.display_name ?? '—';
        break;
      case 'description':
        valueText = model.description?.trim() || '—';
        break;
      case 'display_name':
        valueText = model.display_name ?? '—';
        break;
      case 'created_at':
        valueText = new Date(model.created_at).toLocaleString(locale);
        break;
      case 'updated_at':
        valueText = new Date(model.updated_at).toLocaleString(locale);
        break;
    }

    return {
      kind: 'system',
      id: `__system:${fieldKey}`,
      fieldKey,
      labelKey: FIELD_LABELS[fieldKey],
      typeKey: FIELD_TYPES[fieldKey],
      locked: LOCKED_SYSTEM_FIELDS.has(fieldKey),
      readOnly: READ_ONLY_SYSTEM_FIELDS.has(fieldKey),
      valueText,
    };
  });
}

export function systemFieldSearchText(row: SystemFieldRow, msg: (key: MessageKey) => string): string {
  return [msg(row.labelKey), row.fieldKey, row.valueText].join(' ').toLowerCase();
}
