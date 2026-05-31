import type pg from 'pg';
import { badRequest, conflict, notFound } from '../api/errors.js';
import { displayNameFromTranslations } from '../foundation/i18n/display-name.js';
import type { Locale } from '../foundation/i18n/locale.js';
import { isSupportedLocale } from '../foundation/i18n/locale.js';
import { getEncryptionService } from '../foundation/encryption/passthrough.js';
import {
  assertDataType,
  assertModelKey,
  parseAttributeValue,
  serializeAttributeValue,
  toIso,
  type DataType,
  type InstanceOwnerType,
  type ModelOwnerType,
} from './validation.js';
import { allocateUniqueAttributeKey, slugifyModelKey } from './model-key.js';

export type CreateAttributeDefinitionInput = {
  key?: string;
  name?: string;
  locale?: string;
  data_type: string;
  encryption_mode?: string;
  translations?: Record<string, string>;
};

export type UpdateAttributeDefinitionInput = {
  name?: string;
  locale?: string;
  data_type?: string;
  encryption_mode?: string;
  translations?: Record<string, string>;
};

export interface AttributeDefinitionDto {
  id: string;
  owner_type: ModelOwnerType;
  owner_id: string;
  key: string;
  data_type: DataType;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  translations: Record<string, string>;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

interface DefinitionRow {
  id: string;
  owner_type: ModelOwnerType;
  owner_id: string;
  key: string;
  data_type: DataType;
  encryption_mode: 'server_readable' | 'zero_knowledge';
  translations: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function mapDefinition(row: DefinitionRow): AttributeDefinitionDto {
  return {
    id: row.id,
    owner_type: row.owner_type,
    owner_id: row.owner_id,
    key: row.key,
    data_type: row.data_type,
    encryption_mode: row.encryption_mode,
    translations: row.translations ?? {},
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

function resolveCreateAttributeFields(
  input: CreateAttributeDefinitionInput,
  defaultLocale: Locale,
): {
  key?: string;
  data_type: string;
  encryption_mode?: string;
  translations: Record<string, string>;
  generateKeyFromName?: string;
} {
  assertDataType(input.data_type);
  const encryptionMode = input.encryption_mode ?? 'zero_knowledge';
  if (encryptionMode !== 'server_readable' && encryptionMode !== 'zero_knowledge') {
    throw badRequest('error.validation_failed');
  }

  if (input.name !== undefined) {
    const name = assertNonEmptyName(input.name);
    const locale = resolveLocale(input.locale, defaultLocale);
    return {
      data_type: input.data_type,
      encryption_mode: encryptionMode,
      translations: { [locale]: name },
      generateKeyFromName: name,
    };
  }

  if (!input.key || !input.translations) {
    throw badRequest('error.validation_failed');
  }
  assertModelKey(input.key);
  return {
    key: input.key,
    data_type: input.data_type,
    encryption_mode: encryptionMode,
    translations: input.translations,
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
): Promise<AttributeDefinitionDto[]> {
  const result = await client.query<DefinitionRow>(
    `SELECT id, owner_type, owner_id, key, data_type, encryption_mode, translations,
            created_at, updated_at
     FROM meta.attribute_definitions
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
     ORDER BY key`,
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
      slugifyModelKey(resolved.generateKeyFromName!),
    ));

  try {
    const result = await client.query<DefinitionRow>(
      `INSERT INTO meta.attribute_definitions
         (tenant_id, owner_type, owner_id, key, data_type, encryption_mode, translations, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner_type, owner_id, key, data_type, encryption_mode, translations,
                 created_at, updated_at`,
      [
        tenantId,
        ownerType,
        ownerId,
        key,
        resolved.data_type,
        resolved.encryption_mode ?? 'zero_knowledge',
        JSON.stringify(resolved.translations),
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

  const dataType = input.data_type ?? existing.data_type;
  assertDataType(dataType);
  const encryptionMode = input.encryption_mode ?? existing.encryption_mode;
  const translations = resolveUpdateAttributeTranslations(
    existing,
    input,
    options?.defaultLocale ?? 'de',
  ) ?? existing.translations;

  const result = await client.query<DefinitionRow>(
    `UPDATE meta.attribute_definitions
     SET data_type = $3, encryption_mode = $4, translations = $5, updated_at = now()
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, owner_type, owner_id, key, data_type, encryption_mode, translations,
               created_at, updated_at`,
    [tenantId, id, dataType, encryptionMode, JSON.stringify(translations)],
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
    `SELECT id, owner_type, owner_id, key, data_type, encryption_mode, translations,
            created_at, updated_at
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
): Promise<Record<string, string | number | boolean | null>> {
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
     WHERE d.tenant_id = $1 AND d.owner_type = $4 AND d.owner_id = $5`,
    [tenantId, instanceType, instanceId, modelType, modelId],
  );

  const attrs: Record<string, string | number | boolean | null> = {};
  for (const row of result.rows) {
    if (row.plaintext_value !== null) {
      attrs[row.key] = parseAttributeValue(row.data_type, row.plaintext_value);
    }
  }
  return attrs;
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
  if (!values || Object.keys(values).length === 0) return [];

  const encryption = getEncryptionService();
  const changedKeys: string[] = [];

  for (const [key, rawValue] of Object.entries(values)) {
    const defResult = await client.query<{
      id: string;
      data_type: DataType;
      encryption_mode: string;
    }>(
      `SELECT id, data_type, encryption_mode
       FROM meta.attribute_definitions
       WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND key = $4`,
      [tenantId, modelType, modelId, key],
    );
    const def = defResult.rows[0];
    if (!def) {
      throw badRequest('error.attribute_not_defined');
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
    changedKeys.push(key);
  }

  return changedKeys;
}
