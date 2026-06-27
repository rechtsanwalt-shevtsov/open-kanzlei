import type { DefinitionScope, ModelOwnerType } from '../../legal-work/validation.js';
import type { PlatformInstanceAttributeSeed } from '../../legal-work/case-model-platform-attributes.js';
import { CASE_MODEL_PLATFORM_INSTANCE_DEFINITIONS } from '../../legal-work/case-model-platform-attributes.js';
import { TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS } from '../../legal-work/task-model-platform-attributes.js';

export type SharedAttributeTarget = ModelOwnerType;

export interface SharedAttributeRegistryEntry extends PlatformInstanceAttributeSeed {
  target: SharedAttributeTarget;
  definition_scope: DefinitionScope;
}

/** Centrally curated cross-app attribute vocabulary (beyond platform-standard keys). */
export const SHARED_ATTRIBUTE_REGISTRY: ReadonlyArray<SharedAttributeRegistryEntry> = [
  {
    target: 'task_model',
    definition_scope: 'instance',
    key: 'priority',
    data_type: 'single_select',
    translations: { de: 'Priorität', en: 'Priority' },
    encryption_mode: 'server_readable',
    is_required: false,
    select_options: ['low', 'medium', 'high', 'critical'],
    locked_select_options: ['low', 'medium', 'high', 'critical'],
    select_option_translations: {
      low: { de: 'Niedrig', en: 'Low' },
      medium: { de: 'Mittel', en: 'Medium' },
      high: { de: 'Hoch', en: 'High' },
      critical: { de: 'Kritisch', en: 'Critical' },
    },
  },
  {
    target: 'task_model',
    definition_scope: 'instance',
    key: 'activity',
    data_type: 'single_select',
    translations: { de: 'Aktivität', en: 'Activity' },
    encryption_mode: 'server_readable',
    is_required: true,
    select_options: ['not_set', 'draft', 'approval', 'sending'],
    locked_select_options: ['not_set'],
    select_option_translations: {
      not_set: { de: 'nicht gesetzt', en: 'Not set' },
      draft: { de: 'Entwurf', en: 'Draft' },
      approval: { de: 'Freigabe', en: 'Approval' },
      sending: { de: 'Verschicken', en: 'Sending' },
    },
    default_value: 'not_set',
  },
  {
    target: 'task_model',
    definition_scope: 'instance',
    key: 'activity_status',
    data_type: 'single_select',
    translations: { de: 'Aktivitätsstatus', en: 'Activity status' },
    encryption_mode: 'server_readable',
    is_required: true,
    select_options: ['in_process', 'done'],
    locked_select_options: ['in_process', 'done'],
    select_option_translations: {
      in_process: { de: 'in Arbeit', en: 'in Process' },
      done: { de: 'Fertig', en: 'done' },
    },
    default_value: 'in_process',
  },
  {
    target: 'task_model',
    definition_scope: 'instance',
    key: 'reminder_date',
    data_type: 'date',
    translations: { de: 'Erinnerung', en: 'Reminder' },
    encryption_mode: 'server_readable',
    is_required: false,
  },
  {
    target: 'case_model',
    definition_scope: 'instance',
    key: 'reference',
    data_type: 'text',
    translations: { de: 'Aktenzeichen', en: 'Reference' },
    encryption_mode: 'server_readable',
    is_required: false,
  },
];

const sharedByKey = new Map(
  SHARED_ATTRIBUTE_REGISTRY.map((entry) => [entry.key, entry] as const),
);

const platformKeysByTarget = new Map<SharedAttributeTarget, Set<string>>([
  ['case_model', new Set(CASE_MODEL_PLATFORM_INSTANCE_DEFINITIONS.map((d) => d.key))],
  ['task_model', new Set(TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS.map((d) => d.key))],
]);

export function isSharedRegistryKey(key: string): boolean {
  return sharedByKey.has(key);
}

export function getSharedRegistryEntry(key: string): SharedAttributeRegistryEntry | null {
  return sharedByKey.get(key) ?? null;
}

export function isKnownRequiredAttributeKey(
  key: string,
  target: SharedAttributeTarget,
): boolean {
  if (platformKeysByTarget.get(target)?.has(key)) return true;
  const entry = sharedByKey.get(key);
  return entry?.target === target;
}

export function resolveRequiredAttributeSeed(
  key: string,
  target: SharedAttributeTarget,
  definitionScope: DefinitionScope,
): PlatformInstanceAttributeSeed | null {
  const shared = sharedByKey.get(key);
  if (shared && shared.target === target && shared.definition_scope === definitionScope) {
    return shared;
  }

  if (target === 'case_model' && definitionScope === 'instance') {
    return CASE_MODEL_PLATFORM_INSTANCE_DEFINITIONS.find((d) => d.key === key) ?? null;
  }
  if (target === 'task_model' && definitionScope === 'instance') {
    return TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS.find((d) => d.key === key) ?? null;
  }

  return null;
}
