import type pg from 'pg';
import { createAttributeDefinition } from './attributes.js';

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
  const { ACTOR_MODEL_PLATFORM_INSTANCE_DEFINITIONS } = await import(
    './actor-model-platform-attributes.js'
  );
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
