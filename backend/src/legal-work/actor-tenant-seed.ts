import type pg from 'pg';
import type { Locale } from '../foundation/i18n/locale.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import { resolveActorInstanceStatus } from './actor-instance-status.js';
import {
  seedActorModelDefaultInstanceAttributes,
  seedActorModelPlatformInstanceAttributes,
} from './actor-model-defaults.js';
import { upsertInstanceAttributes } from './attributes.js';

export const OWN_FIRM_ACTOR_MODEL_KEY = 'own_firm';
export const COLLABORATOR_ACTOR_MODEL_KEY = 'collaborator';

const OWN_FIRM_TRANSLATIONS = {
  de: 'Eigene Kanzlei',
  en: 'Own firm',
} as const;

const COLLABORATOR_TRANSLATIONS = {
  de: 'Mitarbeiter',
  en: 'Collaborator',
} as const;

export async function ensureOwnFirmActorModel(
  client: pg.PoolClient,
  tenantId: string,
  createdBy: string | null = null,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM legal.actor_models
     WHERE tenant_id = $1 AND key = $2`,
    [tenantId, OWN_FIRM_ACTOR_MODEL_KEY],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query<{ id: string }>(
    `INSERT INTO legal.actor_models
       (tenant_id, key, status, is_system, translations, description, description_translations)
     VALUES ($1, $2, 'active', true, $3, '', '{}')
     RETURNING id`,
    [tenantId, OWN_FIRM_ACTOR_MODEL_KEY, JSON.stringify(OWN_FIRM_TRANSLATIONS)],
  );
  const actorModelId = result.rows[0]!.id;
  await seedActorModelPlatformInstanceAttributes(client, tenantId, actorModelId, createdBy);
  await seedActorModelDefaultInstanceAttributes(client, tenantId, actorModelId, createdBy);
  return actorModelId;
}

export async function ensureCollaboratorActorModel(
  client: pg.PoolClient,
  tenantId: string,
  createdBy: string | null = null,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM legal.actor_models
     WHERE tenant_id = $1 AND key = $2`,
    [tenantId, COLLABORATOR_ACTOR_MODEL_KEY],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query<{ id: string }>(
    `INSERT INTO legal.actor_models
       (tenant_id, key, status, is_system, translations, description, description_translations)
     VALUES ($1, $2, 'active', false, $3, '', '{}')
     RETURNING id`,
    [tenantId, COLLABORATOR_ACTOR_MODEL_KEY, JSON.stringify(COLLABORATOR_TRANSLATIONS)],
  );
  const actorModelId = result.rows[0]!.id;
  await seedActorModelPlatformInstanceAttributes(client, tenantId, actorModelId, createdBy);
  await seedActorModelDefaultInstanceAttributes(client, tenantId, actorModelId, createdBy);
  return actorModelId;
}

async function insertTenantRootActor(
  client: pg.PoolClient,
  tenantId: string,
  actorModelId: string,
  firmName: string,
): Promise<string> {
  const status = await resolveActorInstanceStatus(
    client,
    tenantId,
    actorModelId,
    'active',
    { status: 'active' },
  );

  const result = await client.query<{ id: string }>(
    `INSERT INTO legal.actors (tenant_id, actor_model_id, status, is_tenant_root)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [tenantId, actorModelId, status],
  );
  const actorId = result.rows[0]!.id;
  await upsertInstanceAttributes(client, tenantId, 'actor', actorId, 'actor_model', actorModelId, {
    name: firmName.trim(),
    status,
  });
  return actorId;
}

export async function ensureTenantRootActor(
  client: pg.PoolClient,
  tenantId: string,
  firmName: string,
  createdBy: string | null = null,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM legal.actors
     WHERE tenant_id = $1 AND is_tenant_root = true`,
    [tenantId],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const actorModelId = await ensureOwnFirmActorModel(client, tenantId, createdBy);
  return insertTenantRootActor(client, tenantId, actorModelId, firmName);
}

async function runActorTenantBootstrap(
  client: pg.PoolClient,
  tenantId: string,
  firmName: string | undefined,
  createdBy: string | null,
): Promise<void> {
  let name = firmName?.trim();
  if (!name) {
    const profile = await client.query<{ firm_name: string }>(
      `SELECT firm_name FROM platform.tenant_profiles WHERE tenant_id = $1`,
      [tenantId],
    );
    name = profile.rows[0]?.firm_name ?? 'Kanzlei';
  }
  await ensureTenantRootActor(client, tenantId, name, createdBy);
  await ensureCollaboratorActorModel(client, tenantId, createdBy);
}

/**
 * Seeds the "own firm" actor model and tenant-root actor using an existing
 * transaction/client. Use this from within an open transaction (e.g. tenant
 * registration) so foreign keys resolve against uncommitted rows in the same
 * transaction instead of deadlocking on a separate connection.
 */
export async function bootstrapActorTenantDataWithClient(
  client: pg.PoolClient,
  tenantId: string,
  firmName?: string,
  createdBy: string | null = null,
): Promise<void> {
  await runActorTenantBootstrap(client, tenantId, firmName, createdBy);
}

export async function bootstrapActorTenantData(
  tenantId: string,
  firmName?: string,
  createdBy: string | null = null,
  _locale: Locale = 'de',
): Promise<void> {
  await withTenantTransaction(tenantId, async (client) => {
    await runActorTenantBootstrap(client, tenantId, firmName, createdBy);
  });
}
