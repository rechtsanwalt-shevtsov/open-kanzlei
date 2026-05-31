import { badRequest } from '../api/errors.js';

export const MODEL_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export type DataType = 'text' | 'number' | 'boolean' | 'date';
export type ModelOwnerType = 'case_model' | 'task_model' | 'instrument_model';
export type InstanceOwnerType = 'case' | 'task' | 'instrument';

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
  if (!['text', 'number', 'boolean', 'date'].includes(value)) {
    throw badRequest('error.validation_failed');
  }
}

export function serializeAttributeValue(
  dataType: DataType,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    throw badRequest('error.invalid_attribute_value');
  }

  switch (dataType) {
    case 'text':
      if (typeof value !== 'string') throw badRequest('error.invalid_attribute_value');
      return value;
    case 'number':
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
    default:
      throw badRequest('error.invalid_attribute_value');
  }
}

export function parseAttributeValue(
  dataType: DataType,
  stored: string | null,
): string | number | boolean | null {
  if (stored === null) return null;
  switch (dataType) {
    case 'text':
    case 'date':
      return stored;
    case 'number':
      return Number(stored);
    case 'boolean':
      return stored === 'true';
    default:
      return stored;
  }
}

export function toIso(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}
