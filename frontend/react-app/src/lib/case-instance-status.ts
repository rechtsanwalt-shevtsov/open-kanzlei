import type { AttributeDefinition } from './attribute-api.js';

export function isCaseInstanceStatusAttribute(
  definition: Pick<AttributeDefinition, 'key' | 'definition_scope' | 'owner_type'>,
): boolean {
  return (
    definition.owner_type === 'case_model' &&
    definition.definition_scope === 'instance' &&
    definition.key === 'status'
  );
}

export function findCaseStatusDefinition(
  definitions: AttributeDefinition[],
): AttributeDefinition | undefined {
  return definitions.find(isCaseInstanceStatusAttribute);
}
