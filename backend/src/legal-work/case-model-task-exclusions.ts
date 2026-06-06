import type pg from 'pg';
import { forbidden, notFound } from '../api/errors.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';

export async function listCaseModelTaskModelExclusions(
  tenantId: string,
  caseModelId: string,
): Promise<string[]> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<{ task_model_id: string }>(
      `SELECT task_model_id
       FROM legal.case_model_task_model_exclusions
       WHERE tenant_id = $1 AND case_model_id = $2
       ORDER BY task_model_id`,
      [tenantId, caseModelId],
    );
    return result.rows.map((row) => row.task_model_id);
  });
}

export async function setCaseModelTaskModelExclusions(
  tenantId: string,
  caseModelId: string,
  taskModelIds: string[],
): Promise<string[]> {
  const unique = [...new Set(taskModelIds)];

  return withTenantTransaction(tenantId, async (client) => {
    const caseModel = await client.query(
      `SELECT 1 FROM legal.case_models WHERE id = $1 AND tenant_id = $2`,
      [caseModelId, tenantId],
    );
    if (!caseModel.rowCount) throw notFound();

    if (unique.length > 0) {
      const found = await client.query(
        `SELECT COUNT(*)::int AS count FROM legal.task_models
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [tenantId, unique],
      );
      if ((found.rows[0]?.count as number) !== unique.length) {
        throw notFound();
      }
    }

    await client.query(
      `DELETE FROM legal.case_model_task_model_exclusions
       WHERE tenant_id = $1 AND case_model_id = $2`,
      [tenantId, caseModelId],
    );

    for (const taskModelId of unique) {
      await client.query(
        `INSERT INTO legal.case_model_task_model_exclusions
           (tenant_id, case_model_id, task_model_id)
         VALUES ($1, $2, $3)`,
        [tenantId, caseModelId, taskModelId],
      );
    }

    return unique;
  });
}

export async function assertTaskModelAllowedOnCase(
  client: pg.PoolClient,
  tenantId: string,
  caseModelId: string,
  taskModelId: string,
): Promise<void> {
  const excluded = await client.query(
    `SELECT 1 FROM legal.case_model_task_model_exclusions
     WHERE tenant_id = $1 AND case_model_id = $2 AND task_model_id = $3
     LIMIT 1`,
    [tenantId, caseModelId, taskModelId],
  );
  if (excluded.rowCount) {
    throw forbidden('error.task_model_not_allowed_on_case_model');
  }
}
