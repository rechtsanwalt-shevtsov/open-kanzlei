import type pg from 'pg';
import { notFound } from '../api/errors.js';
import { getEventService } from '../foundation/events/event-service.js';
import type { PublicEventType } from '../foundation/events/event-types.js';
import { withTenantTransaction } from '../foundation/database/tenant-context.js';
import {
  loadInstanceAttributes,
  upsertInstanceAttributes,
} from './attributes.js';
import {
  loadTaskAssignees,
  setTaskAssignees,
  type AssigneeDto,
} from './assignments.js';
import { assertTaskModelAllowedOnCase } from './case-model-task-exclusions.js';
import { getCase } from './instances.js';
import { getTaskModel } from './task-models.js';
import { resolveTaskInstanceStatus } from './task-instance-status.js';
import {
  mapUuidArrayToStrings,
  resolveTaskReferenceIds,
} from './task-instance-references.js';
import { toIso } from './validation.js';
import {
  assertTaskNotReferencedByOthers,
  deleteInstanceAttributeValues,
} from './entity-guards.js';

export type CreateTaskBody = {
  case_id: string;
  task_model_id: string;
  status?: string;
  predecessor_task_ids?: string[];
  dependent_task_ids?: string[];
  attributes?: Record<string, unknown>;
  assignee_actor_ids?: string[];
};

export type UpdateTaskBody = {
  status?: string;
  predecessor_task_ids?: string[];
  dependent_task_ids?: string[];
  attributes?: Record<string, unknown>;
  assignee_actor_ids?: string[];
};

export interface TaskDto {
  id: string;
  case_id: string;
  task_model_id: string;
  status: string;
  predecessor_task_ids: string[];
  dependent_task_ids: string[];
  encryption_status: string;
  encryption_version: number | null;
  attributes?: Record<string, string | number | boolean | string[] | null>;
  assignees: AssigneeDto[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

type TaskRow = {
  id: string;
  case_id: string;
  task_model_id: string;
  status: string;
  predecessor_task_ids: string[];
  dependent_task_ids: string[];
  encryption_status: string;
  encryption_version: number | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

const TASK_ROW_SELECT = `id, case_id, task_model_id, status, predecessor_task_ids, dependent_task_ids,
                encryption_status, encryption_version, created_at, updated_at, completed_at`;

function withPlatformTaskAttributes(
  row: Pick<TaskRow, 'status' | 'predecessor_task_ids' | 'dependent_task_ids'>,
  attributes: Record<string, string | number | boolean | string[] | null>,
): Record<string, string | number | boolean | string[] | null> {
  return {
    ...attributes,
    status: row.status,
    predecessor_task_ids: mapUuidArrayToStrings(row.predecessor_task_ids),
    dependent_task_ids: mapUuidArrayToStrings(row.dependent_task_ids),
  };
}

async function publish(
  client: pg.PoolClient,
  tenantId: string,
  type: PublicEventType,
  aggregateType: string,
  aggregateId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  await getEventService().publish(client, {
    tenantId,
    type,
    aggregateType,
    aggregateId,
    data,
    actorId,
  });
}

function mapTaskRow(row: TaskRow): Omit<TaskDto, 'attributes' | 'assignees'> {
  return {
    id: row.id,
    case_id: row.case_id,
    task_model_id: row.task_model_id,
    status: row.status,
    predecessor_task_ids: mapUuidArrayToStrings(row.predecessor_task_ids),
    dependent_task_ids: mapUuidArrayToStrings(row.dependent_task_ids),
    encryption_status: row.encryption_status,
    encryption_version: row.encryption_version,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    completed_at: row.completed_at ? toIso(row.completed_at) : null,
  };
}

async function buildTaskDto(
  client: pg.PoolClient,
  tenantId: string,
  row: TaskRow,
  assigneeMap?: Map<string, AssigneeDto[]>,
): Promise<TaskDto> {
  const attributes = await loadInstanceAttributes(
    client,
    tenantId,
    'task',
    row.id,
    'task_model',
    row.task_model_id,
  );
  const assignees =
    assigneeMap?.get(row.id) ??
    (await loadTaskAssignees(client, tenantId, [row.id])).get(row.id) ??
    [];
  return {
    ...mapTaskRow(row),
    attributes: withPlatformTaskAttributes(row, attributes),
    assignees,
  };
}

export async function listTasks(
  tenantId: string,
  filters?: { case_id?: string; task_model_id?: string },
): Promise<TaskDto[]> {
  return withTenantTransaction(tenantId, async (client) => {
    let result;
    if (filters?.case_id && filters?.task_model_id) {
      result = await client.query<TaskRow>(
        `SELECT ${TASK_ROW_SELECT}
         FROM legal.tasks
         WHERE tenant_id = $1 AND case_id = $2 AND task_model_id = $3
         ORDER BY created_at DESC`,
        [tenantId, filters.case_id, filters.task_model_id],
      );
    } else if (filters?.case_id) {
      result = await client.query<TaskRow>(
        `SELECT ${TASK_ROW_SELECT}
         FROM legal.tasks
         WHERE tenant_id = $1 AND case_id = $2
         ORDER BY created_at DESC`,
        [tenantId, filters.case_id],
      );
    } else if (filters?.task_model_id) {
      result = await client.query<TaskRow>(
        `SELECT ${TASK_ROW_SELECT}
         FROM legal.tasks
         WHERE tenant_id = $1 AND task_model_id = $2
         ORDER BY created_at DESC`,
        [tenantId, filters.task_model_id],
      );
    } else {
      result = await client.query<TaskRow>(
        `SELECT ${TASK_ROW_SELECT}
         FROM legal.tasks
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId],
      );
    }

    const assigneeMap = await loadTaskAssignees(
      client,
      tenantId,
      result.rows.map((r) => r.id),
    );
    const items: TaskDto[] = [];
    for (const row of result.rows) {
      items.push(await buildTaskDto(client, tenantId, row, assigneeMap));
    }
    return items;
  });
}

export async function createTask(
  tenantId: string,
  input: {
    case_id: string;
    task_model_id: string;
    status?: string;
    predecessor_task_ids?: string[];
    dependent_task_ids?: string[];
    attributes?: Record<string, unknown>;
    assignee_actor_ids?: string[];
  },
): Promise<TaskDto> {
  const caseItem = await getCase(tenantId, input.case_id);
  if (!caseItem) throw notFound();
  if (!(await getTaskModel(tenantId, input.task_model_id))) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    await assertTaskModelAllowedOnCase(
      client,
      tenantId,
      caseItem.case_model_id,
      input.task_model_id,
    );

    const status = await resolveTaskInstanceStatus(
      client,
      tenantId,
      input.task_model_id,
      input.status,
      input.attributes,
    );
    const refs = await resolveTaskReferenceIds(client, tenantId, input);

    const result = await client.query<TaskRow>(
      `INSERT INTO legal.tasks
         (tenant_id, case_id, task_model_id, status, predecessor_task_ids, dependent_task_ids,
          completed_at)
       VALUES ($1, $2, $3, $4, $5::uuid[], $6::uuid[],
               CASE WHEN $4 = 'completed' THEN now() ELSE NULL END)
       RETURNING ${TASK_ROW_SELECT}`,
      [
        tenantId,
        input.case_id,
        input.task_model_id,
        status,
        refs.predecessor_task_ids,
        refs.dependent_task_ids,
      ],
    );
    const row = result.rows[0]!;
    if (input.assignee_actor_ids?.length) {
      await setTaskAssignees(client, tenantId, row.id, input.assignee_actor_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
      input.attributes,
    );
    await publish(client, tenantId, 'task.created', 'task', row.id, {
      task_id: row.id,
      case_id: row.case_id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    return buildTaskDto(client, tenantId, row);
  });
}

export async function getTask(tenantId: string, id: string): Promise<TaskDto | null> {
  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query<TaskRow>(
      `SELECT ${TASK_ROW_SELECT}
       FROM legal.tasks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return buildTaskDto(client, tenantId, row);
  });
}

export async function updateTask(
  tenantId: string,
  id: string,
  input: {
    status?: string;
    predecessor_task_ids?: string[];
    dependent_task_ids?: string[];
    attributes?: Record<string, unknown>;
    assignee_actor_ids?: string[];
  },
): Promise<TaskDto> {
  const existing = await getTask(tenantId, id);
  if (!existing) throw notFound();

  return withTenantTransaction(tenantId, async (client) => {
    let nextStatus: string | undefined;
    if (input.status !== undefined || input.attributes?.status !== undefined) {
      nextStatus = await resolveTaskInstanceStatus(
        client,
        tenantId,
        existing.task_model_id,
        input.status ?? existing.status,
        input.attributes,
      );
    }

    const refs = await resolveTaskReferenceIds(client, tenantId, input, {
      selfTaskId: id,
      existing: {
        predecessor_task_ids: existing.predecessor_task_ids,
        dependent_task_ids: existing.dependent_task_ids,
      },
    });

    let completedAtAction: 'set' | 'clear' | null = null;
    if (nextStatus !== undefined) {
      if (nextStatus === 'completed') {
        completedAtAction = 'set';
      } else if (existing.status === 'completed') {
        completedAtAction = 'clear';
      }
    }

    const result = await client.query<TaskRow>(
      `UPDATE legal.tasks
       SET status = COALESCE($3, status),
           predecessor_task_ids = $4::uuid[],
           dependent_task_ids = $5::uuid[],
           completed_at = CASE
             WHEN $6 = 'set' THEN now()
             WHEN $6 = 'clear' THEN NULL
             ELSE completed_at
           END,
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${TASK_ROW_SELECT}`,
      [
        id,
        tenantId,
        nextStatus ?? null,
        refs.predecessor_task_ids,
        refs.dependent_task_ids,
        completedAtAction,
      ],
    );
    const row = result.rows[0]!;
    if (input.assignee_actor_ids !== undefined) {
      await setTaskAssignees(client, tenantId, row.id, input.assignee_actor_ids);
    }
    const changedKeys = await upsertInstanceAttributes(
      client,
      tenantId,
      'task',
      row.id,
      'task_model',
      row.task_model_id,
      input.attributes,
    );
    await publish(client, tenantId, 'task.updated', 'task', row.id, {
      task_id: row.id,
      case_id: row.case_id,
      ...(changedKeys.length ? { changed_attribute_keys: changedKeys } : {}),
    });
    return buildTaskDto(client, tenantId, row);
  });
}

export async function deleteTask(tenantId: string, id: string): Promise<void> {
  return withTenantTransaction(tenantId, async (client) => {
    const existing = await client.query(
      `SELECT 1 FROM legal.tasks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!existing.rowCount) throw notFound();

    await assertTaskNotReferencedByOthers(client, tenantId, id);
    await deleteInstanceAttributeValues(client, tenantId, 'task', id);

    await client.query(`DELETE FROM legal.tasks WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    await publish(client, tenantId, 'task.deleted', 'task', id, { task_id: id });
  });
}
