import { badRequest } from '../api/errors.js';

export const MODEL_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export const DATA_TYPES = [
  'text',
  'number',
  'money',
  'date',
  'boolean',
  'single_select',
  'multi_select',
] as const;

export type DataType = (typeof DATA_TYPES)[number];
export type DefinitionScope = 'model' | 'instance';
export type ModelOwnerType = 'case_model' | 'task_model';
export type InstanceOwnerType = 'case' | 'task';
export type AttributeValueOwnerType = InstanceOwnerType | ModelOwnerType;

export function assertModelKey(key: string): void {
  if (!MODEL_KEY_PATTERN.test(key)) {
    throw badRequest('error.validation_failed');
  }
}

export const CASE_MODEL_STATUSES = ['draft', 'active', 'archived'] as const;
export type CaseModelStatus = (typeof CASE_MODEL_STATUSES)[number];

export function assertCaseModelStatus(status: string): asserts status is CaseModelStatus {
  if (!CASE_MODEL_STATUSES.includes(status as CaseModelStatus)) {
    throw badRequest('error.validation_failed');
  }
}

export function assertDataType(value: string): asserts value is DataType {
  if (!DATA_TYPES.includes(value as DataType)) {
    throw badRequest('error.validation_failed');
  }
}

export function assertDefinitionScope(value: string): asserts value is DefinitionScope {
  if (value !== 'model' && value !== 'instance') {
    throw badRequest('error.validation_failed');
  }
}

export function isSelectDataType(dataType: DataType): boolean {
  return dataType === 'single_select' || dataType === 'multi_select';
}

export function normalizeSelectOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw badRequest('error.validation_failed');
  const options = raw.map((item) => {
    if (typeof item !== 'string') throw badRequest('error.validation_failed');
    const trimmed = item.trim();
    if (!trimmed) throw badRequest('error.validation_failed');
    return trimmed;
  });
  if (options.length === 0) throw badRequest('error.validation_failed');
  return [...new Set(options)];
}

export function serializeAttributeValue(dataType: DataType, value: unknown): string {
  if (value === null || value === undefined) {
    throw badRequest('error.invalid_attribute_value');
  }

  switch (dataType) {
    case 'text':
      if (typeof value !== 'string') throw badRequest('error.invalid_attribute_value');
      return value;
    case 'number':
    case 'money':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw badRequest('error.invalid_attribute_value');
      }
      return String(value);
    case 'boolean':
      if (typeof value !== 'boolean') throw badRequest('error.invalid_attribute_value');
      return value ? 'true' : 'false';
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw badRequest('error.invalid_attribute_value');
      }
      return value;
    case 'single_select':
      if (typeof value !== 'string' || !value.trim()) {
        throw badRequest('error.invalid_attribute_value');
      }
      return value.trim();
    case 'multi_select': {
      if (!Array.isArray(value) || value.length === 0) {
        throw badRequest('error.invalid_attribute_value');
      }
      const items = value.map((item) => {
        if (typeof item !== 'string' || !item.trim()) {
          throw badRequest('error.invalid_attribute_value');
        }
        return item.trim();
      });
      return JSON.stringify(items);
    }
    default:
      throw badRequest('error.invalid_attribute_value');
  }
}

export function parseAttributeValue(
  dataType: DataType,
  stored: string | null,
): string | number | boolean | string[] | null {
  if (stored === null) return null;
  switch (dataType) {
    case 'text':
    case 'date':
    case 'single_select':
      return stored;
    case 'number':
    case 'money':
      return Number(stored);
    case 'boolean':
      return stored === 'true';
    case 'multi_select': {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((item): item is string => typeof item === 'string');
      } catch {
        return null;
      }
    }
    default:
      return stored;
  }
}

export function parseDefaultValueJson(
  dataType: DataType,
  raw: unknown,
  selectOptions: string[],
): unknown {
  if (raw === null || raw === undefined) return null;

  switch (dataType) {
    case 'text':
      if (typeof raw !== 'string') throw badRequest('error.validation_failed');
      return raw;
    case 'number':
    case 'money':
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        throw badRequest('error.validation_failed');
      }
      return raw;
    case 'boolean':
      if (typeof raw !== 'boolean') throw badRequest('error.validation_failed');
      return raw;
    case 'date':
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
        throw badRequest('error.validation_failed');
      }
      return raw;
    case 'single_select': {
      if (typeof raw !== 'string' || !selectOptions.includes(raw)) {
        throw badRequest('error.validation_failed');
      }
      return raw;
    }
    case 'multi_select': {
      if (!Array.isArray(raw) || raw.length === 0) throw badRequest('error.validation_failed');
      for (const item of raw) {
        if (typeof item !== 'string' || !selectOptions.includes(item)) {
          throw badRequest('error.validation_failed');
        }
      }
      return raw;
    }
    default:
      throw badRequest('error.validation_failed');
  }
}

export function isEmptyAttributeValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function toIso(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}
