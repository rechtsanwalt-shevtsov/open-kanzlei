import type { AttributeDefinition } from './attribute-api.js';

export function isActorInstanceStatusAttribute(
  definition: Pick<AttributeDefinition, 'key' | 'definition_scope' | 'owner_type'>,
): boolean {
  return (
    definition.owner_type === 'actor_model' &&
    definition.definition_scope === 'instance' &&
    definition.key === 'status'
  );
}

export function findActorStatusDefinition(
  definitions: AttributeDefinition[],
): AttributeDefinition | undefined {
  return definitions.find(isActorInstanceStatusAttribute);
}
