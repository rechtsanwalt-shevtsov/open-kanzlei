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

export type AppSettingFieldType = 'string' | 'boolean' | 'number' | 'record';

export interface AppSettingFieldSchema {
  type: AppSettingFieldType;
  default: unknown;
  allowedValues?: Array<string | boolean | number>;
  tenantConfigurable: boolean;
  userOverridable: boolean;
  record?: AppSettingRecordSchema;
}

export function isRecordSettingField(
  field: Pick<AppSettingFieldSchema, 'type'>,
): field is AppSettingFieldSchema & { type: 'record' } {
  return field.type === 'record';
}

export function formatRecordSettingValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function coerceRecordSettingValue(field: AppSettingFieldSchema, value: unknown): unknown {
  if (value === null || value === undefined) return field.default;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return field.default;
}
