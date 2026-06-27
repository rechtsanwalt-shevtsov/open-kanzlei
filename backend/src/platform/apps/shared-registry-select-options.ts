import { forbidden } from '../../api/errors.js';
import { getSharedRegistryEntry } from './shared-attribute-registry.js';

export function resolveSharedRegistryLockedSelectOptions(attributeKey: string): string[] {
  const entry = getSharedRegistryEntry(attributeKey);
  if (!entry?.locked_select_options?.length) return [];
  return [...entry.locked_select_options];
}

export function assertSharedRegistryLockedSelectOptionsPreserved(
  attributeKey: string,
  nextOptions: string[],
): void {
  const locked = resolveSharedRegistryLockedSelectOptions(attributeKey);
  if (locked.length === 0) return;

  const nextSet = new Set(nextOptions);
  for (const key of locked) {
    if (!nextSet.has(key)) {
      throw forbidden('error.attribute_definition_reserved');
    }
  }
}

export function isSharedRegistryLockedSelectOption(
  attributeKey: string,
  optionKey: string,
): boolean {
  return resolveSharedRegistryLockedSelectOptions(attributeKey).includes(optionKey);
}
