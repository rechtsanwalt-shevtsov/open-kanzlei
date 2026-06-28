import type pg from 'pg';
import { badRequest, conflict, forbidden, notFound } from '../api/errors.js';
import { displayNameFromTranslations } from '../foundation/i18n/display-name.js';
import type { Locale } from '../foundation/i18n/locale.js';
import { isSupportedLocale } from '../foundation/i18n/locale.js';
import { getEncryptionService } from '../foundation/encryption/passthrough.js';
import { allocateUniqueAttributeKey, slugifyModelKey } from './model-key.js';
import {
  assertAttributeKeyAllowedOnCreate as assertCaseAttributeKeyAllowedOnCreate,
  assertCasePlatformAttributeUpdateAllowed,
  isCaseInstanceStatusDefinition,
  isPlatformCaseModelInstanceAttribute,
} from './case-model-platform-attributes.js';
import {
  assertActorAttributeKeyAllowedOnCreate,
  assertActorPlatformAttributeUpdateAllowed,
  isActorInstanceStatusDefinition,
  isPlatformActorModelInstanceAttribute,
} from './actor-model-platform-attributes.js';
import {
  assertTaskAttributeKeyAllowedOnCreate,
  assertTaskPlatformAttributeUpdateAllowed,
  isPlatformTaskModelInstanceAttribute,
  isTaskInstanceStatusDefinition,
} from './task-model-platform-attributes.js';
import { DEFAULT_WORK_STATUS, WORK_STATUS_VALUES } from './work-status.js';
import { assertAttributeKeyFormat, parseAppProvidedAttributeKey } from '../platform/apps/app-attribute-contract.js';
import {
  assertAppAttributeDefinitionDeletable,
  deleteAppAttributeBindings,
} from '../platform/apps/app-attribute-bindings.js';
import { isSharedRegistryKey } from '../platform/apps/shared-attribute-registry.js';
import {
  assertSharedRegistryLockedSelectOptionsPreserved,
  isSharedRegistryLockedSelectOption,
  resolveSharedRegistryLockedSelectOptions,
} from '../platform/apps/shared-registry-select-options.js';
import {
  normalizeSelectOptionTranslations,
  pruneSelectOptionTranslations,
  resolveSelectOptionLabels,
  type SelectOptionTranslations,
} from './select-option-translations.js';
import {
  assertDataType,
  assertDefinitionScope,
  assertModelKey,
  isEmptyAttributeValue,
  isSelectDataType,
  isReferenceDataType,
  normalizeSelectOptions,
  parseAttributeValue,
  parseDefaultValueJson,
  serializeAttributeValue,
  toIso,
  type DataType,
  type DefinitionScope,
  type InstanceOwnerType,
  type ModelOwnerType,
} from './validation.js';
import {
  assertReferencedEntityExists,
  assertReferenceTargetTypeConfigured,
} from './reference-resolution.js';
import type { ReferenceTargetType } from './reference-target.js';

export type CreateAttributeDefinitionInput = {
  key?: string;
  name?: string;
  locale?: string;
  definition_scope?: string;
  data_type: string;
  encryption_mode?: string;
  translations?: Record<string, string>;
  is_required?: boolean;
  select_options?: string[];
  select_option_translations?: SelectOptionTranslations;
  default_value?: unknown;
  reference_target_type?: string;
  reference_target_model_id?: string | null;
};
export type UpdateAttributeDefinitionInput = {
  name?: string;
  locale?: string;
  data_type?: string;
  encryption_mode?: string;
  translations?: Record<string, string>;
  is_required?: boolean;
  select_options?: string[];
  select_option_translations?: SelectOptionTranslations;
  default_value?: unknown;
  reference_target_type?: string;
  reference_target_model_id?: string | null;
};

export interface AttributeDefinitionDto {
  id: string;
  owner_type: ModelOwnerType;
  owner_id: string;
  definition_scope: DefinitionScope;
  key: string;
  data_type: DataType;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  translations: Record<string, string>;
  is_required: boolean;
  select_options: string[];
  select_option_translations: SelectOptionTranslations;
  default_value: unknown;
  reference_target_type: ReferenceTargetType | null;
  reference_target_model_id: string | null;
  display_name?: string;
  select_option_labels?: Record<string, string>;
  /** Shared-registry option keys that may be labeled but not removed or renamed (read-only in responses). */
  locked_select_options?: string[];
  created_at: string;
  updated_at: string;
}

interface DefinitionRow {
  id: string;
  owner_type: ModelOwnerType;
  owner_id: string;
  definition_scope: DefinitionScope;
  key: string;
  data_type: DataType;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  translations: Record<string, string>;
  is_required: boolean;
  select_options: string[];
  select_option_translations: SelectOptionTranslations;
  default_value: unknown;
  reference_target_type: ReferenceTargetType | null;
  reference_target_model_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const DEFINITION_COLUMNS = `id, owner_type, owner_id, definition_scope, key, data_type,
  encryption_mode, translations, is_required, select_options, select_option_translations,
  default_value, reference_target_type, reference_target_model_id, created_at, updated_at`;

function mapDefinition(row: DefinitionRow): AttributeDefinitionDto {
  return {
    id: row.id,
    owner_type: row.owner_type,
    owner_id: row.owner_id,
    definition_scope: row.definition_scope,
    key: row.key,
    data_type: row.data_type,
    encryption_mode: row.encryption_mode,
    translations: row.translations ?? {},
    is_required: row.is_required,
    select_options: row.select_options ?? [],
    select_option_translations: row.select_option_translations ?? {},
    default_value: row.default_value ?? null,
    reference_target_type: row.reference_target_type,
    reference_target_model_id: row.reference_target_model_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export function enrichAttributeDefinition(
  definition: AttributeDefinitionDto,
  locale: Locale,
): AttributeDefinitionDto {
  const enriched: AttributeDefinitionDto = {
    ...definition,
    display_name: displayNameFromTranslations(definition.translations, definition.key, locale),
  };
  if (isSelectDataType(definition.data_type)) {
    enriched.select_option_labels = resolveSelectOptionLabels(
      definition.select_options,
      definition.select_option_translations,
      locale,
    );
    const locked = resolveSharedRegistryLockedSelectOptions(definition.key);
    if (locked.length > 0) {
      enriched.locked_select_options = locked;
    }
  }
  return enriched;
}

function assertCustomAttributeKeyAllowedOnCreate(
  key: string,
  options?: { allowSharedRegistryKeys?: boolean; allowAppKeys?: boolean },
): void {
  if (!options?.allowAppKeys && parseAppProvidedAttributeKey(key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (!options?.allowSharedRegistryKeys && isSharedRegistryKey(key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

function assertAttributeKeyAllowedOnCreate(
  ownerType: ModelOwnerType,
  definitionScope: DefinitionScope,
  key: string,
  options?: { allowSharedRegistryKeys?: boolean; allowAppKeys?: boolean },
): void {
  if (ownerType === 'case_model') {
    assertCaseAttributeKeyAllowedOnCreate(ownerType, definitionScope, key);
  } else if (ownerType === 'task_model') {
    assertTaskAttributeKeyAllowedOnCreate(ownerType, definitionScope, key);
  } else if (ownerType === 'actor_model') {
    assertActorAttributeKeyAllowedOnCreate(ownerType, definitionScope, key);
  } else if (ownerType === 'message_model') {
    // No platform-reserved keys on message models.
  }
  assertCustomAttributeKeyAllowedOnCreate(key, options);
}

function assertAttributeDefinitionDeletable(
  def: AttributeDefinitionDto,
): void {
  if (isPlatformCaseModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (isPlatformTaskModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
  if (isPlatformActorModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    throw forbidden('error.attribute_definition_reserved');
  }
}

function assertAttributeDefinitionUpdateAllowed(
  def: AttributeDefinitionDto,
  input: UpdateAttributeDefinitionInput,
): void {
  if (isPlatformCaseModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    assertCasePlatformAttributeUpdateAllowed(def, input);
    return;
  }
  if (isPlatformTaskModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    assertTaskPlatformAttributeUpdateAllowed(def, input);
  }
  if (isPlatformActorModelInstanceAttribute(def.owner_type, def.definition_scope, def.key)) {
    assertActorPlatformAttributeUpdateAllowed(def, input);
  }
  if (isSharedRegistryKey(def.key) && isSelectDataType(def.data_type)) {
    if (input.select_options !== undefined) {
      assertSharedRegistryLockedSelectOptionsPreserved(def.key, input.select_options);
    }
  }
}

async function assertRemovedSelectOptionsNotInUse(
  client: pg.PoolClient,
  tenantId: string,
  existing: AttributeDefinitionDto,
  nextOptions: string[],
): Promise<void> {
  const removed = existing.select_options.filter((option) => !nextOptions.includes(option));
  if (removed.length === 0) return;

  for (const option of removed) {
    if (isSharedRegistryLockedSelectOption(existing.key, option)) {
      throw forbidden('error.attribute_definition_reserved');
    }

    if (isCaseInstanceStatusDefinition(existing)) {
      const inUse = await client.query(
        `SELECT 1 FROM legal.cases
         WHERE tenant_id = $1 AND case_model_id = $2 AND status = $3
         LIMIT 1`,
        [tenantId, existing.owner_id, option],
      );
      if (inUse.rowCount) {
        throw conflict('error.select_option_in_use');
      }
      continue;
    }

    if (isTaskInstanceStatusDefinition(existing)) {
      const inUse = await client.query(
        `SELECT 1 FROM legal.tasks
         WHERE tenant_id = $1 AND task_model_id = $2 AND status = $3
         LIMIT 1`,
        [tenantId, existing.owner_id, option],
      );
      if (inUse.rowCount) {
        throw conflict('error.select_option_in_use');
      }
      continue;
    }

    if (isActorInstanceStatusDefinition(existing)) {
      const inUse = await client.query(
        `SELECT 1 FROM legal.actors
         WHERE tenant_id = $1 AND actor_model_id = $2 AND status = $3
         LIMIT 1`,
        [tenantId, existing.owner_id, option],
      );
      if (inUse.rowCount) {
        throw conflict('error.select_option_in_use');
      }
      continue;
    }

    if (existing.data_type === 'single_select') {
      const inUse = await client.query(
        `SELECT 1 FROM meta.attribute_values
         WHERE tenant_id = $1 AND attribute_definition_id = $2 AND plaintext_value = $3
         LIMIT 1`,
        [tenantId, existing.id, option],
      );
      if (inUse.rowCount) {
        throw conflict('error.select_option_in_use');
      }
      continue;
    }

    if (existing.data_type === 'multi_select') {
      const values = await client.query<{ plaintext_value: string | null }>(
        `SELECT plaintext_value FROM meta.attribute_values
         WHERE tenant_id = $1 AND attribute_definition_id = $2`,
        [tenantId, existing.id],
      );
      for (const row of values.rows) {
        const parsed = parseAttributeValue('multi_select', row.plaintext_value);
        if (Array.isArray(parsed) && parsed.includes(option)) {
          throw conflict('error.select_option_in_use');
        }
      }
    }
  }
}

function resolveLocale(value: string | undefined, fallback: Locale): Locale {
  return value && isSupportedLocale(value) ? value : fallback;
}

function assertNonEmptyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw badRequest('error.validation_failed');
  return trimmed;
}

function resolveSelectOptions(dataType: DataType, raw: unknown): string[] {
  if (!isSelectDataType(dataType)) return [];
  return normalizeSelectOptions(raw);
}

function resolveDefaultValue(
  dataType: DataType,
  selectOptions: string[],
  raw: unknown | undefined,
  isRequired: boolean,
): unknown | null {
  if (raw === undefined) return null;
  if (raw === null) {
    if (isRequired) throw badRequest('error.validation_failed');
    return null;
  }
  return parseDefaultValueJson(dataType, raw, selectOptions);
}

function resolveReferenceFields(
  dataType: DataType,
  definitionScope: DefinitionScope,
  input: {
    reference_target_type?: string;
    reference_target_model_id?: string | null;
  },
): {
  reference_target_type: ReferenceTargetType | null;
  reference_target_model_id: string | null;
} {
  if (!isReferenceDataType(dataType)) {
    return { reference_target_type: null, reference_target_model_id: null };
  }
  assertReferenceTargetTypeConfigured(dataType, definitionScope, input.reference_target_type);
  return {
    reference_target_type: input.reference_target_type!,
    reference_target_model_id: input.reference_target_model_id?.trim() || null,
  };
}

async function assertReferenceDefaultValueValid(
  client: pg.PoolClient,
  tenantId: string,
  dataType: DataType,
  referenceTargetType: ReferenceTargetType | null,
  referenceTargetModelId: string | null,
  defaultValue: unknown | null,
): Promise<void> {
  if (!isReferenceDataType(dataType) || defaultValue === null || defaultValue === undefined) {
    return;
  }
  if (!referenceTargetType) {
    throw badRequest('error.validation_failed');
  }
  await assertReferencedEntityExists(
    client,
    tenantId,
    referenceTargetType,
    String(defaultValue),
    referenceTargetModelId,
  );
}

function resolveCreateAttributeFields(
  input: CreateAttributeDefinitionInput,
  defaultLocale: Locale,
): {
  key?: string;
  definition_scope: DefinitionScope;
  data_type: DataType;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  translations: Record<string, string>;
  is_required: boolean;
  select_options: string[];
  select_option_translations: SelectOptionTranslations;
  default_value: unknown | null;
  reference_target_type: ReferenceTargetType | null;
  reference_target_model_id: string | null;
  generateKeyFromName?: string;
} {
  assertDataType(input.data_type);
  const definitionScope = input.definition_scope ?? 'instance';
  assertDefinitionScope(definitionScope);

  let encryptionMode: 'server_readable' | 'zero_knowledge' =
    input.encryption_mode === 'server_readable' ? 'server_readable' : 'zero_knowledge';
  if (isReferenceDataType(input.data_type)) {
    encryptionMode = 'server_readable';
  }

  const referenceFields = resolveReferenceFields(input.data_type, definitionScope, input);

  const selectOptions = resolveSelectOptions(input.data_type, input.select_options ?? []);
  if (isSelectDataType(input.data_type) && selectOptions.length === 0) {
    throw badRequest('error.validation_failed');
  }
  const selectOptionTranslations = pruneSelectOptionTranslations(
    normalizeSelectOptionTranslations(input.select_option_translations ?? {}),
    selectOptions,
  );

  const isRequired = Boolean(input.is_required);
  const defaultValue = resolveDefaultValue(
    input.data_type,
    selectOptions,
    input.default_value,
    false,
  );

  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return {
      definition_scope: definitionScope,
      data_type: input.data_type,
      encryption_mode: encryptionMode,
      translations: { [locale]: name },
      is_required: isRequired,
      select_options: selectOptions,
      select_option_translations: selectOptionTranslations,
      default_value: defaultValue,
      reference_target_type: referenceFields.reference_target_type,
      reference_target_model_id: referenceFields.reference_target_model_id,
      generateKeyFromName: name,
    };
  }

  if (!input.key || !input.translations) {
    throw badRequest('error.validation_failed');
  }
  assertAttributeKeyFormat(input.key);
  return {
    key: input.key,
    definition_scope: definitionScope,
    data_type: input.data_type,
    encryption_mode: encryptionMode,
    translations: input.translations,
    is_required: isRequired,
    select_options: selectOptions,
    select_option_translations: selectOptionTranslations,
    default_value: defaultValue,
    reference_target_type: referenceFields.reference_target_type,
    reference_target_model_id: referenceFields.reference_target_model_id,
  };
}

function resolveUpdateAttributeTranslations(
  existing: AttributeDefinitionDto,
  input: UpdateAttributeDefinitionInput,
  defaultLocale: Locale,
): Record<string, string> | undefined {
  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return { ...existing.translations, [locale]: name };
  }
  return input.translations;
}

export async function listAttributeDefinitions(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  definitionScope?: DefinitionScope,
): Promise<AttributeDefinitionDto[]> {
  const result = definitionScope
    ? await client.query<DefinitionRow>(
        `SELECT ${DEFINITION_COLUMNS}
         FROM meta.attribute_definitions
         WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
           AND definition_scope = $4
         ORDER BY key`,
        [tenantId, ownerType, ownerId, definitionScope],
      )
    : await client.query<DefinitionRow>(
        `SELECT ${DEFINITION_COLUMNS}
         FROM meta.attribute_definitions
         WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
         ORDER BY definition_scope, key`,
        [tenantId, ownerType, ownerId],
      );
  return result.rows.map(mapDefinition);
}

export async function createAttributeDefinition(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  input: CreateAttributeDefinitionInput,
  createdBy: string | null,
  options?: {
    defaultLocale?: Locale;
    allowPlatformKeys?: boolean;
    allowSharedRegistryKeys?: boolean;
    allowAppKeys?: boolean;
  },
): Promise<AttributeDefinitionDto> {
  const defaultLocale = options?.defaultLocale ?? 'de';
  const resolved = resolveCreateAttributeFields(input, defaultLocale);
  const key =
    resolved.key ??
    (await allocateUniqueAttributeKey(
      client,
      tenantId,
      ownerType,
      ownerId,
      resolved.definition_scope,
      slugifyModelKey(resolved.generateKeyFromName!),
    ));

  const privileged =
    options?.allowPlatformKeys || options?.allowSharedRegistryKeys || options?.allowAppKeys;
  if (!privileged) {
    assertAttributeKeyAllowedOnCreate(ownerType, resolved.definition_scope, key);
  } else {
    if (!options?.allowPlatformKeys) {
      if (ownerType === 'case_model') {
        assertCaseAttributeKeyAllowedOnCreate(ownerType, resolved.definition_scope, key);
      } else if (ownerType === 'task_model') {
        assertTaskAttributeKeyAllowedOnCreate(ownerType, resolved.definition_scope, key);
      }
    }
    assertCustomAttributeKeyAllowedOnCreate(key, options);
  }

  try {
    await assertReferenceDefaultValueValid(
      client,
      tenantId,
      resolved.data_type,
      resolved.reference_target_type,
      resolved.reference_target_model_id,
      resolved.default_value,
    );

    const result = await client.query<DefinitionRow>(
      `INSERT INTO meta.attribute_definitions
         (tenant_id, owner_type, owner_id, definition_scope, key, data_type,
          encryption_mode, translations, is_required, select_options,
          select_option_translations, default_value, reference_target_type,
          reference_target_model_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING ${DEFINITION_COLUMNS}`,
      [
        tenantId,
        ownerType,
        ownerId,
        resolved.definition_scope,
        key,
        resolved.data_type,
        resolved.encryption_mode,
        JSON.stringify(resolved.translations),
        resolved.is_required,
        JSON.stringify(resolved.select_options),
        JSON.stringify(resolved.select_option_translations),
        resolved.default_value === null ? null : JSON.stringify(resolved.default_value),
        resolved.reference_target_type,
        resolved.reference_target_model_id,
        createdBy,
      ],
    );
    return mapDefinition(result.rows[0]!);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw conflict('error.key_conflict');
    }
    throw err;
  }
}

export async function updateAttributeDefinition(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
  input: UpdateAttributeDefinitionInput,
  options?: { defaultLocale?: Locale },
): Promise<AttributeDefinitionDto> {
  const existing = await getAttributeDefinition(client, tenantId, id);
  if (!existing) throw notFound();
  assertAttributeDefinitionUpdateAllowed(existing, input);

  const dataType = (input.data_type ?? existing.data_type) as DataType;
  assertDataType(dataType);
  let encryptionMode: 'server_readable' | 'zero_knowledge' =
    input.encryption_mode === 'server_readable' ? 'server_readable' : existing.encryption_mode;
  if (isReferenceDataType(dataType)) {
    encryptionMode = 'server_readable';
  }
  const translations =
    resolveUpdateAttributeTranslations(existing, input, options?.defaultLocale ?? 'de') ??
    existing.translations;

  const referenceFields =
    input.reference_target_type !== undefined || input.data_type !== undefined
      ? resolveReferenceFields(dataType, existing.definition_scope, {
          reference_target_type:
            input.reference_target_type ?? existing.reference_target_type ?? undefined,
          reference_target_model_id:
            input.reference_target_model_id !== undefined
              ? input.reference_target_model_id
              : existing.reference_target_model_id,
        })
      : {
          reference_target_type: existing.reference_target_type,
          reference_target_model_id: existing.reference_target_model_id,
        };

  const isPlatformStatusDefinition =
    isCaseInstanceStatusDefinition(existing) || isTaskInstanceStatusDefinition(existing);

  const selectOptions = isPlatformStatusDefinition
    ? [...WORK_STATUS_VALUES]
    : input.select_options !== undefined
      ? resolveSelectOptions(dataType, input.select_options)
      : existing.select_options;
  if (isSelectDataType(dataType) && selectOptions.length === 0) {
    throw badRequest('error.validation_failed');
  }

  if (!isPlatformStatusDefinition) {
    await assertRemovedSelectOptionsNotInUse(client, tenantId, existing, selectOptions);
  }

  if (isSharedRegistryKey(existing.key) && isSelectDataType(dataType)) {
    assertSharedRegistryLockedSelectOptionsPreserved(existing.key, selectOptions);
  }

  const selectOptionTranslations =
    input.select_option_translations !== undefined
      ? pruneSelectOptionTranslations(
          normalizeSelectOptionTranslations(input.select_option_translations),
          selectOptions,
        )
      : input.select_options !== undefined
        ? pruneSelectOptionTranslations(existing.select_option_translations, selectOptions)
        : existing.select_option_translations;

  const isRequired = input.is_required ?? existing.is_required;
  const defaultValue = isPlatformStatusDefinition
    ? DEFAULT_WORK_STATUS
    : input.default_value !== undefined
      ? resolveDefaultValue(dataType, selectOptions, input.default_value, false)
      : existing.default_value;

  await assertReferenceDefaultValueValid(
    client,
    tenantId,
    dataType,
    referenceFields.reference_target_type,
    referenceFields.reference_target_model_id,
    defaultValue,
  );

  const result = await client.query<DefinitionRow>(
    `UPDATE meta.attribute_definitions
     SET data_type = $3, encryption_mode = $4, translations = $5,
         is_required = $6, select_options = $7, select_option_translations = $8,
         default_value = $9, reference_target_type = $10, reference_target_model_id = $11,
         updated_at = now()
     WHERE tenant_id = $1 AND id = $2
     RETURNING ${DEFINITION_COLUMNS}`,
    [
      tenantId,
      id,
      dataType,
      encryptionMode,
      JSON.stringify(translations),
      isRequired,
      JSON.stringify(selectOptions),
      JSON.stringify(selectOptionTranslations),
      defaultValue === null ? null : JSON.stringify(defaultValue),
      referenceFields.reference_target_type,
      referenceFields.reference_target_model_id,
    ],
  );
  return mapDefinition(result.rows[0]!);
}

export async function deleteAttributeDefinition(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
): Promise<void> {
  const existing = await getAttributeDefinition(client, tenantId, id);
  if (!existing) throw notFound();
  assertAttributeDefinitionDeletable(existing);
  await assertAppAttributeDefinitionDeletable(
    client,
    tenantId,
    existing.owner_type,
    existing.owner_id,
    existing.definition_scope,
    existing.key,
  );

  const inUse = await client.query(
    `SELECT 1 FROM meta.attribute_values WHERE attribute_definition_id = $1 LIMIT 1`,
    [id],
  );
  if (inUse.rowCount && inUse.rowCount > 0) {
    throw conflict('error.attribute_in_use');
  }

  const result = await client.query(
    `DELETE FROM meta.attribute_definitions WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  if (!result.rowCount) throw notFound();

  await deleteAppAttributeBindings(
    client,
    tenantId,
    existing.owner_type,
    existing.owner_id,
    existing.definition_scope,
    existing.key,
  );
}

export async function getAttributeDefinition(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
): Promise<AttributeDefinitionDto | null> {
  const result = await client.query<DefinitionRow>(
    `SELECT ${DEFINITION_COLUMNS}
     FROM meta.attribute_definitions
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  const row = result.rows[0];
  return row ? mapDefinition(row) : null;
}

export async function loadInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  instanceType: InstanceOwnerType,
  instanceId: string,
  modelType: ModelOwnerType,
  modelId: string,
): Promise<Record<string, string | number | boolean | string[] | null>> {
  const result = await client.query<{
    key: string;
    data_type: DataType;
    plaintext_value: string | null;
  }>(
    `SELECT d.key, d.data_type, v.plaintext_value
     FROM meta.attribute_definitions d
     LEFT JOIN meta.attribute_values v
       ON v.attribute_definition_id = d.id
      AND v.tenant_id = d.tenant_id
      AND v.owner_type = $2
      AND v.owner_id = $3
     WHERE d.tenant_id = $1 AND d.owner_type = $4 AND d.owner_id = $5
       AND d.definition_scope = 'instance'`,
    [tenantId, instanceType, instanceId, modelType, modelId],
  );

  const attrs: Record<string, string | number | boolean | string[] | null> = {};
  for (const row of result.rows) {
    if (row.plaintext_value !== null) {
      attrs[row.key] = parseAttributeValue(row.data_type, row.plaintext_value);
    }
  }
  return attrs;
}

export async function mergeInstanceAttributesWithDefaults(
  client: pg.PoolClient,
  tenantId: string,
  modelType: ModelOwnerType,
  modelId: string,
  values: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    modelType,
    modelId,
    'instance',
  );
  const merged: Record<string, unknown> = { ...(values ?? {}) };
  for (const def of defs) {
    if (
      (merged[def.key] === undefined || isEmptyAttributeValue(merged[def.key])) &&
      def.default_value !== null &&
      !isEmptyAttributeValue(def.default_value)
    ) {
      merged[def.key] = def.default_value;
    }
  }
  return merged;
}

async function assertRequiredInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  modelType: ModelOwnerType,
  modelId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    modelType,
    modelId,
    'instance',
  );
  for (const def of defs) {
    if (!def.is_required) continue;
    const value = values[def.key];
    if (isEmptyAttributeValue(value)) {
      throw badRequest('error.validation_failed');
    }
  }
}

/** Keys stored as instance system fields, not in attribute_values. */
const CASE_RESERVED_INSTANCE_ATTRIBUTE_KEYS = new Set(['status']);
const TASK_RESERVED_INSTANCE_ATTRIBUTE_KEYS = new Set([
  'status',
  'predecessor_task_ids',
  'dependent_task_ids',
]);

const ACTOR_RESERVED_INSTANCE_ATTRIBUTE_KEYS = new Set(['status']);

function reservedInstanceAttributeKeys(instanceType: InstanceOwnerType): Set<string> {
  if (instanceType === 'task') return TASK_RESERVED_INSTANCE_ATTRIBUTE_KEYS;
  if (instanceType === 'actor') return ACTOR_RESERVED_INSTANCE_ATTRIBUTE_KEYS;
  if (instanceType === 'message') return new Set<string>();
  return CASE_RESERVED_INSTANCE_ATTRIBUTE_KEYS;
}

function stripReservedInstanceKeys(
  instanceType: InstanceOwnerType,
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return values;
  const reserved = reservedInstanceAttributeKeys(instanceType);
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!reserved.has(key)) {
      stripped[key] = value;
    }
  }
  return stripped;
}

export async function upsertInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  instanceType: InstanceOwnerType,
  instanceId: string,
  modelType: ModelOwnerType,
  modelId: string,
  values: Record<string, unknown> | undefined,
): Promise<string[]> {
  const existing = await loadInstanceAttributes(
    client,
    tenantId,
    instanceType,
    instanceId,
    modelType,
    modelId,
  );
  const merged = await mergeInstanceAttributesWithDefaults(
    client,
    tenantId,
    modelType,
    modelId,
    {
      ...existing,
      ...stripReservedInstanceKeys(instanceType, values),
    },
  );

  await assertRequiredInstanceAttributes(client, tenantId, modelType, modelId, merged);

  const defs = await listAttributeDefinitions(
    client,
    tenantId,
    modelType,
    modelId,
    'instance',
  );

  const encryption = getEncryptionService();
  const changedKeys: string[] = [];

  for (const def of defs) {
    const rawValue = merged[def.key];

    if (isEmptyAttributeValue(rawValue)) {
      if (def.is_required) {
        throw badRequest('error.validation_failed');
      }
      continue;
    }

    const selectOptions = def.select_options ?? [];
    if (def.data_type === 'single_select' && typeof rawValue === 'string') {
      if (!selectOptions.includes(rawValue)) {
        throw badRequest('error.invalid_attribute_value');
      }
    }
    if (def.data_type === 'multi_select' && Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (typeof item !== 'string' || !selectOptions.includes(item)) {
          throw badRequest('error.invalid_attribute_value');
        }
      }
    }
    if (isReferenceDataType(def.data_type)) {
      if (typeof rawValue !== 'string' || !def.reference_target_type) {
        throw badRequest('error.invalid_attribute_value');
      }
      await assertReferencedEntityExists(
        client,
        tenantId,
        def.reference_target_type,
        rawValue,
        def.reference_target_model_id,
        { asInvalidValue: true },
      );
    }

    const serialized = serializeAttributeValue(def.data_type, rawValue);
    const stored = await encryption.encrypt(serialized);

    await client.query(
      `INSERT INTO meta.attribute_values
         (tenant_id, attribute_definition_id, owner_type, owner_id, plaintext_value, encryption_status)
       VALUES ($1, $2, $3, $4, $5, 'none')
       ON CONFLICT (tenant_id, attribute_definition_id, owner_type, owner_id)
       DO UPDATE SET plaintext_value = EXCLUDED.plaintext_value, updated_at = now()`,
      [tenantId, def.id, instanceType, instanceId, stored],
    );
    changedKeys.push(def.key);
  }

  return changedKeys;
}
