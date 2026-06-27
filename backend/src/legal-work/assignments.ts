import type pg from 'pg';
import { badRequest } from '../api/errors.js';

export interface AssigneeDto {
  actor_id: string;
  label: string;
}

async function actorDisplayLabel(
  client: pg.PoolClient,
  tenantId: string,
  actorId: string,
): Promise<string> {
  const nameResult = await client.query<{ plaintext_value: string | null }>(
    `SELECT av.plaintext_value
     FROM meta.attribute_values av
     JOIN meta.attribute_definitions ad ON ad.id = av.attribute_definition_id
     JOIN legal.actors a ON a.id = $2 AND a.actor_model_id = ad.owner_id
     WHERE av.tenant_id = $1
       AND av.owner_type = 'actor'
       AND av.owner_id = $2
       AND ad.owner_type = 'actor_model'
       AND ad.key = 'name'
     LIMIT 1`,
    [tenantId, actorId],
  );
  const name = nameResult.rows[0]?.plaintext_value?.trim();
  if (name) return name;

  const cred = await client.query<{ username: string }>(
    `SELECT username FROM platform.actor_credentials WHERE actor_id = $1 AND tenant_id = $2`,
    [actorId, tenantId],
  );
  return cred.rows[0]?.username ?? actorId;
}

export async function loadCaseAssignees(
  client: pg.PoolClient,
  tenantId: string,
  caseIds: string[],
): Promise<Map<string, AssigneeDto[]>> {
  const map = new Map<string, AssigneeDto[]>();
  if (caseIds.length === 0) return map;

  const result = await client.query<{ case_id: string; actor_id: string }>(
    `SELECT ca.case_id, ca.actor_id
     FROM legal.case_assignees ca
     WHERE ca.tenant_id = $1 AND ca.case_id = ANY($2::uuid[])
     ORDER BY ca.actor_id`,
    [tenantId, caseIds],
  );

  const labelCache = new Map<string, string>();
  for (const row of result.rows) {
    let label = labelCache.get(row.actor_id);
    if (!label) {
      label = await actorDisplayLabel(client, tenantId, row.actor_id);
      labelCache.set(row.actor_id, label);
    }
    const list = map.get(row.case_id) ?? [];
    list.push({ actor_id: row.actor_id, label });
    map.set(row.case_id, list);
  }
  return map;
}

async function assertActorsInTenant(
  client: pg.PoolClient,
  tenantId: string,
  actorIds: string[],
): Promise<void> {
  if (actorIds.length === 0) return;
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM legal.actors
     WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, actorIds],
  );
  const count = result.rows[0]?.count as number;
  if (count !== actorIds.length) {
    throw badRequest('error.validation_failed');
  }
}

export async function setCaseAssignees(
  client: pg.PoolClient,
  tenantId: string,
  caseId: string,
  actorIds: string[],
): Promise<void> {
  const unique = [...new Set(actorIds)];
  await assertActorsInTenant(client, tenantId, unique);
  await client.query(`DELETE FROM legal.case_assignees WHERE case_id = $1 AND tenant_id = $2`, [
    caseId,
    tenantId,
  ]);
  for (const actorId of unique) {
    await client.query(
      `INSERT INTO legal.case_assignees (case_id, actor_id, tenant_id) VALUES ($1, $2, $3)`,
      [caseId, actorId, tenantId],
    );
  }
}

export async function loadTaskAssignees(
  client: pg.PoolClient,
  tenantId: string,
  taskIds: string[],
): Promise<Map<string, AssigneeDto[]>> {
  const map = new Map<string, AssigneeDto[]>();
  if (taskIds.length === 0) return map;

  const result = await client.query<{ task_id: string; actor_id: string }>(
    `SELECT ta.task_id, ta.actor_id
     FROM legal.task_assignees ta
     WHERE ta.tenant_id = $1 AND ta.task_id = ANY($2::uuid[])
     ORDER BY ta.actor_id`,
    [tenantId, taskIds],
  );

  const labelCache = new Map<string, string>();
  for (const row of result.rows) {
    let label = labelCache.get(row.actor_id);
    if (!label) {
      label = await actorDisplayLabel(client, tenantId, row.actor_id);
      labelCache.set(row.actor_id, label);
    }
    const list = map.get(row.task_id) ?? [];
    list.push({ actor_id: row.actor_id, label });
    map.set(row.task_id, list);
  }
  return map;
}

export async function setTaskAssignees(
  client: pg.PoolClient,
  tenantId: string,
  taskId: string,
  actorIds: string[],
): Promise<void> {
  const unique = [...new Set(actorIds)];
  await assertActorsInTenant(client, tenantId, unique);
  await client.query(`DELETE FROM legal.task_assignees WHERE task_id = $1 AND tenant_id = $2`, [
    taskId,
    tenantId,
  ]);
  for (const actorId of unique) {
    await client.query(
      `INSERT INTO legal.task_assignees (task_id, actor_id, tenant_id) VALUES ($1, $2, $3)`,
      [taskId, actorId, tenantId],
    );
  }
}
