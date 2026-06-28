import type pg from 'pg';
import { createAttributeDefinition } from './attributes.js';
import {
  DEFAULT_ACTOR_GROUP_OPTION_TRANSLATIONS,
  isActorGroupKey,
} from './actor-group.js';
import { TEAM_PLATFORMUSER } from '../platform/teams/team-keys.js';
import {
  ACTOR_MODEL_PLATFORM_INSTANCE_DEFINITIONS,
} from './actor-model-platform-attributes.js';

/** Default instance attributes seeded on every new actor model (tenant-editable). */
export const ACTOR_MODEL_DEFAULT_INSTANCE_ATTRIBUTES = [
  {
    key: 'name',
    data_type: 'text' as const,
    translations: { de: 'Name', en: 'Name' },
    encryption_mode: 'zero_knowledge' as const,
    is_required: false,
  },
  {
    key: 'first_name',
    data_type: 'text' as const,
    translations: { de: 'Vorname', en: 'First name' },
    encryption_mode: 'zero_knowledge' as const,
    is_required: false,
  },
  {
    key: 'email',
    data_type: 'text' as const,
    translations: { de: 'E-Mail', en: 'Email' },
    encryption_mode: 'zero_knowledge' as const,
    is_required: false,
  },
  {
    key: 'phone',
    data_type: 'text' as const,
    translations: { de: 'Telefon', en: 'Phone' },
    encryption_mode: 'zero_knowledge' as const,
    is_required: false,
  },
  {
    key: 'address',
    data_type: 'text' as const,
    translations: { de: 'Anschrift', en: 'Address' },
    encryption_mode: 'zero_knowledge' as const,
    is_required: false,
  },
] as const;

export async function seedActorModelPlatformInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId: string,
  createdBy: string | null,
): Promise<void> {
  for (const def of ACTOR_MODEL_PLATFORM_INSTANCE_DEFINITIONS) {
    const exists = await client.query(
      `SELECT 1 FROM meta.attribute_definitions
       WHERE tenant_id = $1 AND owner_type = 'actor_model' AND owner_id = $2
         AND definition_scope = 'instance' AND key = $3`,
      [tenantId, actorModelId, def.key],
    );
    if (exists.rowCount) continue;

    await createAttributeDefinition(
      client,
      tenantId,
      'actor_model',
      actorModelId,
      {
        key: def.key,
        definition_scope: 'instance',
        data_type: def.data_type,
        encryption_mode: def.encryption_mode,
        translations: def.translations,
        is_required: def.is_required,
        select_options: def.select_options,
        select_option_translations: def.select_option_translations,
        default_value: def.default_value,
      },
      createdBy,
      { allowPlatformKeys: true },
    );
  }
}

/**
 * Syncs the locked "group" instance attribute on every actor model so its
 * select options reflect all current tenant groups except "plattformuser"
 * (including tenant-defined groups, which have no stable key). System groups
 * keep their key as option value; custom groups use their id.
 */
export async function syncActorModelGroupOptions(
  client: pg.PoolClient,
  tenantId: string,
): Promise<void> {
  const groups = await client.query<{ id: string; key: string | null; name: string }>(
    `SELECT id, key, name
     FROM platform.teams
     WHERE tenant_id = $1 AND key IS DISTINCT FROM $2
     ORDER BY key NULLS LAST, name`,
    [tenantId, TEAM_PLATFORMUSER],
  );
  if (groups.rows.length === 0) return;

  const options: string[] = [];
  const translations: Record<string, Record<string, string>> = {};
  for (const group of groups.rows) {
    const value = group.key ?? group.id;
    options.push(value);
    const systemLabels =
      group.key && isActorGroupKey(group.key)
        ? DEFAULT_ACTOR_GROUP_OPTION_TRANSLATIONS[group.key]
        : undefined;
    translations[value] = systemLabels ?? { de: group.name, en: group.name };
  }

  await client.query(
    `UPDATE meta.attribute_definitions
     SET select_options = $2::jsonb,
         select_option_translations = $3::jsonb,
         updated_at = now()
     WHERE tenant_id = $1 AND owner_type = 'actor_model'
       AND definition_scope = 'instance' AND key = 'group'`,
    [tenantId, JSON.stringify(options), JSON.stringify(translations)],
  );
}

export async function ensureActorModelPlatformAttributesForTenant(
  client: pg.PoolClient,
  tenantId: string,
  createdBy: string | null = null,
): Promise<void> {
  const models = await client.query<{ id: string }>(
    `SELECT id FROM legal.actor_models WHERE tenant_id = $1`,
    [tenantId],
  );
  for (const row of models.rows) {
    await seedActorModelPlatformInstanceAttributes(client, tenantId, row.id, createdBy);
  }
}

export async function seedActorModelDefaultInstanceAttributes(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId: string,
  createdBy: string | null,
): Promise<void> {
  for (const def of ACTOR_MODEL_DEFAULT_INSTANCE_ATTRIBUTES) {
    const exists = await client.query(
      `SELECT 1 FROM meta.attribute_definitions
       WHERE tenant_id = $1 AND owner_type = 'actor_model' AND owner_id = $2
         AND definition_scope = 'instance' AND key = $3`,
      [tenantId, actorModelId, def.key],
    );
    if (exists.rowCount) continue;

    await createAttributeDefinition(
      client,
      tenantId,
      'actor_model',
      actorModelId,
      {
        key: def.key,
        definition_scope: 'instance',
        data_type: def.data_type,
        encryption_mode: def.encryption_mode,
        translations: def.translations,
        is_required: def.is_required,
      },
      createdBy,
    );
  }
}
