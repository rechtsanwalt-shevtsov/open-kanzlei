import { forbidden } from '../api/errors.js';
import type { DefinitionScope, ModelOwnerType } from './validation.js';
import {
  WORK_STATUS_VALUES,
  assertPlatformWorkStatusSelectOptionTranslationsAllowed,
  assertPlatformWorkStatusSelectOptionsUnchanged,
} from './work-status.js';
import type { SelectOptionTranslations } from './select-option-translations.js';

/** Platform contract: instance attribute keys on every case model. */
export const CASE_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS = ['status', 'title'] as const;

export type CaseModelPlatformInstanceAttributeKey =
  (typeof CASE_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS)[number];

const PLATFORM_KEY_SET = new Set<string>(CASE_MODEL_PLATFORM_INSTANCE_ATTRIBUTE_KEYS);

export type PlatformInstanceAttributeSeed = {
  key: string;
  data_type: 'text' | 'single_select' | 'number' | 'date' | 'multi_select';
  translations: Record<string, string>;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  is_required: boolean;
  select_options?: string[];
  select_option_translations?: SelectOptionTranslations;
  /** Registry options that tenants may label but not remove or rename. */
  locked_select_options?: string[];
  default_value?: string | number;
};

export const DEFAULT_WORK_STATUS_OPTION_TRANSLATIONS: SelectOptionTranslations = {
  not_started: { de: 'Noch nicht begonnen', en: 'Not started' },
  started: { de: 'In Bearbeitung', en: 'In progress' },
  completed: { de: 'Abgeschlossen', en: 'Completed' },
};

/** @deprecated Use DEFAULT_WORK_STATUS_OPTION_TRANSLATIONS */
export const DEFAULT_CASE_STATUS_OPTION_TRANSLATIONS = DEFAULT_WORK_STATUS_OPTION_TRANSLATIONS;

export const CASE_MODEL_PLATFORM_INSTANCE_DEFINITIONS: ReadonlyArray<PlatformInstanceAttributeSeed> =
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
  ];

export function isPlatformCaseModelInstanceAttribute(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): boolean {
  return (
    ownerType === 'case_model' &&
    definitionScope === 'instance' &&
    PLATFORM_KEY_SET.has(key)
  );
}

export function isCaseInstanceStatusDefinition(def: {
  owner_type: ModelOwnerType;
  definition_scope: DefinitionScope;
  key: string;
}): boolean {
  return (
    isPlatformCaseModelInstanceAttribute(def.owner_type, def.definition_scope, def.key) &&
    def.key === 'status'
  );
}

export function assertAttributeKeyAllowedOnCreate(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
): void {
  if (isPlatformCaseModelInstanceAttribute(ownerType, definitionScope, key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

export function assertCasePlatformAttributeUpdateAllowed(
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

  if (def.key === 'title') {
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
}
