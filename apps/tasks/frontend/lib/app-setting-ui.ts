import type { MessageKey } from '@shell/i18n/messages.js';
import type { AppSettingFieldSchema } from '../settings-schema.js';

const SETTING_LABEL_KEYS: Record<string, MessageKey> = {
  itemsPerPage: 'tasItemsPerPage',
};

export function settingLabelKey(key: string): MessageKey {
  return SETTING_LABEL_KEYS[key] ?? 'tasSettingsColSetting';
}

export function settingOptions(
  _key: string,
  field: AppSettingFieldSchema,
  msg: (k: MessageKey) => string,
): Array<{ value: string; label: string }> {
  if (field.type === 'boolean') {
    return [
      { value: 'true', label: msg('usersActiveYes') },
      { value: 'false', label: msg('usersActiveNo') },
    ];
  }

  const values = field.allowedValues ?? [];
  return values.map((value) => ({
    value: String(value),
    label: String(value),
  }));
}

export function coerceSettingValue(field: AppSettingFieldSchema, raw: unknown): unknown {
  if (field.type === 'boolean') return raw === true || raw === 'true';
  if (field.type === 'number') return Number(raw);
  return String(raw);
}

export function formatSettingValue(
  _key: string,
  value: unknown,
  _msg?: (k: MessageKey) => string,
): string {
  return String(value);
}

export function parseSettingSelectValue(field: AppSettingFieldSchema, raw: string): unknown {
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'number') return Number(raw);
  return raw;
}

export function settingSelectValue(value: unknown): string {
  return String(value);
}
