import type pg from 'pg';
import { conflict, notFound } from '../api/errors.js';
import { getEventService } from '../foundation/events/event-service.js';
import type { PublicEventType } from '../foundation/events/event-types.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  loadInstanceAttributes,
  upsertInstanceAttributes,
} from './attributes.js';
import { getActorModel } from './actor-models.js';
import { resolveActorInstanceStatus } from './actor-instance-status.js';
import { deleteInstanceAttributeValues } from './entity-guards.js';
import { toIso } from './validation.js';

export interface ActorDto {
  id: string;
  actor_model_id: string;
  status: string;
  is_tenant_root: boolean;
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | string[] | null>;
  created_at: string;
  updated_at: string;
}

type InstanceRow = {
  id: string;
  actor_model_id: string;
  status: string;
  is_tenant_root: boolean;
  encryption_status: string;
  encryption_version: number | null;
  created_at: Date;
  updated_at: Date;
};

function withStatusAttribute(
  status: string,
  attributes: Record<string, string | number | boolean | string[] | null>,
): Record<string, string | number | boolean | string[] | null> {
  return { ...attributes, status };
}

async function publish(
  client: pg.PoolClient,
  tenantId: string,
  type: PublicEventType,
  aggregateType: string,
  aggregateId: string,
  data: Record<string, unknown>,
  actorUserId?: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType,
    aggregateId,
    data,
    actorUserId,
  });
}

export async function listActors(
  tenantId: string,
  actorModelId?: string,
): Promise<ActorDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = actorModelId
      ? await client.query<InstanceRow>(
          `SELECT id, actor_model_id, status, is_tenant_root, encryption_status, encryption_version,
                  created_at, updated_at
           FROM legal.actors
           WHERE actor_model_id = $1 AND tenant_id = $2
           ORDER BY created_at DESC`,
          [actorModelId, tenantId],
        )
      : await client.query<InstanceRow>(
          `SELECT id, actor_model_id, status, is_tenant_root, encryption_status, encryption_version,
                  created_at, updated_at
           FROM legal.actors WHERE tenant_id = $1 ORDER BY created_at DESC`,
          [tenantId],
        );

    const items: ActorDto[] = [];
    for (const row of result.rows) {
      const attrs = await loadInstanceAttributes(
        client,
        tenantId,
        'actor',
        row.id,
        'actor_model',
        row.actor_model_id,
      );
      items.push({
        id: row.id,
        actor_model_id: row.actor_model_id,
        status: row.status,
        is_tenant_root: row.is_tenant_root,
        encryption_status: row.encryption_status,
        encryption_version: row.encryption_version,
        attributes: withStatusAttribute(row.status, attrs),
        created_at: toIso(row.created_at),
        updated_at: toIso(row.updated_at),
      });
    }
    return items;
  });
}

export async function createActor(
  tenantId: string,
  input: {
    actor_model_id: string;
    status?: string;
    attributes?: Record<string, unknown>;
    is_tenant_root?: boolean;
  },
  options?: { actorUserId?: string; skipTenantRootCheck?: boolean },
): Promise<ActorDto> {
  if (!(await getActorModel(tenantId, input.actor_model_id))) throw notFound();
  const isTenantRoot = input.is_tenant_root === true;

  return withTenantTransaction(tenantId, async (client) => {
    if (isTenantRoot && !options?.skipTenantRootCheck) {
      throw conflict('error.actor_tenant_root');
    }

    const status = await resolveActorInstanceStatus(
      client,
      tenantId,
      input.actor_model_id,
      input.status,
      input.attributes,
    );

    const result = await client.query<InstanceRow>(
      `INSERT INTO legal.actors (tenant_id, actor_model_id, status, is_tenant_root)
       VALUES ($1, $2, $3, $4)
       RETURNING id, actor_model_id, status, is_tenant_root, encryption_status, encryption_version,
                 created_at, updated_at`,
      [tenantId, input.actor_model_id, status, isTenantRoot],
    );
    const row = result.rows[0]!;

    if (input.attributes) {
      await upsertInstanceAttributes(
        client,
        tenantId,
        'actor',
        row.id,
        'actor_model',
        input.actor_model_id,
        input.attributes,
      );
    }

    const attrs = await loadInstanceAttributes(
      client,
      tenantId,
      'actor',
      row.id,
      'actor_model',
      input.actor_model_id,
    );

    await publish(
      client,
      tenantId,
      'actor.created',
      'actor',
      row.id,
      { actor_id: row.id, actor_model_id: input.actor_model_id },
      options?.actorUserId,
    );

    return {
      id: row.id,
      actor_model_id: row.actor_model_id,
      status: row.status,
      is_tenant_root: row.is_tenant_root,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes: withStatusAttribute(row.status, attrs),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function getActor(tenantId: string, id: string): Promise<ActorDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<InstanceRow>(
      `SELECT id, actor_model_id, status, is_tenant_root, encryption_status, encryption_version,
              created_at, updated_at
       FROM legal.actors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const attrs = await loadInstanceAttributes(
      client,
      tenantId,
      'actor',
      row.id,
      'actor_model',
      row.actor_model_id,
    );

    return {
      id: row.id,
      actor_model_id: row.actor_model_id,
      status: row.status,
      is_tenant_root: row.is_tenant_root,
      encryption_status: row.encryption_status,
      encryption_version: row.encryption_version,
      attributes: withStatusAttribute(row.status, attrs),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  });
}

export async function updateActor(
  tenantId: string,
  id: string,
  input: {
    status?: string;
    attributes?: Record<string, unknown>;
  },
  actorUserId?: string,
): Promise<ActorDto> {
  const existing = await getActor(tenantId, id);
  if (!existing) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    const status = await resolveActorInstanceStatus(
      client,
      tenantId,
      existing.actor_model_id,
      input.status ?? existing.status,
      input.attributes,
    );

    await client.query(
      `UPDATE legal.actors SET status = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, status],
    );

    if (input.attributes) {
      await upsertInstanceAttributes(
        client,
        tenantId,
        'actor',
        id,
        'actor_model',
        existing.actor_model_id,
        input.attributes,
      );
    }

    const updated = await getActor(tenantId, id);
    if (!updated) throw notFound();

    await publish(
      client,
      tenantId,
      'actor.updated',
      'actor',
      id,
      { actor_id: id },
      actorUserId,
    );
    return updated;
  });
}

export async function deleteActor(
  tenantId: string,
  id: string,
  actorUserId?: string,
): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const row = await client.query<{ is_tenant_root: boolean }>(
      `SELECT is_tenant_root FROM legal.actors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!row.rows[0]) throw notFound();
    if (row.rows[0].is_tenant_root) throw conflict('error.actor_tenant_root');

    await deleteInstanceAttributeValues(client, tenantId, 'actor', id);

    const result = await client.query(
      `DELETE FROM legal.actors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!result.rowCount) throw notFound();

    await publish(
      client,
      tenantId,
      'actor.deleted',
      'actor',
      id,
      { actor_id: id },
      actorUserId,
    );
  });
}
