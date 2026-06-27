import { badRequest } from '../../api/errors.js';
import {
  assertAppSettingRecordSchema,
  assertAppSettingValueSchema,
  type AppSettingRecordSchema,
  validateAppSettingRecordFieldValue,
} from './settings-schema-record.js';

export type SettingFieldType = 'string' | 'boolean' | 'number' | 'record';

export type {
  AppSettingRecordKeyFormat,
  AppSettingRecordKeySchema,
  AppSettingRecordSchema,
  AppSettingScalarValueType,
  AppSettingValueSchema,
} from './settings-schema-record.js';

export interface AppSettingFieldSchema {
  type: SettingFieldType;
  default: unknown;
  allowedValues?: Array<string | boolean | number>;
  tenantConfigurable: boolean;
  userOverridable: boolean;
  /** Required when type === 'record'. Describes keys and nested value shapes. */
  record?: AppSettingRecordSchema;
}

export type AppSettingsSchema = Record<string, AppSettingFieldSchema>;

export function assertAppSettingsSchema(schema: AppSettingsSchema): void {
  for (const [key, field] of Object.entries(schema)) {
    assertAppSettingFieldSchema(key, field);
  }
}

export function assertAppSettingFieldSchema(key: string, field: AppSettingFieldSchema): void {
  if (field.type === 'record') {
    if (!field.record) {
      throw badRequest('error.validation_failed', { key, reason: 'record schema is required' });
    }
    assertAppSettingRecordSchema(key, field.record);
    validateAppSettingRecordFieldValue(key, field.record, field.default);
    return;
  }

  if (field.default === null || field.default === undefined) {
    throw badRequest('error.validation_failed', { key, reason: 'default is required' });
  }

  validateScalarFieldValue(key, field, field.default);
}

function validateScalarFieldValue(
  key: string,
  field: AppSettingFieldSchema,
  value: unknown,
): unknown {
  if (field.type === 'string') {
    if (typeof value !== 'string') throw badRequest('error.validation_failed', { key });
    if (field.allowedValues && !field.allowedValues.includes(value)) {
      throw badRequest('error.validation_failed', { key });
    }
    return value;
  }
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') throw badRequest('error.validation_failed', { key });
    return value;
  }
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw badRequest('error.validation_failed', { key });
    }
    if (field.allowedValues && !field.allowedValues.includes(value)) {
      throw badRequest('error.validation_failed', { key });
    }
    return value;
  }
  throw badRequest('error.validation_failed', { key });
}

export function buildDefaultSettings(schema: AppSettingsSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    out[key] = field.default;
  }
  return out;
}

function validateFieldValue(
  key: string,
  field: AppSettingFieldSchema,
  value: unknown,
): unknown {
  if (field.type === 'record') {
    if (!field.record) throw badRequest('error.validation_failed', { key });
    return validateAppSettingRecordFieldValue(key, field.record, value);
  }
  return validateScalarFieldValue(key, field, value);
}

export function pickValidSettings(
  schema: AppSettingsSchema,
  input: Record<string, unknown>,
  options: { tenantConfigurable?: boolean; userOverridable?: boolean },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = schema[key];
    if (!field) continue;
    if (options.tenantConfigurable !== undefined && field.tenantConfigurable !== options.tenantConfigurable) {
      continue;
    }
    if (options.userOverridable !== undefined && field.userOverridable !== options.userOverridable) {
      continue;
    }
    out[key] = validateFieldValue(key, field, value);
  }
  return out;
}

export function mergeEffectiveSettings(
  schema: AppSettingsSchema,
  tenantOverrides: Record<string, unknown>,
  userOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const effective = { ...buildDefaultSettings(schema) };
  for (const [key, value] of Object.entries(tenantOverrides)) {
    if (schema[key]?.tenantConfigurable) effective[key] = value;
  }
  for (const [key, value] of Object.entries(userOverrides)) {
    if (schema[key]?.userOverridable) effective[key] = value;
  }
  return effective;
}
