import type { AttributeDefinition } from './attribute-api.js';

export const TASK_PLATFORM_INSTANCE_KEYS = [
  'status',
  'title',
  'weight',
  'due_date',
  'predecessor_task_ids',
  'dependent_task_ids',
] as const;

export type TaskPlatformInstanceKey = (typeof TASK_PLATFORM_INSTANCE_KEYS)[number];

export const TASK_PLATFORM_FIELD_ORDER: TaskPlatformInstanceKey[] = [
  'status',
  'title',
  'weight',
  'due_date',
  'predecessor_task_ids',
  'dependent_task_ids',
];

export function isTaskPlatformInstanceAttribute(
  definition: Pick<AttributeDefinition, 'key' | 'definition_scope' | 'owner_type'>,
): boolean {
  return (
    definition.owner_type === 'task_model' &&
    definition.definition_scope === 'instance' &&
    TASK_PLATFORM_INSTANCE_KEYS.includes(definition.key as TaskPlatformInstanceKey)
  );
}

export function isTaskInstanceStatusAttribute(
  definition: Pick<AttributeDefinition, 'key' | 'definition_scope' | 'owner_type'>,
): boolean {
  return isTaskPlatformInstanceAttribute(definition) && definition.key === 'status';
}

export function findTaskStatusDefinition(
  definitions: AttributeDefinition[],
): AttributeDefinition | undefined {
  return definitions.find(isTaskInstanceStatusAttribute);
}

export function isTaskReferencePlatformKey(key: string): boolean {
  return key === 'predecessor_task_ids' || key === 'dependent_task_ids';
}

export function orderedTaskPlatformDefinitions(
  definitions: AttributeDefinition[],
): AttributeDefinition[] {
  const byKey = new Map<string, AttributeDefinition>();
  for (const def of definitions) {
    if (isTaskPlatformInstanceAttribute(def)) {
      byKey.set(def.key, def);
    }
  }
  return TASK_PLATFORM_FIELD_ORDER.map((key) => byKey.get(key)).filter(
    (def): def is AttributeDefinition => def !== undefined,
  );
}
