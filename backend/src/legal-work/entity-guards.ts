import type pg from 'pg';
import { conflict } from '../api/errors.js';

export async function assertCaseHasNoTasks(
  client: pg.PoolClient,
  tenantId: string,
  caseId: string,
): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM legal.tasks WHERE case_id = $1 AND tenant_id = $2 LIMIT 1`,
    [caseId, tenantId],
  );
  if (result.rowCount) throw conflict('error.case_in_use');
}

export async function assertTaskNotReferencedByOthers(
  client: pg.PoolClient,
  tenantId: string,
  taskId: string,
): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM legal.tasks
     WHERE tenant_id = $1 AND id <> $2
       AND ($2 = ANY(predecessor_task_ids) OR $2 = ANY(dependent_task_ids))
     LIMIT 1`,
    [tenantId, taskId],
  );
  if (result.rowCount) throw conflict('error.task_in_use');
}

export async function deleteAttributeDefinitionsForModel(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: 'case_model' | 'task_model' | 'actor_model',
  modelId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM meta.attribute_definitions
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3`,
    [tenantId, ownerType, modelId],
  );
}

export async function deleteInstanceAttributeValues(
  client: pg.PoolClient,
  tenantId: string,
  ownerType: 'case' | 'task' | 'actor',
  ownerId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM meta.attribute_values
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3`,
    [tenantId, ownerType, ownerId],
  );
}

export async function deleteCaseDocuments(
  client: pg.PoolClient,
  tenantId: string,
  caseId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM legal.documents
     WHERE tenant_id = $1 AND owner_type = 'case' AND owner_id = $2`,
    [tenantId, caseId],
  );
}
