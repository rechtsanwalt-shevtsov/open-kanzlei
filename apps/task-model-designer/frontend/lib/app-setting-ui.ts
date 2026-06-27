import type { MessageKey } from '@shell/i18n/messages.js';
import {
  coerceRecordSettingValue,
  formatRecordSettingValue,
  isRecordSettingField,
} from '@shell/lib/app-settings-schema.js';
import {
  encryptionModeMessageKey,
  type EncryptionMode,
} from '@shell/lib/encryption-mode-label.js';
import type { AppSettingFieldSchema } from '../settings-schema.js';
import { taskModelStatusLabel, type TaskModelStatus } from './task-model-status.js';

const SETTING_LABEL_KEYS: Record<string, MessageKey> = {
  defaultTaskModelStatus: 'tmdDefaultStatus',
  showTechnicalKeys: 'tmdShowKeys',
  defaultAttributeEncryptionMode: 'tmdDefaultAttributeEncryption',
  itemsPerPage: 'tmdItemsPerPage',
  editorLayout: 'tmdEditorLayout',
};

export function settingLabelKey(key: string): MessageKey {
  return SETTING_LABEL_KEYS[key] ?? 'tmdSettingsColSetting';
}

export function settingOptions(
  key: string,
  field: AppSettingFieldSchema,
  msg: (k: MessageKey) => string,
): Array<{ value: string; label: string }> {
  if (isRecordSettingField(field)) {
    return [];
  }

  if (field.type === 'boolean') {
    return [
      { value: 'true', label: msg('usersActiveYes') },
      { value: 'false', label: msg('usersActiveNo') },
    ];
  }

  const values = field.allowedValues ?? [];
  return values.map((value) => ({
    value: String(value),
    label: formatSettingValue(key, value, msg),
  }));
}

export function formatSettingValue(
  key: string,
  value: unknown,
  msg: (k: MessageKey) => string,
  field?: AppSettingFieldSchema,
): string {
  if (field && isRecordSettingField(field)) return formatRecordSettingValue(value);
  if (key === 'defaultTaskModelStatus' && typeof value === 'string') {
    return taskModelStatusLabel(value as TaskModelStatus, msg);
  }
  if (key === 'defaultAttributeEncryptionMode' && typeof value === 'string') {
    return msg(encryptionModeMessageKey(value as EncryptionMode));
  }
  if (key === 'showTechnicalKeys' && typeof value === 'boolean') {
    return value ? msg('usersActiveYes') : msg('usersActiveNo');
  }
  if (key === 'editorLayout' && value === 'simple') return msg('tmdEditorLayoutSimple');
  if (key === 'editorLayout' && value === 'advanced') return msg('tmdEditorLayoutAdvanced');
  return String(value);
}

export function parseSettingSelectValue(field: AppSettingFieldSchema, raw: string): unknown {
  if (isRecordSettingField(field)) return field.default;
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'number') return Number(raw);
  return raw;
}

export function coerceSettingValue(field: AppSettingFieldSchema, value: unknown): unknown {
  if (isRecordSettingField(field)) return coerceRecordSettingValue(field, value);
  if (value === undefined || value === null) return field.default;
  if (field.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return field.default;
  }
  if (field.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : field.default;
  }
  return typeof value === 'string' ? value : String(value);
}

export function settingSelectValue(value: unknown): string {
  return String(value);
}
