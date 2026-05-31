import type pg from 'pg';
import { badRequest } from '../api/errors.js';

export interface AssigneeDto {
  user_id: string;
  username: string;
}

export async function loadCaseAssignees(
  client: pg.PoolClient,
  tenantId: string,
  caseIds: string[],
): Promise<Map<string, AssigneeDto[]>> {
  const map = new Map<string, AssigneeDto[]>();
  if (caseIds.length === 0) return map;

  const result = await client.query<AssigneeDto & { case_id: string }>(
    `SELECT ca.case_id, u.id AS user_id, u.username
     FROM legal.case_assignees ca
     JOIN platform.users u ON u.id = ca.user_id AND u.tenant_id = ca.tenant_id
     WHERE ca.tenant_id = $1 AND ca.case_id = ANY($2::uuid[])
     ORDER BY u.username`,
    [tenantId, caseIds],
  );

  for (const row of result.rows) {
    const list = map.get(row.case_id) ?? [];
    list.push({ user_id: row.user_id, username: row.username });
    map.set(row.case_id, list);
  }
  return map;
}

export async function loadTaskAssignees(
  client: pg.PoolClient,
  tenantId: string,
  taskIds: string[],
): Promise<Map<string, AssigneeDto[]>> {
  const map = new Map<string, AssigneeDto[]>();
  if (taskIds.length === 0) return map;

  const result = await client.query<AssigneeDto & { task_id: string }>(
    `SELECT ta.task_id, u.id AS user_id, u.username
     FROM legal.task_assignees ta
     JOIN platform.users u ON u.id = ta.user_id AND u.tenant_id = ta.tenant_id
     WHERE ta.tenant_id = $1 AND ta.task_id = ANY($2::uuid[])
     ORDER BY u.username`,
    [tenantId, taskIds],
  );

  for (const row of result.rows) {
    const list = map.get(row.task_id) ?? [];
    list.push({ user_id: row.user_id, username: row.username });
    map.set(row.task_id, list);
  }
  return map;
}

async function assertUsersInTenant(
  client: pg.PoolClient,
  tenantId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM platform.users
     WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND is_active = true`,
    [tenantId, userIds],
  );
  const count = result.rows[0]?.count as number;
  if (count !== userIds.length) {
    throw badRequest('error.validation_failed');
  }
}

export async function setCaseAssignees(
  client: pg.PoolClient,
  tenantId: string,
  caseId: string,
  userIds: string[],
): Promise<void> {
  const unique = [...new Set(userIds)];
  await assertUsersInTenant(client, tenantId, unique);
  await client.query(`DELETE FROM legal.case_assignees WHERE case_id = $1 AND tenant_id = $2`, [
    caseId,
    tenantId,
  ]);
  for (const userId of unique) {
    await client.query(
      `INSERT INTO legal.case_assignees (case_id, user_id, tenant_id) VALUES ($1, $2, $3)`,
      [caseId, userId, tenantId],
    );
  }
}

export async function setTaskAssignees(
  client: pg.PoolClient,
  tenantId: string,
  taskId: string,
  userIds: string[],
): Promise<void> {
  const unique = [...new Set(userIds)];
  await assertUsersInTenant(client, tenantId, unique);
  await client.query(`DELETE FROM legal.task_assignees WHERE task_id = $1 AND tenant_id = $2`, [
    taskId,
    tenantId,
  ]);
  for (const userId of unique) {
    await client.query(
      `INSERT INTO legal.task_assignees (task_id, user_id, tenant_id) VALUES ($1, $2, $3)`,
      [taskId, userId, tenantId],
    );
  }
}
