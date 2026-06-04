import type pg from 'pg';
import { badRequest, conflict, notFound } from '../api/errors.js';
import { displayNameFromTranslations } from '../foundation/i18n/display-name.js';
import type { Locale } from '../foundation/i18n/locale.js';
import { isSupportedLocale } from '../foundation/i18n/locale.js';
import { getEncryptionService } from '../foundation/encryption/passthrough.js';
import { allocateUniqueAttributeKey, slugifyModelKey } from './model-key.js';
import {
  assertDataType,
  assertDefinitionScope,
  assertModelKey,
  isEmptyAttributeValue,
  isSelectDataType,
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
  default_value?: unknown;
};

export type UpdateAttributeDefinitionInput = {
  name?: string;
  locale?: string;
  data_type?: string;
  encryption_mode?: string;
  translations?: Record<string, string>;
  is_required?: boolean;
  select_options?: string[];
  default_value?: unknown;
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
  default_value: unknown;
  display_name?: string;
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
  default_value: unknown;
  created_at: Date;
  updated_at: Date;
}

const DEFINITION_COLUMNS = `id, owner_type, owner_id, definition_scope, key, data_type,
  encryption_mode, translations, is_required, select_options, default_value,
  created_at, updated_at`;

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
    default_value: row.default_value ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export function enrichAttributeDefinition(
  definition: AttributeDefinitionDto,
  locale: Locale,
): AttributeDefinitionDto {
  return {
    ...definition,
    display_name: displayNameFromTranslations(definition.translations, definition.key, locale),
  };
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
  default_value: unknown | null;
  generateKeyFromName?: string;
} {
  assertDataType(input.data_type);
  const definitionScope = input.definition_scope ?? 'instance';
  assertDefinitionScope(definitionScope);

  const encryptionMode = input.encryption_mode ?? 'zero_knowledge';
  if (encryptionMode !== 'server_readable' && encryptionMode !== 'zero_knowledge') {
    throw badRequest('error.validation_failed');
  }

  const selectOptions = resolveSelectOptions(input.data_type, input.select_options ?? []);
  if (isSelectDataType(input.data_type) && selectOptions.length === 0) {
    throw badRequest('error.validation_failed');
  }

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
      default_value: defaultValue,
      generateKeyFromName: name,
    };
  }

  if (!input.key || !input.translations) {
    throw badRequest('error.validation_failed');
  }
  assertModelKey(input.key);
  return {
    key: input.key,
    definition_scope: definitionScope,
    data_type: input.data_type,
    encryption_mode: encryptionMode,
    translations: input.translations,
    is_required: isRequired,
    select_options: selectOptions,
    default_value: defaultValue,
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
  createdBy: string,
  options?: { defaultLocale?: Locale },
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

  try {
    const result = await client.query<DefinitionRow>(
      `INSERT INTO meta.attribute_definitions
         (tenant_id, owner_type, owner_id, definition_scope, key, data_type,
          encryption_mode, translations, is_required, select_options, default_value, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        resolved.default_value === null ? null : JSON.stringify(resolved.default_value),
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

  const dataType = (input.data_type ?? existing.data_type) as DataType;
  assertDataType(dataType);
  const encryptionMode = input.encryption_mode ?? existing.encryption_mode;
  const translations =
    resolveUpdateAttributeTranslations(existing, input, options?.defaultLocale ?? 'de') ??
    existing.translations;

  const selectOptions =
    input.select_options !== undefined
      ? resolveSelectOptions(dataType, input.select_options)
      : existing.select_options;
  if (isSelectDataType(dataType) && selectOptions.length === 0) {
    throw badRequest('error.validation_failed');
  }

  const isRequired = input.is_required ?? existing.is_required;
  let defaultValue = existing.default_value;
  if (input.default_value !== undefined) {
    defaultValue = resolveDefaultValue(dataType, selectOptions, input.default_value, false);
  }

  const result = await client.query<DefinitionRow>(
    `UPDATE meta.attribute_definitions
     SET data_type = $3, encryption_mode = $4, translations = $5,
         is_required = $6, select_options = $7, default_value = $8, updated_at = now()
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
      defaultValue === null ? null : JSON.stringify(defaultValue),
    ],
  );
  return mapDefinition(result.rows[0]!);
}

export async function deleteAttributeDefinition(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
): Promise<void> {
  const inUse = await client.query(
    `SELECT 1 FROM meta.attribute_values WHERE attribute_definition_id = $1 LIMIT 1`,
    [id],
  );
  if (inUse.rowCount && inUse.rowCount > 0) {
    throw conflict('error.model_in_use');
  }

  const result = await client.query(
    `DELETE FROM meta.attribute_definitions WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  if (!result.rowCount) throw notFound();
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

/** Keys handled as instance system fields, not custom attribute definitions. */
const RESERVED_INSTANCE_ATTRIBUTE_KEYS = new Set(['status']);

function stripReservedInstanceKeys(
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return values;
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!RESERVED_INSTANCE_ATTRIBUTE_KEYS.has(key)) {
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
  const merged = await mergeInstanceAttributesWithDefaults(
    client,
    tenantId,
    modelType,
    modelId,
    stripReservedInstanceKeys(values),
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
