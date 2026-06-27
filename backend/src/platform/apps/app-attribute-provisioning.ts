import type pg from 'pg';
import { createAttributeDefinition } from '../../legal-work/attributes.js';
import type { DefinitionScope, ModelOwnerType } from '../../legal-work/validation.js';
import { getAppManifest } from './registry.js';
import type { AppManifestDto } from './registry-loader.js';
import {
  buildAppProvidedAttributeKey,
  type ManifestProvidesAttribute,
  type ManifestRequiresAttribute,
} from './app-attribute-contract.js';
import {
  listActiveAppKeysForTenant,
  recordAppAttributeBinding,
} from './app-attribute-bindings.js';
import { resolveRequiredAttributeSeed } from './shared-attribute-registry.js';

async function attributeDefinitionExists(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  definitionScope: DefinitionScope,
  key: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM meta.attribute_definitions
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3
       AND definition_scope = $4 AND key = $5`,
    [tenantId, ownerType, ownerId, definitionScope, key],
  );
  return Boolean(result.rowCount);
}

async function ensureRequiredAttribute(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  ref: ManifestRequiresAttribute,
  actorUserId: string | null,
): Promise<string> {
  const definitionScope = ref.definition_scope ?? 'instance';
  const seed = resolveRequiredAttributeSeed(ref.key, ref.target, definitionScope);
  if (!seed) return ref.key;

  const exists = await attributeDefinitionExists(
    client,
    tenantId,
    ownerType,
    ownerId,
    definitionScope,
    ref.key,
  );
  if (!exists) {
    await createAttributeDefinition(
      client,
      tenantId,
      ownerType,
      ownerId,
      {
        key: seed.key,
        definition_scope: definitionScope,
        data_type: seed.data_type,
        encryption_mode: seed.encryption_mode,
        translations: seed.translations,
        is_required: seed.is_required,
        select_options: seed.select_options,
        select_option_translations: seed.select_option_translations,
        default_value: seed.default_value,
      },
      actorUserId,
      { allowPlatformKeys: true, allowSharedRegistryKeys: true, allowAppKeys: true },
    );
  }

  return ref.key;
}

async function ensureProvidedAttribute(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  appKey: string,
  provided: ManifestProvidesAttribute,
  actorUserId: string | null,
): Promise<string> {
  const definitionScope = provided.definition_scope ?? 'instance';
  const fullKey = buildAppProvidedAttributeKey(appKey, provided.key);

  const exists = await attributeDefinitionExists(
    client,
    tenantId,
    ownerType,
    ownerId,
    definitionScope,
    fullKey,
  );
  if (!exists) {
    await createAttributeDefinition(
      client,
      tenantId,
      ownerType,
      ownerId,
      {
        key: fullKey,
        definition_scope: definitionScope,
        data_type: provided.data_type,
        encryption_mode: provided.encryption_mode ?? 'server_readable',
        translations: provided.translations,
        is_required: Boolean(provided.is_required),
        select_options: provided.select_options,
        select_option_translations: provided.select_option_translations,
        default_value: provided.default_value,
      },
      actorUserId,
      { allowPlatformKeys: true, allowSharedRegistryKeys: true, allowAppKeys: true },
    );
  }

  return fullKey;
}

async function provisionManifestOnModel(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  manifest: AppManifestDto,
  actorUserId: string | null,
): Promise<void> {
  for (const ref of manifest.requires_attributes) {
    if (ref.target !== ownerType) continue;
    const definitionScope = ref.definition_scope ?? 'instance';
    const attributeKey = await ensureRequiredAttribute(
      client,
      tenantId,
      ownerType,
      ownerId,
      ref,
      actorUserId,
    );
    await recordAppAttributeBinding(
      client,
      tenantId,
      manifest.app_key,
      ownerType,
      ownerId,
      definitionScope,
      attributeKey,
      'requires',
    );
  }

  for (const provided of manifest.provides_attributes) {
    if (provided.target !== ownerType) continue;
    const definitionScope = provided.definition_scope ?? 'instance';
    const attributeKey = await ensureProvidedAttribute(
      client,
      tenantId,
      ownerType,
      ownerId,
      manifest.app_key,
      provided,
      actorUserId,
    );
    await recordAppAttributeBinding(
      client,
      tenantId,
      manifest.app_key,
      ownerType,
      ownerId,
      definitionScope,
      attributeKey,
      'provides',
    );
  }
}

export async function provisionAppAttributesOnModel(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: ModelOwnerType,
  ownerId: string,
  actorUserId: string | null,
): Promise<void> {
  const activeApps = await listActiveAppKeysForTenant(client, tenantId);
  for (const appKey of activeApps) {
    const manifest = getAppManifest(appKey);
    if (!manifest) continue;
    await provisionManifestOnModel(client, tenantId, ownerType, ownerId, manifest, actorUserId);
  }
}

export async function provisionAppAttributesForTenant(
  client: pg.PoolClient,
  tenantId: string,
  appKey: string,
  actorUserId: string | null,
): Promise<void> {
  const manifest = getAppManifest(appKey);
  if (!manifest) return;

  const needsCaseModels =
    manifest.requires_attributes.some((r) => r.target === 'case_model') ||
    manifest.provides_attributes.some((p) => p.target === 'case_model');
  const needsTaskModels =
    manifest.requires_attributes.some((r) => r.target === 'task_model') ||
    manifest.provides_attributes.some((p) => p.target === 'task_model');

  if (needsCaseModels) {
    const caseModels = await client.query<{ id: string }>(
      `SELECT id FROM legal.case_models WHERE tenant_id = $1`,
      [tenantId],
    );
    for (const row of caseModels.rows) {
      await provisionManifestOnModel(
        client,
        tenantId,
        'case_model',
        row.id,
        manifest,
        actorUserId,
      );
    }
  }

  if (needsTaskModels) {
    const taskModels = await client.query<{ id: string }>(
      `SELECT id FROM legal.task_models WHERE tenant_id = $1`,
      [tenantId],
    );
    for (const row of taskModels.rows) {
      await provisionManifestOnModel(
        client,
        tenantId,
        'task_model',
        row.id,
        manifest,
        actorUserId,
      );
    }
  }
}
