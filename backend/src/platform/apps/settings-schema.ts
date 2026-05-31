export type SettingFieldType = 'string' | 'boolean' | 'number';

export interface AppSettingFieldSchema {
  type: SettingFieldType;
  default: string | boolean | number;
  allowedValues?: Array<string | boolean | number>;
  tenantConfigurable: boolean;
  userOverridable: boolean;
}

export type AppSettingsSchema = Record<string, AppSettingFieldSchema>;

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
  if (field.type === 'string') {
    if (typeof value !== 'string') throw new Error(key);
    if (field.allowedValues && !field.allowedValues.includes(value)) throw new Error(key);
    return value;
  }
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(key);
    return value;
  }
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(key);
    if (field.allowedValues && !field.allowedValues.includes(value)) throw new Error(key);
    return value;
  }
  throw new Error(key);
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
