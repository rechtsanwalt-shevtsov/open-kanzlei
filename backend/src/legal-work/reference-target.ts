export const REFERENCE_TARGET_TYPES = ['actor', 'case', 'task'] as const;

export type ReferenceTargetType = (typeof REFERENCE_TARGET_TYPES)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isReferenceTargetType(value: string): value is ReferenceTargetType {
  return (REFERENCE_TARGET_TYPES as readonly string[]).includes(value);
}

export function isReferenceUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
