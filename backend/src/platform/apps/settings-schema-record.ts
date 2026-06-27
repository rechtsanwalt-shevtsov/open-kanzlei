import { badRequest } from '../../api/errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export type AppSettingRecordKeyFormat = 'uuid' | 'identifier';

export interface AppSettingRecordKeySchema {
  enum?: string[];
  format?: AppSettingRecordKeyFormat;
}

export type AppSettingScalarValueType = 'string' | 'boolean' | 'number' | 'integer';

export type AppSettingValueSchema =
  | {
      type: 'string';
      allowedValues?: string[];
      nullable?: boolean;
    }
  | {
      type: 'boolean';
      nullable?: boolean;
    }
  | {
      type: 'number' | 'integer';
      allowedValues?: number[];
      minimum?: number;
      maximum?: number;
      nullable?: boolean;
    }
  | {
      type: 'record';
      keys?: AppSettingRecordKeySchema;
      properties?: Record<string, AppSettingValueSchema>;
      values?: AppSettingValueSchema;
      nullable?: boolean;
    };

export interface AppSettingRecordSchema {
  keys?: AppSettingRecordKeySchema;
  properties?: Record<string, AppSettingValueSchema>;
  values?: AppSettingValueSchema;
  nullable?: boolean;
}

function assertRecordSchemaDefined(path: string, schema: AppSettingRecordSchema): void {
  const hasProperties = schema.properties && Object.keys(schema.properties).length > 0;
  const hasValues = schema.values !== undefined;
  if (!hasProperties && !hasValues) {
    throw badRequest('error.validation_failed', { path, reason: 'record requires properties or values' });
  }
}

export function assertAppSettingValueSchema(path: string, schema: AppSettingValueSchema): void {
  if (schema.type === 'record') {
    assertRecordSchemaDefined(path, schema);
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        assertAppSettingValueSchema(`${path}.${key}`, child);
      }
    }
    if (schema.values) {
      assertAppSettingValueSchema(`${path}.*`, schema.values);
    }
    return;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) {
      throw badRequest('error.validation_failed', { path, reason: 'minimum > maximum' });
    }
  }
}

export function assertAppSettingRecordSchema(path: string, schema: AppSettingRecordSchema): void {
  assertRecordSchemaDefined(path, schema);
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      assertAppSettingValueSchema(`${path}.${key}`, child);
    }
  }
  if (schema.values) {
    assertAppSettingValueSchema(`${path}.*`, schema.values);
  }
}

function assertRecordKey(path: string, key: string, keys?: AppSettingRecordKeySchema): void {
  if (keys?.enum && !keys.enum.includes(key)) {
    throw badRequest('error.validation_failed', { path, key });
  }
  if (keys?.format === 'uuid' && !UUID_PATTERN.test(key)) {
    throw badRequest('error.validation_failed', { path, reason: 'invalid uuid key' });
  }
  if (keys?.format === 'identifier' && !IDENTIFIER_PATTERN.test(key)) {
    throw badRequest('error.validation_failed', { path, reason: 'invalid identifier key' });
  }
}

function validateScalarValue(
  path: string,
  schema: Extract<AppSettingValueSchema, { type: AppSettingScalarValueType }>,
  value: unknown,
): unknown {
  if (schema.nullable && value === null) return null;

  if (schema.type === 'string') {
    if (typeof value !== 'string') throw badRequest('error.validation_failed', { path });
    if (schema.allowedValues && !schema.allowedValues.includes(value)) {
      throw badRequest('error.validation_failed', { path });
    }
    return value;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') throw badRequest('error.validation_failed', { path });
    return value;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest('error.validation_failed', { path });
  }
  if (schema.type === 'integer' && !Number.isInteger(value)) {
    throw badRequest('error.validation_failed', { path });
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    throw badRequest('error.validation_failed', { path });
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    throw badRequest('error.validation_failed', { path });
  }
  if (schema.allowedValues && !schema.allowedValues.includes(value)) {
    throw badRequest('error.validation_failed', { path });
  }
  return value;
}

function validateRecordValue(
  path: string,
  schema: AppSettingRecordSchema,
  value: unknown,
): Record<string, unknown> | null {
  if (schema.nullable && value === null) {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('error.validation_failed', { path });
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  if (schema.properties) {
    for (const [propKey, propSchema] of Object.entries(schema.properties)) {
      if (propKey in input) {
        output[propKey] = validateAppSettingValue(`${path}.${propKey}`, propSchema, input[propKey]);
      }
    }
  }

  const openKeys = schema.properties
    ? Object.keys(input).filter((key) => !(key in schema.properties!))
    : Object.keys(input);

  if (schema.values) {
    for (const key of openKeys) {
      assertRecordKey(`${path}.${key}`, key, schema.keys);
      output[key] = validateAppSettingValue(`${path}.${key}`, schema.values, input[key]);
    }
  } else if (schema.properties) {
    for (const key of openKeys) {
      throw badRequest('error.validation_failed', { path, key });
    }
  }

  return output;
}

export function validateAppSettingValue(
  path: string,
  schema: AppSettingValueSchema,
  value: unknown,
): unknown {
  if (schema.type === 'record') {
    return validateRecordValue(path, schema, value);
  }
  return validateScalarValue(path, schema, value);
}

export function validateAppSettingRecordFieldValue(
  path: string,
  schema: AppSettingRecordSchema,
  value: unknown,
): Record<string, unknown> | null {
  return validateRecordValue(path, schema, value);
}
