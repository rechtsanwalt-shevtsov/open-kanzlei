import type pg from 'pg';
import { badRequest } from '../api/errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTaskIdArray(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    throw badRequest('error.invalid_attribute_value');
  }
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) {
      throw badRequest('error.invalid_attribute_value');
    }
    const id = item.trim();
    if (!UUID_PATTERN.test(id)) {
      throw badRequest('error.invalid_attribute_value');
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function readTaskIdArrayFromInput(
  key: 'predecessor_task_ids' | 'dependent_task_ids',
  topLevel: string[] | undefined,
  attributes?: Record<string, unknown>,
): string[] | undefined {
  if (topLevel !== undefined) return topLevel;
  return parseTaskIdArray(attributes?.[key]);
}

async function assertTasksExistInTenant(
  client: pg.PoolClient,
  tenantId: string,
  taskIds: string[],
  selfTaskId?: string,
): Promise<void> {
  for (const taskId of taskIds) {
    if (selfTaskId && taskId === selfTaskId) {
      throw badRequest('error.invalid_attribute_value');
    }
    const exists = await client.query(
      `SELECT 1 FROM legal.tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [taskId, tenantId],
    );
    if (!exists.rowCount) {
      throw badRequest('error.invalid_attribute_value');
    }
  }
}

export async function resolveTaskReferenceIds(
  client: pg.PoolClient,
  tenantId: string,
  input: {
    predecessor_task_ids?: string[];
    dependent_task_ids?: string[];
    attributes?: Record<string, unknown>;
  },
  options?: { selfTaskId?: string; existing?: { predecessor_task_ids: string[]; dependent_task_ids: string[] } },
): Promise<{ predecessor_task_ids: string[]; dependent_task_ids: string[] }> {
  const predecessor =
    readTaskIdArrayFromInput(
      'predecessor_task_ids',
      input.predecessor_task_ids,
      input.attributes,
    ) ?? options?.existing?.predecessor_task_ids ?? [];
  const dependent =
    readTaskIdArrayFromInput(
      'dependent_task_ids',
      input.dependent_task_ids,
      input.attributes,
    ) ?? options?.existing?.dependent_task_ids ?? [];

  await assertTasksExistInTenant(client, tenantId, predecessor, options?.selfTaskId);
  await assertTasksExistInTenant(client, tenantId, dependent, options?.selfTaskId);

  return {
    predecessor_task_ids: predecessor,
    dependent_task_ids: dependent,
  };
}

export function mapUuidArrayToStrings(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values.map(String);
}
