import type { AttributeDefinition } from './attribute-api.js';

export function selectOptionLabel(
  optionKey: string,
  definition: Pick<AttributeDefinition, 'select_option_labels'>,
): string {
  return definition.select_option_labels?.[optionKey] ?? optionKey;
}

export function selectOptionsWithLabels(
  definition: Pick<AttributeDefinition, 'select_options' | 'select_option_labels'>,
): Array<{ key: string; label: string }> {
  return (definition.select_options ?? []).map((key) => ({
    key,
    label: selectOptionLabel(key, definition),
  }));
}
