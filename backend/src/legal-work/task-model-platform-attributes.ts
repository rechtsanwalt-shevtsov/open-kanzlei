import { forbidden } from '../api/errors.js';
import type { DefinitionScope, ModelOwnerType } from './validation.js';
import {
  WORK_STATUS_VALUES,
  assertPlatformWorkStatusSelectOptionTranslationsAllowed,
  assertPlatformWorkStatusSelectOptionsUnchanged,
} from './work-status.js';
import type { SelectOptionTranslations } from './select-option-translations.js';
import {
  DEFAULT_WORK_STATUS_OPTION_TRANSLATIONS,
  type PlatformInstanceAttributeSeed,
} from './case-model-platform-attributes.js';

/** Platform contract: instance attribute keys on every task model. */
export const TASK_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS = [
  'status',
  'title',
  'weight',
  'due_date',
  'predecessor_task_ids',
  'dependent_task_ids',
] as const;

export type TaskModelPlatformInstanceAttributeKey =
  (typeof TASK_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS)[number];

const PLATFORM_KEY_SET = new Set<string>(TASK_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS);

/** Keys stored on legal.tasks columns and mirrored in API attributes (not attribute_values). */
export const TASK_PLATFORM_COLUMN_ATTRIBUTE_KEYS = new Set<string>([
  'status',
  'predecessor_task_ids',
  'dependent_task_ids',
]);

export const TASK_MODEL_PLATFORM_INSTANCE_DEFINITIONS: ReadonlyArray<PlatformInstanceAttributeSeed> =
  [
    {
      key: 'status',
      data_type: 'single_select',
      translations: { de: 'Status', en: 'Status' },
      encryption_mode: 'server_readable',
      is_required: false,
      select_options: [...WORK_STATUS_VALUES],
      select_option_translations: DEFAULT_WORK_STATUS_OPTION_TRANSLATIONS,
      default_value: 'not_started',
    },
    {
      key: 'title',
      data_type: 'text',
      translations: { de: 'Titel', en: 'Title' },
      encryption_mode: 'zero_knowledge',
      is_required: true,
    },
    {
      key: 'weight',
      data_type: 'number',
      translations: { de: 'Gewicht', en: 'Weight' },
      encryption_mode: 'server_readable',
      is_required: false,
    },
    {
      key: 'due_date',
      data_type: 'date',
      translations: { de: 'Fristende', en: 'Due date' },
      encryption_mode: 'server_readable',
      is_required: false,
    },
    {
      key: 'predecessor_task_ids',
      data_type: 'text',
      translations: { de: 'Vorgängeraufgaben', en: 'Predecessor tasks' },
      encryption_mode: 'server_readable',
      is_required: false,
    },
    {
      key: 'dependent_task_ids',
      data_type: 'text',
      translations: { de: 'Abhängige Tasks', en: 'Dependent tasks' },
      encryption_mode: 'server_readable',
      is_required: false,
    },
  ];

export function isPlatformTaskModelInstanceAttribute(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): boolean {
  return (
    ownerType === 'task_model' &&
    definitionScope === 'instance' &&
    PLATFORM_KEY_SET.has(key)
  );
}

export function isTaskInstanceStatusDefinition(def: {
  owner_type: ModelOwnerType;
  definition_scope: DefinitionScope;
  key: string;
}): boolean {
  return (
    isPlatformTaskModelInstanceAttribute(def.owner_type, def.definition_scope, def.key) &&
    def.key === 'status'
  );
}

export function assertTaskAttributeKeyAllowedOnCreate(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): void {
  if (isPlatformTaskModelInstanceAttribute(ownerType, definitionScope, key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

export function assertTaskPlatformAttributeUpdateAllowed(
  def: {
    key: string;
    data_type: string;
    encryption_mode: string;
    is_required: boolean;
  },
  input: {
    data_type?: string;
    encryption_mode?: string;
    is_required?: boolean;
    select_options?: string[];
    select_option_translations?: SelectOptionTranslations;
    default_value?: unknown;
    translations?: Record<string, string>;
  },
): void {
  if (def.key === 'status') {
    if (input.data_type !== undefined && input.data_type !== def.data_type) {
      throw forbidden('error.attribute_definition_reserved');
    }
    if (input.encryption_mode !== undefined && input.encryption_mode !== def.encryption_mode) {
      throw forbidden('error.attribute_definition_reserved');
    }
    if (input.is_required !== undefined && input.is_required !== def.is_required) {
      throw forbidden('error.attribute_definition_reserved');
    }
    if (input.select_options !== undefined) {
      assertPlatformWorkStatusSelectOptionsUnchanged(input.select_options);
    }
    if (input.default_value !== undefined) {
      throw forbidden('error.attribute_definition_reserved');
    }
    if (input.select_option_translations !== undefined) {
      assertPlatformWorkStatusSelectOptionTranslationsAllowed(input.select_option_translations);
    }
    return;
  }

  if (input.data_type !== undefined && input.data_type !== def.data_type) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.encryption_mode !== undefined && input.encryption_mode !== def.encryption_mode) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.is_required !== undefined && input.is_required !== def.is_required) {
    throw forbidden('error.attribute_definition_reserved');
  }
}
