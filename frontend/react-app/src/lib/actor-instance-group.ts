import type { AttributeDefinition } from './attribute-api.js';

export function isActorInstanceGroupAttribute(
  definition: Pick<AttributeDefinition, 'key' | 'definition_scope' | 'owner_type'>,
): boolean {
  return (
    definition.owner_type === 'actor_model' &&
    definition.definition_scope === 'instance' &&
    definition.key === 'group'
  );
}

export function findActorGroupDefinition(
  definitions: AttributeDefinition[],
): AttributeDefinition | undefined {
  return definitions.find(isActorInstanceGroupAttribute);
}
