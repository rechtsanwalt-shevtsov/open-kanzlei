import { forbidden } from '../api/errors.js';
import type { DefinitionScope, ModelOwnerType } from './validation.js';
import type { SelectOptionTranslations } from './select-option-translations.js';
import {
  ACTOR_STATUS_VALUES,
  DEFAULT_ACTOR_STATUS,
  DEFAULT_ACTOR_STATUS_OPTION_TRANSLATIONS,
} from './actor-status.js';
import type { PlatformInstanceAttributeSeed } from './case-model-platform-attributes.js';

/** Platform contract: instance attribute keys on every actor model. */
export const ACTOR_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS = ['status'] as const;

export type ActorModelPlatformInstanceAttributeKey =
  (typeof ACTOR_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS)[number];

const PLATFORM_KEY_SET = new Set<string>(ACTOR_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS);

export const ACTOR_MODEL_PLATFORM_INSTANCE_DEFINITIONS: ReadonlyArray<PlatformInstanceAttributeSeed> =
  [
    {
      key: 'status',
      data_type: 'single_select',
      translations: { de: 'Status', en: 'Status' },
      encryption_mode: 'server_readable',
      is_required: false,
      select_options: [...ACTOR_STATUS_VALUES],
      select_option_translations: DEFAULT_ACTOR_STATUS_OPTION_TRANSLATIONS,
      default_value: DEFAULT_ACTOR_STATUS,
    },
  ];

export function isPlatformActorModelInstanceAttribute(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): boolean {
  return (
    ownerType === 'actor_model' &&
    definitionScope === 'instance' &&
    PLATFORM_KEY_SET.has(key)
  );
}

export function isActorInstanceStatusDefinition(def: {
  owner_type: ModelOwnerType;
  definition_scope: DefinitionScope;
  key: string;
}): boolean {
  return (
    isPlatformActorModelInstanceAttribute(def.owner_type, def.definition_scope, def.key) &&
    def.key === 'status'
  );
}

export function assertActorAttributeKeyAllowedOnCreate(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): void {
  if (isPlatformActorModelInstanceAttribute(ownerType, definitionScope, key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

export function assertActorPlatformAttributeUpdateAllowed(
  def: {
    key: string;
    data_type: string;
    encryption_mode: string;
    is_required: boolean;
    select_options: string[];
  },
  input: {
    data_type?: string;
    encryption_mode?: string;
    is_required?: boolean;
    select_options?: string[];
    select_option_translations?: SelectOptionTranslations;
    default_value?: unknown;
  },
): void {
  if (def.key !== 'status') return;

  if (input.data_type !== undefined && input.data_type !== def.data_type) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.encryption_mode !== undefined && input.encryption_mode !== def.encryption_mode) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.is_required !== undefined && input.is_required !== def.is_required) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.default_value !== undefined) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (input.select_options !== undefined) {
    const next = new Set(input.select_options);
    for (const option of ACTOR_STATUS_VALUES) {
      if (!next.has(option)) {
        throw forbidden('error.attribute_definition_reserved');
      }
    }
  }
}
