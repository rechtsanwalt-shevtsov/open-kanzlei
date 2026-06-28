import type { AttributeDefinition } from '@shell/lib/attribute-api.js';

export function parseFieldValue(def: AttributeDefinition, raw: string): unknown {
  if (!raw.trim() && def.data_type !== 'boolean') return null;
  switch (def.data_type) {
    case 'number':
    case 'money':
      return raw === '' ? null : Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'multi_select':
      return raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return raw.trim() || null;
  }
}

export function defaultFieldValue(def: AttributeDefinition): string {
  const v = def.default_value;
  if (v === null || v === undefined) return '';
  if (def.data_type === 'boolean') return v === true ? 'true' : 'false';
  if (def.data_type === 'multi_select') return '';
  return String(v);
}

export function defaultMultiSelectValue(def: AttributeDefinition): string[] {
  const v = def.default_value;
  if (Array.isArray(v)) return v.filter((item): item is string => typeof item === 'string');
  return [];
}

export function parseFieldValueFromState(
  def: AttributeDefinition,
  textValue: string,
  multiValue: string[],
): unknown {
  if (def.data_type === 'multi_select') {
    return multiValue.length ? multiValue : null;
  }
  return parseFieldValue(def, textValue);
}
